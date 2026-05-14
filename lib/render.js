'use strict';

const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

function renderMarkdown(text) {
  return md.render(text || '');
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
      parts.push(
        `<div class="block block-modified">` +
          `<div class="mod-before"><span class="badge badge-del">Old</span>${renderMarkdown(block.before)}</div>` +
          `<div class="mod-after"><span class="badge badge-add">New</span>${renderMarkdown(block.after)}</div>` +
          `</div>`,
      );
    }
  }
  return parts.join('\n');
}

module.exports = { renderMarkdown, renderBlocks };
