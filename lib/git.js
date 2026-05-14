'use strict';

const { execFile } = require('node:child_process');
const path = require('node:path');

function run(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

async function repoRoot(dir) {
  try {
    const out = await run(dir, ['rev-parse', '--show-toplevel']);
    return out.trim();
  } catch {
    return null;
  }
}

async function showAt(root, ref, relPath) {
  try {
    return await run(root, ['show', `${ref}:${relPath}`]);
  } catch (err) {
    if (/exists on disk, but not in/i.test(err.stderr || '') || /does not exist/i.test(err.stderr || '')) {
      return null;
    }
    throw err;
  }
}

async function defaultBranch(root) {
  try {
    const out = await run(root, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
    return out.trim().replace(/^refs\/remotes\//, '');
  } catch {
    return 'origin/main';
  }
}

async function changedFiles(root, base) {
  const out = await run(root, ['diff', '--name-status', '-z', base, '--']);
  const tokens = out.split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < tokens.length; i++) {
    const status = tokens[i];
    const file = tokens[++i];
    if (!file) continue;
    entries.push({ status: status[0], path: file });
  }
  return entries;
}

function resolveBase(base, branch) {
  if (base === 'head') return 'HEAD';
  if (base === 'main') return branch;
  return 'HEAD';
}

function repoRelative(root, absPath) {
  return path.relative(root, absPath);
}

module.exports = {
  repoRoot,
  showAt,
  defaultBranch,
  changedFiles,
  resolveBase,
  repoRelative,
};
