# markserv-diff

Browse local Markdown docs in the browser, with **rendered git diffs**. Built for docs-driven workflows where you want to see what your spec will *read like* — not what the raw `+`/`-` lines say.

Inspired by [markserv](https://github.com/markserv/markserv), but with a diff view as the headline feature and a deliberately minimal dependency tree.

## Why

`git diff` shows raw text. GitHub's PR view is great but requires pushing first. Tools like `diff2html` render diffs nicely but lose the rendered Markdown context. `markserv-diff` renders the Markdown as it will appear *and* shows the changes inline, so a spec review feels like reading the document with edits highlighted instead of reading a code diff.

## Features

- 📁 File-tree sidebar of every `.md` file in a directory
- ✨ GitHub-style Markdown rendering
- 🔀 Three view modes per file:
  - **View** — plain rendered Markdown
  - **Diff vs HEAD** — uncommitted changes in your working tree
  - **Diff vs main** — everything different on the current branch
- 🧠 Adaptive diff strategy per block:
  - Small edits → inline word-level diff (red strikethrough for removed words, green for added)
  - Heavy rewrites → stacked old / new (so it stays readable)
  - Modified tables → single table with row-level highlights (no more "added one row = doubled table")
- 🗺️ Right-side **minimap** showing the position of every change in the document — click a tick to jump
- 🟢🔴🟠 Status dots in the sidebar mark files with uncommitted changes (added / modified / deleted)
- ♻️ Live reload via Server-Sent Events when files change on disk
- 🔒 Only two npm dependencies, installed with `--ignore-scripts` for a small supply-chain footprint

## Install

```bash
git clone https://github.com/PabloG55/markserv-diff.git
cd markserv-diff
npm install --ignore-scripts
```

The `--ignore-scripts` flag blocks any postinstall hooks — the single most common npm supply-chain attack vector. Both runtime dependencies (`markdown-it` and `diff`) work without any install scripts.

## Run

```bash
node server.js /path/to/your/docs --port 7070
```

Then open <http://localhost:7070>.

The URL auto-redirects to the first file's diff view. From there, the sidebar respects whichever mode you're in — clicking a file from a diff page keeps you on diff pages; clicking from a view page keeps you in view mode.

## Dependencies

| Package | Why | Version |
| --- | --- | --- |
| [`markdown-it`](https://github.com/markdown-it/markdown-it) | GitHub-style Markdown rendering | `14.1.1` |
| [`diff`](https://github.com/kpdecker/jsdiff) (jsdiff) | Paragraph-, row- and word-level diff algorithms | `5.2.2` |

Eight total packages including transitive deps. `npm audit` reports zero vulnerabilities.

## How the diff works

1. The working-tree file is read from disk; the comparison version is fetched with `git show <ref>:<path>`.
2. Both versions are split into blocks by blank lines (Markdown's natural paragraph boundary).
3. `diffArrays` aligns the block lists. Aligned removed + added blocks become a **modified** block.
4. For each modified block:
   - If both versions are Markdown tables → row-level diff, rendered as one table with row classes.
   - Otherwise → word-level diff with `diffWordsWithSpace`. Unicode private-use markers are injected around added/removed words, then survived through Markdown rendering and replaced with `<ins>` / `<del>` tags.
   - If the resulting word-level diff has <50% character similarity (i.e., it's basically a rewrite), the block falls back to a stacked "Old" / "New" view because inline noise becomes unreadable.
5. A right-side minimap scans the rendered DOM for `.block-added`, `.block-removed`, `.block-modified`, `tr.row-added`, and `tr.row-removed`, placing colored ticks proportional to scroll position.

## License

MIT — see [LICENSE](LICENSE).
