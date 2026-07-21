# 中文写字练习 — Chinese Handwriting Practice Generator

A local, static website for generating printable Chinese handwriting practice
sheets (田字格/米字格/回宫格 tracing grids) with pinyin or zhuyin (bopomofo),
editable English meanings, simplified/traditional toggle, optional stroke-order
diagrams, and one-click PDF export.

## Running it

This page uses `fetch()` to load JSON data files, which browsers block from
`file://` due to CORS. Serve the folder with any static file server, e.g.:

```
python -m http.server 8080
```

then open `http://localhost:8080/index.html`.

(Or use `npx serve .`, VS Code's "Live Server" extension, etc.)

An internet connection is required the first time each character is used,
since stroke-order path data is fetched on demand from the `hanzi-writer-data`
CDN (jsdelivr).

## Deploying updates

`app.js`, `style.css`, `bopomofo.js`, `showcase.js`, and `landing.css` are
referenced with a `?v=N` cache-busting query string from `generator.html` and
`index.html`. GitHub Pages serves these with long cache lifetimes, so without
a version bump, browsers (including your own, mid-testing) can keep running a
stale cached copy of the JS/CSS even after a fresh deploy — the page looks
unchanged even though the server has the new file. **Bump every `?v=N` by one
whenever you push a change to any of those files.**

## How to use it

1. Type one word/phrase per line (or separate several with spaces/punctuation
   on one line) into the input box, then click **添加 / Add**. Each line
   becomes one practice entry that's traced as a whole — e.g. put a 4-character
   phrase like `该起床了` on its own line to practice it as a unit, or put a
   single character on its own line to drill it individually. Duplicates are
   skipped automatically.
2. Each entry is added to the word list with auto-filled pinyin per character
   — edit the pinyin field (space-separated per character) or the meaning
   field freely. Meanings only auto-fill for single-character entries; add
   your own for multi-character words.
3. Adjust settings:
   - **Script**: Simplified ↔ Traditional (converts all current entries and
     future input using OpenCC's character-level mapping).
   - **Phonetic**: Pinyin, Zhuyin (注音/bopomofo), or both stacked.
   - Page size, grid style (田字格/米字格/回宫格/plain), cell size.
   - **Trace shade**: uniform light gray (matches typical school worksheets)
     or a fading gradient across repetitions.
   - How many solid "model" copies, traced copies, and blank practice copies
     per word.
   - Optional stroke-order build-up diagram (single characters only).
4. The preview updates live, paginated exactly as the PDF will look. Click
   **生成 PDF 下载 / Generate & Download PDF** to save it.

## Known limitation

Simplified/Traditional conversion is character-level (via OpenCC's static
mapping), not phrase-aware — it occasionally picks a more formal/rare
traditional variant (e.g. 床→牀) where a common alternate form exists. Edit
the word list entry directly if you want a different variant.

## Data & credits

- Character stroke data and the pinyin/definition dictionary are derived from
  the [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) project.
  - `data/hanzi-dict.json` (pinyin + English definitions) is built from
    `dictionary.txt`, sourced from Unihan and CJKlib, licensed **LGPL v3+**.
  - Stroke shapes (fetched at runtime from the `hanzi-writer-data` CDN) are
    derived from the Arphic PL KaitiM GB font, licensed under the
    **Arphic Public License**.
- Simplified ↔ Traditional character mapping (`data/s2t.json`, `data/t2s.json`)
  is built from [OpenCC](https://github.com/BYVoid/OpenCC)'s
  `STCharacters.txt` / `TSCharacters.txt`, licensed **Apache-2.0**.
- Pinyin → Zhuyin (bopomofo) conversion (`bopomofo.js`) is an original
  rule-based implementation (initial/final decomposition), not a third-party
  data set.
- Rendering uses [Hanzi Writer](https://hanziwriter.org) (MIT), vendored in
  `vendor/hanzi-writer.min.js`.
- PDF export uses [jsPDF](https://github.com/parallax/jsPDF) and
  [html2canvas](https://html2canvas.hertzen.com/), vendored in `vendor/`.

If you redistribute this project, keep this credits section and the license
notices for the above.
