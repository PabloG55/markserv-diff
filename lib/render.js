'use strict';

const MarkdownIt = require('markdown-it');
const { diffWordsWithSpace } = require('diff');

const ADD_START = '';
const ADD_END = '';
const DEL_START = '';
const DEL_END = '';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

function renderMarkdown(text) {
  return md.render(text || '');
}

function parseRowCells(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  const cells = [];
  let current = '';
  let escaped = false;
  for (const ch of trimmed) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function renderInline(text) {
  return md.renderInline(text || '');
}

function buildMarkedDiff(before, after) {
  const parts = diffWordsWithSpace(before || '', after || '');
  let merged = '';
  for (const p of parts) {
    if (p.added) merged += ADD_START + p.value + ADD_END;
    else if (p.removed) merged += DEL_START + p.value + DEL_END;
    else merged += p.value;
  }
  return { merged, parts };
}

function similarityFromParts(parts) {
  let unchanged = 0;
  let total = 0;
  for (const p of parts) {
    total += p.value.length;
    if (!p.added && !p.removed) unchanged += p.value.length;
  }
  return total === 0 ? 1 : unchanged / total;
}

function applyDiffMarkers(html) {
  return html
    .split(ADD_START).join('<ins class="word-add">')
    .split(ADD_END).join('</ins>')
    .split(DEL_START).join('<del class="word-del">')
    .split(DEL_END).join('</del>');
}

function renderInlineDiff(before, after) {
  const { merged, parts } = buildMarkedDiff(before, after);
  const similarity = similarityFromParts(parts);
  if (similarity < 0.5) {
    return {
      html:
        `<div class="mod-before"><span class="badge badge-del">Old</span>${md.render(before || '')}</div>` +
        `<div class="mod-after"><span class="badge badge-add">New</span>${md.render(after || '')}</div>`,
      mode: 'stacked',
    };
  }
  return { html: applyDiffMarkers(md.render(merged)), mode: 'inline' };
}

function renderTableDiff({ header, rows }) {
  const headerCells = header[0] ? parseRowCells(header[0]) : [];
  const thead = headerCells.length
    ? `<thead><tr>${headerCells.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr></thead>`
    : '';
  const tbody = rows
    .map((r) => {
      const cells = parseRowCells(r.line);
      const cls = r.status === 'added' ? 'row-added' : r.status === 'removed' ? 'row-removed' : '';
      const tds = cells.map((c) => `<td>${renderInline(c)}</td>`).join('');
      return `<tr class="${cls}">${tds}</tr>`;
    })
    .join('');
  return `<table class="diff-table">${thead}<tbody>${tbody}</tbody></table>`;
}

function renderBlocks(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'unchanged') {
      parts.push(`<div class="block block-unchanged">${renderMarkdown(block.text)}</div>`);
    } else if (block.type === 'added') {
      parts.push(
        `<div class="block block-added"><span class="badge badge-add">Added</span>${renderMarkdown(block.text)}</div>`,
      );
    } else if (block.type === 'removed') {
      parts.push(
        `<div class="block block-removed"><span class="badge badge-del">Removed</span>${renderMarkdown(block.text)}</div>`,
      );
    } else if (block.type === 'modified') {
      const { html, mode } = renderInlineDiff(block.before, block.after);
      parts.push(`<div class="block block-modified block-modified-${mode}">${html}</div>`);
    } else if (block.type === 'table-modified') {
      parts.push(`<div class="block block-table-modified">${renderTableDiff(block)}</div>`);
    }
  }
  return parts.join('\n');
}

module.exports = { renderMarkdown, renderBlocks };
