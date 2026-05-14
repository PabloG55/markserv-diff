'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const MARKDOWN_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const IGNORED = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.cache']);

async function walk(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (IGNORED.has(entry.name)) continue;
    const abs = path.join(current, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(root, abs);
      if (sub.children.length > 0) dirs.push(sub);
    } else if (entry.isFile() && MARKDOWN_EXT.has(path.extname(entry.name).toLowerCase())) {
      files.push({ name: entry.name, relPath: path.relative(root, abs) });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    name: path.basename(current),
    relPath: path.relative(root, current),
    children: [...dirs, ...files],
  };
}

module.exports = { walk };
