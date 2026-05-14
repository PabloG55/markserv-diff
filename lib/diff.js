'use strict';

const { diffArrays } = require('diff');

function isTable(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  const first = lines[0].trim();
  const second = lines[1].trim();
  if (!first.startsWith('|') || !first.endsWith('|')) return false;
  if (!/^\|[\s:|-]+\|$/.test(second)) return false;
  return true;
}

function diffTableRows(beforeText, afterText) {
  const beforeLines = beforeText.split('\n');
  const afterLines = afterText.split('\n');
  const headerSource = afterLines.length >= 2 ? afterLines : beforeLines;
  const header = headerSource.slice(0, 2);
  const beforeBody = beforeLines.slice(2).filter((l) => l.trim().length > 0);
  const afterBody = afterLines.slice(2).filter((l) => l.trim().length > 0);
  const parts = diffArrays(beforeBody, afterBody);
  const rows = [];
  for (const part of parts) {
    const status = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
    for (const line of part.value) rows.push({ status, line });
  }
  return { header, rows };
}

function splitBlocks(text) {
  if (text == null) return [];
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+$/, ''))
    .filter((block) => block.length > 0);
}

function buildBlocks(oldText, newText) {
  const oldBlocks = splitBlocks(oldText);
  const newBlocks = splitBlocks(newText);
  const parts = diffArrays(oldBlocks, newBlocks);

  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];

    if (part.removed && next && next.added) {
      const removed = part.value;
      const added = next.value;
      const pairs = Math.max(removed.length, added.length);
      for (let j = 0; j < pairs; j++) {
        const before = removed[j];
        const after = added[j];
        if (before != null && after != null) {
          if (isTable(before) && isTable(after)) {
            result.push({ type: 'table-modified', ...diffTableRows(before, after) });
          } else {
            result.push({ type: 'modified', before, after });
          }
        } else if (before != null) {
          result.push({ type: 'removed', text: before });
        } else if (after != null) {
          result.push({ type: 'added', text: after });
        }
      }
      i += 1;
      continue;
    }

    if (part.removed) {
      for (const block of part.value) result.push({ type: 'removed', text: block });
    } else if (part.added) {
      for (const block of part.value) result.push({ type: 'added', text: block });
    } else {
      for (const block of part.value) result.push({ type: 'unchanged', text: block });
    }
  }
  return result;
}

module.exports = { buildBlocks, splitBlocks, isTable, diffTableRows };
