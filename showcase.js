// Renders a few small, real (not mocked) examples of generator output on the
// landing page, using the same HanziWriter stroke data + rendering approach
// as app.js, trimmed down to just what's needed for static demo snippets.
(function () {
  "use strict";

  const BASE = 100;
  const CELL_PX = 56;
  const strokeCache = new Map();

  function gridBackgroundUri(style) {
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
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">` +
      `<rect x="0.5" y="0.5" width="${s-1}" height="${s-1}" fill="#fffdf9" stroke="${border}" stroke-width="1.4"/>` +
      inner +
      `</svg>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

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

  function charSvg(ch, opacity) {
    const data = strokeCache.get(ch);
    if (!data || !data.strokes || !data.strokes.length) return "";
    const padding = BASE * 0.12;
    const t = HanziWriter.getScalingTransform(BASE, BASE, padding);
    const paths = data.strokes.map((d) => `<path d="${d}" fill="#1c1a17"/>`).join("");
    return `<svg viewBox="0 0 ${BASE} ${BASE}" style="opacity:${opacity}"><g transform="${t.transform}">${paths}</g></svg>`;
  }

  function strokeGlyphs(ch) {
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

  function buildWordRow(container, chars, pinyins, opts) {
    const { reps = 3, gridStyle = "tian", phonetic = "pinyin" } = opts || {};
    const gridUri = gridBackgroundUri(gridStyle);
    const unitWrap = document.createElement("div");
    unitWrap.className = "unit-wrap";
    for (let r = 0; r < reps; r++) {
      const unit = document.createElement("div");
      unit.className = "unit";
      unit.style.width = (chars.length * CELL_PX) + "px";

      const head = document.createElement("div");
      head.className = "unit-head";
      head.style.height = "30px";

      const row = document.createElement("div");
      row.className = "unit-row";

      chars.forEach((ch, ci) => {
        const syll = document.createElement("div");
        syll.className = "syll";
        syll.style.width = CELL_PX + "px";
        syll.style.fontSize = "13px";
        const py = pinyins[ci];
        const zy = phonetic !== "pinyin" ? Bopomofo.pinyinToZhuyin(py) : "";
        if (phonetic === "both") {
          syll.innerHTML = `${py}<span class="zy" style="font-size:10px">${zy}</span>`;
        } else if (phonetic === "zhuyin") {
          syll.textContent = zy;
        } else {
          syll.textContent = py;
        }
        head.appendChild(syll);

        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.width = CELL_PX + "px";
        cell.style.height = CELL_PX + "px";
        cell.style.backgroundImage = `url("${gridUri}")`;
        cell.innerHTML = charSvg(ch, r === 0 ? 1 : 0.32);
        row.appendChild(cell);
      });

      unit.appendChild(head);
      unit.appendChild(row);
      unitWrap.appendChild(unit);
    }
    container.appendChild(unitWrap);
  }

  function buildStrokeRow(container, ch) {
    const glyphs = strokeGlyphs(ch);
    const row = document.createElement("div");
    row.className = "stroke-order-row";
    const size = 34;
    glyphs.forEach((svg, i) => {
      const g = document.createElement("div");
      g.className = "stroke-glyph";
      g.style.width = size + "px";
      g.style.height = size + "px";
      g.innerHTML = svg;
      row.appendChild(g);
      if (i < glyphs.length - 1) {
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "›";
        row.appendChild(arrow);
      }
    });
    container.appendChild(row);
  }

  async function init() {
    const chars = ["该", "起", "床", "了", "你", "好", "爱", "愛", "送"];
    await ensureStrokeData(chars);

    const wordEl = document.getElementById("showcase-word");
    if (wordEl) buildWordRow(wordEl, ["该", "起", "床", "了"], ["gāi", "qǐ", "chuáng", "le"], { reps: 2, gridStyle: "tian", phonetic: "pinyin" });

    const phoneticEl = document.getElementById("showcase-phonetic");
    if (phoneticEl) buildWordRow(phoneticEl, ["你", "好"], ["nǐ", "hǎo"], { reps: 2, gridStyle: "mi", phonetic: "both" });

    const scriptSimpEl = document.getElementById("showcase-script-simp");
    if (scriptSimpEl) buildWordRow(scriptSimpEl, ["爱"], ["ài"], { reps: 3, gridStyle: "tian", phonetic: "pinyin" });

    const scriptTradEl = document.getElementById("showcase-script-trad");
    if (scriptTradEl) buildWordRow(scriptTradEl, ["愛"], ["ài"], { reps: 3, gridStyle: "tian", phonetic: "pinyin" });

    const strokeEl = document.getElementById("showcase-stroke");
    if (strokeEl) buildStrokeRow(strokeEl, "送");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
