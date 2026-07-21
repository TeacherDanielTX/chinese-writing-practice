(function () {
  "use strict";

  const MM_PX = 96 / 25.4; // css px per mm at 96dpi
  const PAGE_MM = {
    a4: { w: 210, h: 297 },
    letter: { w: 215.9, h: 279.4 },
  };
  const MARGIN_MM = 14;
  const PINYIN_GRID_MM = 8;    // ruled four-line pinyin box height, above the character
  const ZHUYIN_WIDTH_FACTOR = 1 / 3; // zhuyin box width, as a fraction of the character cell (height matches the character cell)
  const LABEL_MM = 6.5;   // entry word+meaning label height
  const LABEL_GAP_MM = 2; // breathing room between the label and the grid below it
  const STROKE_MM = 9;    // stroke-order strip height
  const LINE_GAP_MM = 2.5;
  const ENTRY_GAP_MM = 5;
  const HEADER_TITLE_MM = 7;   // header title line height, when shown
  const HEADER_ND_MM = 6;      // name/date line height, when shown
  const HEADER_GAP_MM = 4;     // gap between header and the page content below it
  const FOOTER_MM = 6;         // footer strip height, when shown
  const FOOTER_GAP_MM = 3;     // gap between page content and the footer above it
  const BASE = 100;       // fixed internal coordinate space for cached char svg paths
  const CHAR_RE_RUN = /[㐀-䶿一-鿿豈-﫿]+/g;

  let dict = {};
  let s2t = {};
  let t2s = {};
  const entries = []; // { text, chars:[], pinyins:[], meaning }
  const strokeCache = new Map(); // ch -> {strokes:[...]} | null

  const els = {
    textInput: document.getElementById("textInput"),
    addBtn: document.getElementById("addCharsBtn"),
    clearBtn: document.getElementById("clearAllBtn"),
    tableBody: document.getElementById("charTableBody"),
    emptyState: document.getElementById("emptyState"),
    scriptMode: document.getElementById("scriptMode"),
    phoneticMode: document.getElementById("phoneticMode"),
    pageSize: document.getElementById("pageSize"),
    gridStyle: document.getElementById("gridStyle"),
    cellSize: document.getElementById("cellSize"),
    traceStyle: document.getElementById("traceStyle"),
    repModel: document.getElementById("repModel"),
    repTrace: document.getElementById("repTrace"),
    repBlank: document.getElementById("repBlank"),
    showMeaning: document.getElementById("showMeaning"),
    showStrokeOrder: document.getElementById("showStrokeOrder"),
    headerTitle: document.getElementById("headerTitle"),
    showNameDate: document.getElementById("showNameDate"),
    showPageNum: document.getElementById("showPageNum"),
    footerText: document.getElementById("footerText"),
    generateBtn: document.getElementById("generatePdfBtn"),
    statusMsg: document.getElementById("statusMsg"),
    pagesContainer: document.getElementById("pagesContainer"),
  };

  Promise.all([
    fetch("data/hanzi-dict.json").then((r) => r.json()).catch(() => ({})),
    fetch("data/s2t.json").then((r) => r.json()).catch(() => ({})),
    fetch("data/t2s.json").then((r) => r.json()).catch(() => ({})),
  ]).then(([d, s2tData, t2sData]) => {
    dict = d;
    s2t = s2tData;
    t2s = t2sData;
    // Populate from any default/pre-filled textarea content (e.g. the sample
    // words shipped in the page) now that dictionary lookups will work.
    syncEntriesFromTextarea();
  });

  function getSettings() {
    return {
      script: els.scriptMode.value,
      phonetic: els.phoneticMode.value,
      pageSize: els.pageSize.value,
      gridStyle: els.gridStyle.value,
      cellSizeMM: clampNum(els.cellSize.value, 12, 40, 20),
      traceStyle: els.traceStyle.value,
      repModel: clampNum(els.repModel.value, 0, 5, 0),
      repTrace: clampNum(els.repTrace.value, 0, 16, 10),
      repBlank: clampNum(els.repBlank.value, 0, 16, 0),
      showMeaning: els.showMeaning.checked,
      showStrokeOrder: els.showStrokeOrder.checked,
      headerTitle: els.headerTitle.value.trim(),
      showNameDate: els.showNameDate.checked,
      showPageNum: els.showPageNum.checked,
      footerText: els.footerText.value.trim(),
    };
  }

  function clampNum(v, min, max, fallback) {
    const n = parseFloat(v);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function convertScript(ch, script) {
    if (script === "traditional") return s2t[ch] || ch;
    if (script === "simplified") return t2s[ch] || ch;
    return ch;
  }

  function lookupChar(ch) {
    const e = dict[ch];
    return {
      pinyin: e && e.p && e.p.length ? e.p[0] : "",
      meaning: e && e.d ? e.d : "",
    };
  }

  // ---------- word/entry list management ----------
  // The textarea is the source of truth: its content is parsed into entries
  // every time it changes, reusing existing entry objects (by word text) so
  // manual pinyin/meaning edits survive re-syncs. Clearing the textarea (or
  // deleting a word from it) removes the matching entry from the list.

  function syncEntriesFromTextarea() {
    const text = els.textInput.value || "";
    const script = getSettings().script;
    const lines = text.split(/\n/);
    const runs = [];
    lines.forEach((line) => {
      const m = line.match(CHAR_RE_RUN);
      if (m) runs.push(...m);
    });

    const oldByText = new Map(entries.map((e) => [e.text, e]));
    const seen = new Set();
    const newEntries = [];
    runs.forEach((run) => {
      const chars = Array.from(run).map((ch) => convertScript(ch, script));
      const convertedText = chars.join("");
      if (seen.has(convertedText)) return;
      seen.add(convertedText);
      const existing = oldByText.get(convertedText);
      if (existing) {
        newEntries.push(existing);
        return;
      }
      const pinyins = chars.map((ch) => lookupChar(ch).pinyin);
      const meaning = chars.length === 1 ? lookupChar(chars[0]).meaning : "";
      newEntries.push({ text: convertedText, chars, pinyins, meaning });
    });

    entries.length = 0;
    entries.push(...newEntries);
    renderTable();
    scheduleRender();
  }

  let syncTimer = null;
  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncEntriesFromTextarea, 350);
  }

  function setTextareaFromEntries() {
    els.textInput.value = entries.map((e) => e.text).join("\n");
  }

  function removeEntry(index) {
    entries.splice(index, 1);
    setTextareaFromEntries();
    renderTable();
    scheduleRender();
  }

  function clearAll() {
    entries.length = 0;
    els.textInput.value = "";
    renderTable();
    scheduleRender();
  }

  function convertAllEntriesScript(script) {
    entries.forEach((entry) => {
      const newChars = entry.chars.map((ch) => convertScript(ch, script));
      entry.chars = newChars;
      entry.text = newChars.join("");
      entry.pinyins = newChars.map((ch) => lookupChar(ch).pinyin);
    });
    setTextareaFromEntries();
    renderTable();
  }

  function renderTable() {
    els.tableBody.innerHTML = "";
    els.emptyState.style.display = entries.length ? "none" : "block";
    entries.forEach((entry, i) => {
      const tr = document.createElement("tr");

      const tdCh = document.createElement("td");
      tdCh.className = "ch";
      tdCh.textContent = entry.text;
      tr.appendChild(tdCh);

      const tdPinyin = document.createElement("td");
      const pinyinInput = document.createElement("input");
      pinyinInput.type = "text";
      pinyinInput.value = entry.pinyins.join(" ");
      pinyinInput.addEventListener("input", () => {
        const toks = pinyinInput.value.trim().split(/\s+/);
        entry.pinyins = entry.chars.map((_, idx) => toks[idx] || entry.pinyins[idx] || "");
        scheduleRender();
      });
      tdPinyin.appendChild(pinyinInput);
      tr.appendChild(tdPinyin);

      const tdMeaning = document.createElement("td");
      const meaningInput = document.createElement("input");
      meaningInput.type = "text";
      meaningInput.value = entry.meaning;
      meaningInput.placeholder = "add meaning...";
      meaningInput.addEventListener("input", () => {
        entry.meaning = meaningInput.value;
        scheduleRender();
      });
      tdMeaning.appendChild(meaningInput);
      tr.appendChild(tdMeaning);

      const tdDel = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "del-btn";
      delBtn.textContent = "✕";
      delBtn.title = "Remove";
      delBtn.addEventListener("click", () => removeEntry(i));
      tdDel.appendChild(delBtn);
      tr.appendChild(tdDel);

      els.tableBody.appendChild(tr);
    });
  }

  // ---------- grid background (CSS data-uri) ----------

  const gridUriCache = new Map();

  function gridBackgroundUri(style) {
    if (gridUriCache.has(style)) return gridUriCache.get(style);
    const s = 100;
    const stroke = "#c9c0b0";
    const border = "#9b9182";
    let inner = "";
    if (style === "tian") {
      inner =
        `<line x1="${s/2}" y1="0" x2="${s/2}" y2="${s}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>` +
        `<line x1="0" y1="${s/2}" x2="${s}" y2="${s/2}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>`;
    } else if (style === "mi") {
      inner =
        `<line x1="${s/2}" y1="0" x2="${s/2}" y2="${s}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>` +
        `<line x1="0" y1="${s/2}" x2="${s}" y2="${s/2}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>` +
        `<line x1="0" y1="0" x2="${s}" y2="${s}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>` +
        `<line x1="${s}" y1="0" x2="0" y2="${s}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>`;
    } else if (style === "hui") {
      const inset = s * 0.24;
      inner =
        `<rect x="${inset}" y="${inset}" width="${s-2*inset}" height="${s-2*inset}" fill="none" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>` +
        `<line x1="${s/2}" y1="0" x2="${s/2}" y2="${s}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>` +
        `<line x1="0" y1="${s/2}" x2="${s}" y2="${s/2}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">` +
      `<rect x="0.5" y="0.5" width="${s-1}" height="${s-1}" fill="#fffdf9" stroke="${border}" stroke-width="1.4"/>` +
      inner +
      `</svg>`;
    const uri = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    gridUriCache.set(style, uri);
    return uri;
  }

  // Ruled "four-line-three-row" (四线三格) box used for pinyin, matching how
  // Chinese pinyin is taught to be written: a shorter top band (ascenders/tone
  // marks), a taller middle band (main letter body), and a shorter bottom
  // band (descenders).
  // The viewBox width stays on the SAME 100-units-per-cellPx convention as
  // the character grid box (pinyin box width always equals cellPx), so the
  // border strokes render at matching, correctly-proportioned thickness at
  // any cell size. heightFactor = pinyinGridPx / cellPx sets the viewBox
  // height so the aspect ratio always matches the box's real shape —
  // otherwise background-size:100% 100% distorts the border into a
  // near-invisible hairline (this was the actual bug).
  let pinyinGridUriCache = null;
  let pinyinGridUriCacheFactor = null;
  function pinyinGridUri(heightFactor) {
    if (pinyinGridUriCache && pinyinGridUriCacheFactor === heightFactor) return pinyinGridUriCache;
    const w = 100;
    const h = w * heightFactor;
    const border = "#9b9182";
    const guide = "#c9c0b0";
    const y2 = h * 0.32;
    const y3 = h * 0.68;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
      `<rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" fill="#fffdf9" stroke="${border}" stroke-width="1.4"/>` +
      `<line x1="0" y1="${y2}" x2="${w}" y2="${y2}" stroke="${guide}" stroke-width="1" stroke-dasharray="4,3"/>` +
      `<line x1="0" y1="${y3}" x2="${w}" y2="${y3}" stroke="${guide}" stroke-width="1" stroke-dasharray="4,3"/>` +
      `</svg>`;
    pinyinGridUriCache = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    pinyinGridUriCacheFactor = heightFactor;
    return pinyinGridUriCache;
  }

  // Narrow ruled box for zhuyin, placed to the right of the character (as in
  // Taiwanese 生字簿 practice books), with a center guide for the vertical stack.
  // The SVG's viewBox aspect ratio must match the box's actual aspect ratio
  // (width:height = widthFactor:1) — otherwise background-size:100% 100%
  // stretches it non-uniformly and the border becomes a sub-pixel hairline
  // on the narrow sides.
  let zhuyinBoxUriCache = null;
  let zhuyinBoxUriCacheFactor = null;
  function zhuyinBoxUri(widthFactor) {
    if (zhuyinBoxUriCache && zhuyinBoxUriCacheFactor === widthFactor) return zhuyinBoxUriCache;
    const w = 100;
    const h = w / widthFactor;
    const scale = 1 / widthFactor;
    const border = "#9b9182";
    const guide = "#c9c0b0";
    const strokeW = 1.4 * scale;
    const guideW = 1 * scale;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
      `<rect x="${strokeW/2}" y="${strokeW/2}" width="${w-strokeW}" height="${h-strokeW}" fill="#fffdf9" stroke="${border}" stroke-width="${strokeW}"/>` +
      `<line x1="${w/2}" y1="0" x2="${w/2}" y2="${h}" stroke="${guide}" stroke-width="${guideW}" stroke-dasharray="${4*scale},${3*scale}"/>` +
      `</svg>`;
    zhuyinBoxUriCache = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    zhuyinBoxUriCacheFactor = widthFactor;
    return zhuyinBoxUriCache;
  }

  // ---------- character stroke data (cached per char) ----------

  async function ensureStrokeData(chars) {
    const toLoad = chars.filter((ch) => !strokeCache.has(ch));
    await Promise.all(
      toLoad.map((ch) =>
        HanziWriter.loadCharacterData(ch)
          .then((data) => strokeCache.set(ch, data))
          .catch(() => strokeCache.set(ch, null))
      )
    );
  }

  const charSvgInnerCache = new Map(); // ch -> inner <g> markup string, or null

  function getCharSvgInner(ch) {
    if (charSvgInnerCache.has(ch)) return charSvgInnerCache.get(ch);
    const data = strokeCache.get(ch);
    let inner = null;
    if (data && data.strokes && data.strokes.length) {
      const padding = BASE * 0.12;
      const t = HanziWriter.getScalingTransform(BASE, BASE, padding);
      const paths = data.strokes.map((d) => `<path d="${d}" fill="#1c1a17"/>`).join("");
      inner = `<g transform="${t.transform}">${paths}</g>`;
    }
    charSvgInnerCache.set(ch, inner);
    return inner;
  }

  function buildCellSvg(ch, opacity) {
    const inner = getCharSvgInner(ch);
    if (!inner) return "";
    return `<svg viewBox="0 0 ${BASE} ${BASE}" style="opacity:${opacity}">${inner}</svg>`;
  }

  function buildStrokeOrderGlyphs(ch) {
    const data = strokeCache.get(ch);
    if (!data || !data.strokes || !data.strokes.length) return [];
    const padding = BASE * 0.12;
    const t = HanziWriter.getScalingTransform(BASE, BASE, padding);
    const glyphs = [];
    for (let i = 0; i < data.strokes.length; i++) {
      const paths = data.strokes.slice(0, i + 1).map((d) => `<path d="${d}" fill="#333"/>`).join("");
      glyphs.push(`<svg viewBox="0 0 ${BASE} ${BASE}"><g transform="${t.transform}">${paths}</g></svg>`);
    }
    return glyphs;
  }

  // ---------- slot plan ----------

  function buildSlots(settings) {
    const slots = [];
    for (let i = 0; i < settings.repModel; i++) slots.push({ opacity: 1 });
    const n = settings.repTrace;
    if (settings.traceStyle === "fade") {
      for (let i = 0; i < n; i++) {
        const t = n <= 1 ? 0.5 : i / (n - 1);
        slots.push({ opacity: Math.max(0.12, 0.55 - t * 0.4) });
      }
    } else {
      for (let i = 0; i < n; i++) slots.push({ opacity: 0.32 });
    }
    for (let i = 0; i < settings.repBlank; i++) slots.push({ opacity: 0, blank: true });
    if (slots.length === 0) slots.push({ opacity: 0, blank: true });
    return slots;
  }

  // ---------- render preview (paginated) ----------

  let renderToken = 0;

  function scheduleRender() {
    const myToken = ++renderToken;
    clearTimeout(scheduleRender._t);
    scheduleRender._t = setTimeout(() => {
      if (myToken !== renderToken) return;
      renderAll().catch((e) => console.error(e));
    }, 180);
  }

  async function renderAll() {
    const settings = getSettings();
    els.generateBtn.disabled = entries.length === 0;

    if (entries.length === 0) {
      els.pagesContainer.innerHTML = '<p class="empty-preview">添加词/字后将在此显示练习页预览。<br>Add words above to preview the practice sheet.</p>';
      return;
    }

    const allChars = new Set();
    entries.forEach((e) => e.chars.forEach((c) => allChars.add(c)));
    await ensureStrokeData(Array.from(allChars));

    const page = PAGE_MM[settings.pageSize];
    const pageWpx = page.w * MM_PX;
    const pageHpx = page.h * MM_PX;
    const marginPx = MARGIN_MM * MM_PX;
    const contentWmm = page.w - 2 * MARGIN_MM;
    const contentWpx = contentWmm * MM_PX;

    const hasHeader = !!settings.headerTitle || settings.showNameDate;
    const hasFooter = !!settings.footerText || settings.showPageNum;
    const headerPx = hasHeader
      ? ((settings.headerTitle ? HEADER_TITLE_MM * MM_PX : 0) + (settings.showNameDate ? HEADER_ND_MM * MM_PX : 0) + HEADER_GAP_MM * MM_PX)
      : 0;
    const footerPx = hasFooter ? (FOOTER_MM * MM_PX + FOOTER_GAP_MM * MM_PX) : 0;
    const contentTopPx = marginPx + headerPx;
    const contentHpx = pageHpx - contentTopPx - marginPx - footerPx;
    const cellMM = settings.cellSizeMM;
    const cellPx = cellMM * MM_PX;
    const showPinyinGrid = settings.phonetic === "pinyin" || settings.phonetic === "both";
    const showZhuyinBox = settings.phonetic === "zhuyin" || settings.phonetic === "both";
    const pinyinGridPx = PINYIN_GRID_MM * MM_PX;
    const zhuyinPx = cellPx * ZHUYIN_WIDTH_FACTOR; // 1/3 the character cell's width, same height as the cell
    const charColWidthPx = cellPx + (showZhuyinBox ? zhuyinPx : 0);
    const lineHeightPx = (showPinyinGrid ? pinyinGridPx : 0) + cellPx;
    const labelPx = LABEL_MM * MM_PX;
    const labelGapPx = LABEL_GAP_MM * MM_PX;
    const strokePx = STROKE_MM * MM_PX;
    const lineGapPx = LINE_GAP_MM * MM_PX;
    const entryGapPx = ENTRY_GAP_MM * MM_PX;

    const slots = buildSlots(settings);
    const gridUri = gridBackgroundUri(settings.gridStyle);
    const pyGridUri = pinyinGridUri(pinyinGridPx / cellPx);
    const zyBoxUri = zhuyinBoxUri(ZHUYIN_WIDTH_FACTOR);

    // Build a flat sequence of chunks (label / stroke-order / one repetition
    // row each) across all entries. Pagination splits at chunk boundaries,
    // not entry boundaries, so a word with many repetitions correctly spills
    // its extra rows onto additional pages instead of being clipped by a
    // single page's fixed height.
    const chunks = [];
    entries.forEach((entry) => {
      const numChars = entry.chars.length;
      const unitWidthPx = numChars * charColWidthPx;
      const columnsPerLine = Math.max(1, Math.floor(contentWpx / unitWidthPx));
      const linesNeeded = Math.max(1, Math.ceil(slots.length / columnsPerLine));
      const hasStrokeOrder = settings.showStrokeOrder && numChars === 1 && strokeCache.get(entry.chars[0]);
      const entryMeta = { entry, numChars, unitWidthPx, columnsPerLine };

      if (settings.showMeaning) {
        chunks.push({ kind: "label", entryMeta, contentHeightPx: labelPx, gapAfterPx: labelGapPx, heightPx: labelPx + labelGapPx });
      }
      if (hasStrokeOrder) {
        chunks.push({ kind: "strokeOrder", entryMeta, contentHeightPx: strokePx, gapAfterPx: 0, heightPx: strokePx });
      }
      for (let li = 0; li < linesNeeded; li++) {
        const lineSlots = slots.slice(li * columnsPerLine, (li + 1) * columnsPerLine);
        const isLastLine = li === linesNeeded - 1;
        const gapAfterPx = isLastLine ? entryGapPx : lineGapPx;
        chunks.push({ kind: "line", entryMeta, lineSlots, contentHeightPx: lineHeightPx, gapAfterPx, heightPx: lineHeightPx + gapAfterPx });
      }
    });

    // bucket chunks into pages
    const pages = [[]];
    let curHeight = 0;
    chunks.forEach((chunk) => {
      if (curHeight + chunk.heightPx > contentHpx && pages[pages.length - 1].length > 0) {
        pages.push([]);
        curHeight = 0;
      }
      pages[pages.length - 1].push(chunk);
      curHeight += chunk.heightPx;
    });

    // Builds one repetition column (a character, its optional pinyin box
    // above, and optional bopomofo box to the right) for a single slot.
    function buildUnitEl(entry, unitWidthPx, slot) {
      const unit = document.createElement("div");
      unit.className = "unit";
      unit.style.width = unitWidthPx + "px";

      const row = document.createElement("div");
      row.className = "unit-row";

      entry.chars.forEach((ch, ci) => {
        const col = document.createElement("div");
        col.className = "char-col";
        col.style.width = charColWidthPx + "px";

        const pinyinText = entry.pinyins[ci] || "";

        if (showPinyinGrid) {
          const pyCell = document.createElement("div");
          pyCell.className = "pinyin-cell";
          pyCell.style.width = cellPx + "px";
          pyCell.style.height = pinyinGridPx + "px";
          pyCell.style.backgroundImage = `url("${pyGridUri}")`;
          // Opacity goes on the text only, not the cell itself — the ruled
          // grid should stay fully visible on every repetition, exactly
          // like the character cell's grid never fades.
          const pyText = document.createElement("span");
          pyText.style.opacity = String(slot.opacity);
          pyText.style.fontSize = Math.round(cellPx * 0.2) + "px";
          pyText.textContent = pinyinText;
          pyCell.appendChild(pyText);
          col.appendChild(pyCell);
        }

        const charZy = document.createElement("div");
        charZy.className = "char-zhuyin-row";

        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.width = cellPx + "px";
        cell.style.height = cellPx + "px";
        cell.style.backgroundImage = `url("${gridUri}")`;
        if (!slot.blank) cell.innerHTML = buildCellSvg(ch, slot.opacity);
        charZy.appendChild(cell);

        if (showZhuyinBox) {
          const zyCell = document.createElement("div");
          zyCell.className = "zhuyin-cell";
          zyCell.style.width = zhuyinPx + "px";
          zyCell.style.height = cellPx + "px";
          zyCell.style.backgroundImage = `url("${zyBoxUri}")`;
          // Opacity goes on the text only — the box stays fully visible.
          const zy = document.createElement("span");
          zy.className = "zy-vert";
          zy.style.opacity = String(slot.opacity);
          zy.style.fontSize = Math.round(cellPx * 0.2) + "px";
          zy.textContent = pinyinText ? Bopomofo.pinyinToZhuyin(pinyinText) : "";
          zyCell.appendChild(zy);
          charZy.appendChild(zyCell);
        }

        col.appendChild(charZy);
        row.appendChild(col);
      });

      unit.appendChild(row);
      return unit;
    }

    els.pagesContainer.innerHTML = "";

    pages.forEach((pageChunks, pageIndex) => {
      const pageDiv = document.createElement("div");
      pageDiv.className = "pdf-page";
      pageDiv.style.width = pageWpx + "px";
      pageDiv.style.height = pageHpx + "px";

      if (hasHeader) {
        const header = document.createElement("div");
        header.className = "page-header";
        header.style.left = marginPx + "px";
        header.style.top = marginPx + "px";
        header.style.width = contentWpx + "px";
        header.style.height = (headerPx - HEADER_GAP_MM * MM_PX) + "px";

        if (settings.headerTitle) {
          const title = document.createElement("div");
          title.className = "page-header-title";
          title.style.fontSize = Math.round(HEADER_TITLE_MM * MM_PX * 0.62) + "px";
          title.textContent = settings.headerTitle;
          header.appendChild(title);
        }
        if (settings.showNameDate) {
          const nd = document.createElement("div");
          nd.className = "page-namedate";
          nd.style.fontSize = Math.round(HEADER_ND_MM * MM_PX * 0.5) + "px";
          ["姓名 Name", "日期 Date"].forEach((label) => {
            const item = document.createElement("div");
            item.className = "nd-item";
            const span = document.createElement("span");
            span.textContent = label + "：";
            const blank = document.createElement("span");
            blank.className = "nd-blank";
            item.appendChild(span);
            item.appendChild(blank);
            nd.appendChild(item);
          });
          header.appendChild(nd);
        }
        pageDiv.appendChild(header);
      }

      if (hasFooter) {
        const footer = document.createElement("div");
        footer.className = "page-footer";
        footer.style.left = marginPx + "px";
        footer.style.top = (pageHpx - marginPx - FOOTER_MM * MM_PX) + "px";
        footer.style.width = contentWpx + "px";
        footer.style.height = (FOOTER_MM * MM_PX) + "px";
        footer.style.fontSize = Math.round(FOOTER_MM * MM_PX * 0.5) + "px";
        footer.style.paddingTop = Math.round(FOOTER_GAP_MM * MM_PX * 0.4) + "px";

        const left = document.createElement("span");
        left.textContent = settings.footerText || "";
        const right = document.createElement("span");
        right.textContent = settings.showPageNum ? `第 ${pageIndex + 1} / ${pages.length} 页  Page ${pageIndex + 1} of ${pages.length}` : "";
        footer.appendChild(left);
        footer.appendChild(right);
        pageDiv.appendChild(footer);
      }

      const inner = document.createElement("div");
      inner.className = "page-inner";
      inner.style.left = marginPx + "px";
      inner.style.top = contentTopPx + "px";
      inner.style.width = contentWpx + "px";
      inner.style.height = contentHpx + "px";
      // No gap here — spacing between lines/entries is handled per-chunk via
      // gapAfterPx margins, since an entry's lines may now be split across
      // page boundaries.

      let currentBlock = null;
      let currentEntryMeta = null;

      pageChunks.forEach((chunk) => {
        if (chunk.entryMeta !== currentEntryMeta) {
          currentBlock = document.createElement("div");
          currentBlock.className = "entry-block";
          inner.appendChild(currentBlock);
          currentEntryMeta = chunk.entryMeta;
        }
        const { entry, unitWidthPx, columnsPerLine } = chunk.entryMeta;

        if (chunk.kind === "label") {
          const label = document.createElement("div");
          label.className = "entry-label";
          label.style.height = chunk.contentHeightPx + "px";
          label.style.marginBottom = chunk.gapAfterPx + "px";
          label.style.fontSize = Math.round(cellPx * 0.2) + "px";
          const word = document.createElement("span");
          word.className = "word";
          word.textContent = entry.text;
          label.appendChild(word);
          if (entry.meaning) {
            const meaning = document.createElement("span");
            meaning.className = "meaning";
            meaning.style.fontSize = Math.round(cellPx * 0.15) + "px";
            meaning.textContent = entry.meaning;
            label.appendChild(meaning);
          }
          currentBlock.appendChild(label);
        } else if (chunk.kind === "strokeOrder") {
          const glyphs = buildStrokeOrderGlyphs(entry.chars[0]);
          if (glyphs.length) {
            const row = document.createElement("div");
            row.className = "stroke-order-row";
            row.style.height = chunk.contentHeightPx + "px";
            row.style.gap = "3px";
            row.style.marginBottom = chunk.gapAfterPx + "px";
            const glyphSize = Math.min(cellPx * 0.42, 30);
            glyphs.forEach((svg, gi) => {
              const g = document.createElement("div");
              g.className = "stroke-glyph";
              g.style.width = glyphSize + "px";
              g.style.height = glyphSize + "px";
              g.innerHTML = svg;
              row.appendChild(g);
              if (gi < glyphs.length - 1) {
                const arrow = document.createElement("span");
                arrow.className = "arrow";
                arrow.textContent = "›";
                arrow.style.fontSize = Math.round(glyphSize * 0.6) + "px";
                row.appendChild(arrow);
              }
            });
            currentBlock.appendChild(row);
          }
        } else if (chunk.kind === "line") {
          const unitWrap = document.createElement("div");
          unitWrap.className = "unit-wrap";
          unitWrap.style.width = (columnsPerLine * unitWidthPx) + "px";
          unitWrap.style.marginBottom = chunk.gapAfterPx + "px";
          chunk.lineSlots.forEach((slot) => {
            unitWrap.appendChild(buildUnitEl(entry, unitWidthPx, slot));
          });
          currentBlock.appendChild(unitWrap);
        }
      });

      pageDiv.appendChild(inner);
      els.pagesContainer.appendChild(pageDiv);
    });
  }

  // ---------- PDF export ----------

  async function generatePdf() {
    if (entries.length === 0) return;
    els.generateBtn.disabled = true;
    els.statusMsg.textContent = "生成中... Generating PDF, please wait...";

    try {
      await renderAll();
      const pageEls = Array.from(els.pagesContainer.querySelectorAll(".pdf-page"));
      if (pageEls.length === 0) throw new Error("no pages");

      const settings = getSettings();
      const page = PAGE_MM[settings.pageSize];
      const pageWpx = page.w * MM_PX;
      const pageHpx = page.h * MM_PX;

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "px", format: [pageWpx, pageHpx], compress: true });

      for (let i = 0; i < pageEls.length; i++) {
        els.statusMsg.textContent = `渲染第 ${i + 1}/${pageEls.length} 页... Rendering page ${i + 1}/${pageEls.length}...`;
        const canvas = await html2canvas(pageEls[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage([pageWpx, pageHpx], "portrait");
        pdf.addImage(imgData, "JPEG", 0, 0, pageWpx, pageHpx);
      }

      pdf.save("chinese-handwriting-practice.pdf");
      els.statusMsg.textContent = "完成！已下载 PDF。 Done — PDF downloaded.";
    } catch (err) {
      console.error(err);
      els.statusMsg.textContent = "出错了，请重试。 Something went wrong, please try again.";
    } finally {
      els.generateBtn.disabled = entries.length === 0;
      setTimeout(() => { els.statusMsg.textContent = ""; }, 4000);
    }
  }

  // ---------- wiring ----------

  els.addBtn.addEventListener("click", syncEntriesFromTextarea);
  els.textInput.addEventListener("input", scheduleSync);
  els.textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) syncEntriesFromTextarea();
  });
  els.clearBtn.addEventListener("click", clearAll);
  els.generateBtn.addEventListener("click", generatePdf);

  els.scriptMode.addEventListener("change", () => {
    convertAllEntriesScript(els.scriptMode.value);
    scheduleRender();
  });

  [els.phoneticMode, els.pageSize, els.gridStyle, els.cellSize, els.traceStyle, els.repModel, els.repTrace, els.repBlank, els.showMeaning, els.showStrokeOrder, els.headerTitle, els.showNameDate, els.showPageNum, els.footerText]
    .forEach((el) => el.addEventListener("input", scheduleRender));

  renderTable();
  scheduleRender();
})();
