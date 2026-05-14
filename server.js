#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const git = require('./lib/git');
const { buildBlocks } = require('./lib/diff');
const { renderMarkdown, renderBlocks } = require('./lib/render');
const { walk } = require('./lib/tree');

const args = process.argv.slice(2);
let port = 7070;
let targetDir = process.cwd();

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--port' || a === '-p') {
    port = Number(args[++i]) || port;
  } else if (a === '--help' || a === '-h') {
    console.log('Usage: markserv-diff [dir] [--port N]');
    process.exit(0);
  } else if (!a.startsWith('-')) {
    targetDir = path.resolve(a);
  }
}

if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`Not a directory: ${targetDir}`);
  process.exit(1);
}

const sseClients = new Set();

function broadcastReload() {
  for (const res of sseClients) {
    try {
      res.write('event: reload\ndata: 1\n\n');
    } catch {
      sseClients.delete(res);
    }
  }
}

function safeJoin(base, rel) {
  const target = path.resolve(base, rel);
  if (!target.startsWith(path.resolve(base) + path.sep) && target !== path.resolve(base)) {
    return null;
  }
  return target;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTree(node, activeRelPath, changedByPath) {
  if (!node.children || node.children.length === 0) return '';
  const items = node.children
    .map((child) => {
      if (child.children) {
        const inner = renderTree(child, activeRelPath, changedByPath);
        return `<li class="folder">${escapeHtml(child.name)}${inner}</li>`;
      }
      const isActive = child.relPath === activeRelPath;
      const status = changedByPath.get(child.relPath);
      const dot = status ? `<span class="status-dot status-${status}" title="${status}"></span>` : '';
      return `<li><a href="/file/${encodeURI(child.relPath)}" class="${isActive ? 'active' : ''}">${dot}${escapeHtml(child.name)}</a></li>`;
    })
    .join('');
  return `<ul>${items}</ul>`;
}

function layout({ title, sidebar, main }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/static/styles.css" />
</head>
<body>
<div class="layout">
  <aside class="sidebar">${sidebar}</aside>
  <main class="main">${main}</main>
</div>
<script src="/static/client.js"></script>
</body>
</html>`;
}

function tabs(relPath, mode) {
  const link = (m, label) => {
    const active = m === mode ? 'active' : '';
    const href = m === 'view' ? `/file/${encodeURI(relPath)}` : `/diff/${encodeURI(relPath)}?base=${m === 'diff-head' ? 'head' : 'main'}`;
    return `<a class="${active}" href="${href}">${label}</a>`;
  };
  return `<div class="tabs">${link('view', 'View')}${link('diff-head', 'Diff vs HEAD')}${link('diff-main', 'Diff vs main')}</div>`;
}

async function buildSidebar(activeRelPath, changedByPath) {
  const tree = await walk(targetDir);
  return `<div class="brand">markserv<strong>·diff</strong></div><nav class="tree">${renderTree(tree, activeRelPath, changedByPath)}</nav>`;
}

async function getChangedMap(root, base) {
  if (!root) return new Map();
  try {
    const branch = base === 'main' ? await git.defaultBranch(root) : 'HEAD';
    const entries = await git.changedFiles(root, branch);
    const m = new Map();
    for (const e of entries) {
      const rel = path.relative(targetDir, path.join(root, e.path));
      m.set(rel, e.status);
    }
    return m;
  } catch {
    return new Map();
  }
}

async function handleFile(req, res, relPath) {
  const abs = safeJoin(targetDir, relPath);
  if (!abs || !fs.existsSync(abs)) return notFound(res);

  const text = await fsp.readFile(abs, 'utf8');
  const html = renderMarkdown(text);
  const root = await git.repoRoot(targetDir);
  const changed = await getChangedMap(root, 'head');
  const sidebar = await buildSidebar(relPath, changed);
  const main = `
    <div class="toolbar">
      <h1><span class="file-path">${escapeHtml(relPath)}</span></h1>
      ${tabs(relPath, 'view')}
    </div>
    <article class="content">${html}</article>`;
  send(res, 200, 'text/html; charset=utf-8', layout({ title: relPath, sidebar, main }));
}

async function handleDiff(req, res, relPath, base) {
  const abs = safeJoin(targetDir, relPath);
  if (!abs) return notFound(res);

  const root = await git.repoRoot(targetDir);
  if (!root) return send(res, 400, 'text/plain', 'Not a git repository.');

  const branch = base === 'main' ? await git.defaultBranch(root) : 'HEAD';
  const repoRelPath = git.repoRelative(root, abs);
  const oldText = await git.showAt(root, branch, repoRelPath);
  const newText = fs.existsSync(abs) ? await fsp.readFile(abs, 'utf8') : null;

  const oldExists = oldText !== null;
  const newExists = newText !== null;

  let main;
  if (!oldExists && !newExists) {
    return notFound(res);
  } else if (!oldExists) {
    main = `<div class="summary"><span>Status: <strong>Added</strong></span><span>Base: <strong>${escapeHtml(branch)}</strong></span></div>
      <div class="block block-added"><span class="badge badge-add">New file</span>${renderMarkdown(newText)}</div>`;
  } else if (!newExists) {
    main = `<div class="summary"><span>Status: <strong>Deleted</strong></span><span>Base: <strong>${escapeHtml(branch)}</strong></span></div>
      <div class="block block-removed"><span class="badge badge-del">Deleted</span>${renderMarkdown(oldText)}</div>`;
  } else if (oldText === newText) {
    main = `<div class="summary"><span>No changes vs <strong>${escapeHtml(branch)}</strong></span></div>
      <article class="content">${renderMarkdown(newText)}</article>`;
  } else {
    const blocks = buildBlocks(oldText, newText);
    const counts = blocks.reduce(
      (acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
      },
      { added: 0, removed: 0, modified: 0, unchanged: 0 },
    );
    main = `<div class="summary">
        <span>Base: <strong>${escapeHtml(branch)}</strong></span>
        <span>Added: <strong>${counts.added}</strong></span>
        <span>Modified: <strong>${counts.modified}</strong></span>
        <span>Removed: <strong>${counts.removed}</strong></span>
      </div>
      <div class="content">${renderBlocks(blocks)}</div>`;
  }

  const changed = await getChangedMap(root, base);
  const sidebar = await buildSidebar(relPath, changed);
  const toolbar = `
    <div class="toolbar">
      <h1><span class="file-path">${escapeHtml(relPath)}</span></h1>
      ${tabs(relPath, base === 'main' ? 'diff-main' : 'diff-head')}
    </div>`;
  send(res, 200, 'text/html; charset=utf-8', layout({ title: `diff: ${relPath}`, sidebar, main: toolbar + main }));
}

async function handleIndex(req, res) {
  const root = await git.repoRoot(targetDir);
  const changed = await getChangedMap(root, 'head');
  const tree = await walk(targetDir);
  const firstFile = findFirstFile(tree);
  if (firstFile) {
    res.writeHead(302, { Location: `/file/${encodeURI(firstFile)}` });
    return res.end();
  }
  const sidebar = await buildSidebar(null, changed);
  send(
    res,
    200,
    'text/html; charset=utf-8',
    layout({ title: 'markserv-diff', sidebar, main: '<div class="empty">No markdown files found in this directory.</div>' }),
  );
}

function findFirstFile(node) {
  for (const child of node.children || []) {
    if (child.children) {
      const found = findFirstFile(child);
      if (found) return found;
    } else {
      return child.relPath;
    }
  }
  return null;
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function notFound(res) {
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
}

function serveStatic(req, res, rel) {
  const filePath = path.join(__dirname, 'public', rel);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) return notFound(res);
  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    const type = rel.endsWith('.css') ? 'text/css' : rel.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    send(res, 200, type, data);
  });
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(parsed.pathname || '/');

    if (pathname === '/favicon.ico') return send(res, 204, 'text/plain', '');
    if (pathname === '/events') return handleSSE(req, res);
    if (pathname.startsWith('/static/')) return serveStatic(req, res, pathname.slice('/static/'.length));
    if (pathname === '/') return handleIndex(req, res);

    if (pathname.startsWith('/file/')) {
      const rel = pathname.slice('/file/'.length);
      return handleFile(req, res, rel);
    }
    if (pathname.startsWith('/diff/')) {
      const rel = pathname.slice('/diff/'.length);
      const base = parsed.searchParams.get('base') === 'main' ? 'main' : 'head';
      return handleDiff(req, res, rel, base);
    }

    notFound(res);
  } catch (err) {
    console.error(err);
    send(res, 500, 'text/plain', `Server error: ${err.message}`);
  }
});

const watchers = new Set();
function watchDir(dir) {
  try {
    const w = fs.watch(dir, { recursive: true }, () => broadcastReload());
    watchers.add(w);
  } catch (err) {
    console.warn(`Watch failed for ${dir}: ${err.message}`);
  }
}

watchDir(targetDir);

server.listen(port, () => {
  console.log(`markserv-diff: serving ${targetDir}`);
  console.log(`  http://localhost:${port}`);
});

process.on('SIGINT', () => {
  for (const w of watchers) w.close();
  for (const r of sseClients) r.end();
  server.close(() => process.exit(0));
});
