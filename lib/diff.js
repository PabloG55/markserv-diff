'use strict';

const { diffArrays } = require('diff');

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
          result.push({ type: 'modified', before, after });
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

module.exports = { buildBlocks, splitBlocks };
