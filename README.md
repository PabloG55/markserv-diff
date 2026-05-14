# markserv-diff

Browse local markdown docs in the browser with rendered git diffs. Inspired by [markserv](https://github.com/markserv/markserv) but with a diff view as the core feature — and only two npm dependencies for a smaller supply-chain surface.

## What it does

- File tree sidebar of all `.md` files under a directory
- GitHub-style rendering of each file
- Three tabs per file: **View**, **Diff vs HEAD**, **Diff vs main**
- Paragraph-level diff: modified paragraphs show stacked old (red strikethrough) / new (green); added paragraphs in green; deleted paragraphs in red
- Live reload via Server-Sent Events when files change
- Status dots in the sidebar mark files with uncommitted changes

## Why

For docs-driven workflows where you write specs before code, raw `git diff` output is hard to read. Seeing the rendered spec as it will read, with the changes highlighted, makes review much faster.

## Install

```bash
cd ~/tools/markserv-diff
npm install --ignore-scripts
```

`--ignore-scripts` is used as a supply-chain precaution — postinstall hooks are the most common malware vector. Both deps (`markdown-it`, `diff`) work fine without scripts.

## Run

```bash
node server.js /path/to/docs --port 7070
```

Open http://localhost:7070 in Chrome.

## Dependencies

| Package | Why | Version |
|---|---|---|
| markdown-it | GitHub-style markdown rendering | 14.1.1 |
| diff (jsdiff) | Paragraph-level diff algorithm | 5.2.2 |

Total tree: 8 packages, 0 vulnerabilities (`npm audit`).
