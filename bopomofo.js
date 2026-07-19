// Pinyin (with tone diacritics) -> Zhuyin/Bopomofo converter.
// Rule-based (initial + final decomposition), not a syllable lookup table.
(function (global) {
  "use strict";

  const ACCENTS = {
    "ā": ["a", 1], "á": ["a", 2], "ǎ": ["a", 3], "à": ["a", 4],
    "ē": ["e", 1], "é": ["e", 2], "ě": ["e", 3], "è": ["e", 4],
    "ī": ["i", 1], "í": ["i", 2], "ǐ": ["i", 3], "ì": ["i", 4],
    "ō": ["o", 1], "ó": ["o", 2], "ǒ": ["o", 3], "ò": ["o", 4],
    "ū": ["u", 1], "ú": ["u", 2], "ǔ": ["u", 3], "ù": ["u", 4],
    "ǖ": ["v", 1], "ǘ": ["v", 2], "ǚ": ["v", 3], "ǜ": ["v", 4],
  };

  const INITIALS_ORDERED = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s"];
  const BUZZING_INITIALS = new Set(["zh", "ch", "sh", "r", "z", "c", "s"]);

  const INITIAL_MAP = {
    b: "ㄅ", p: "ㄆ", m: "ㄇ", f: "ㄈ", d: "ㄉ", t: "ㄊ", n: "ㄋ", l: "ㄌ",
    g: "ㄍ", k: "ㄎ", h: "ㄏ", j: "ㄐ", q: "ㄑ", x: "ㄒ",
    zh: "ㄓ", ch: "ㄔ", sh: "ㄕ", r: "ㄖ", z: "ㄗ", c: "ㄘ", s: "ㄙ",
  };

  const ZERO_INITIAL_NORMALIZE = {
    yi: "i", ya: "ia", ye: "ie", yao: "iao", you: "iu",
    yan: "ian", yin: "in", yang: "iang", ying: "ing", yong: "iong",
    yu: "v", yue: "ve", yuan: "van", yun: "vn",
    wu: "u", wa: "ua", wo: "uo", wai: "uai", wei: "ui",
    wan: "uan", wen: "un", wang: "uang", weng: "ueng",
  };

  const FINAL_MAP = {
    a: "ㄚ", o: "ㄛ", e: "ㄜ", ai: "ㄞ", ei: "ㄟ", ao: "ㄠ", ou: "ㄡ",
    an: "ㄢ", en: "ㄣ", ang: "ㄤ", eng: "ㄥ", ong: "ㄨㄥ", er: "ㄦ",
    i: "ㄧ", ia: "ㄧㄚ", ie: "ㄧㄝ", iao: "ㄧㄠ", iu: "ㄧㄡ", ian: "ㄧㄢ", in: "ㄧㄣ",
    iang: "ㄧㄤ", ing: "ㄧㄥ", iong: "ㄩㄥ",
    u: "ㄨ", ua: "ㄨㄚ", uo: "ㄨㄛ", uai: "ㄨㄞ", ui: "ㄨㄟ", uan: "ㄨㄢ", un: "ㄨㄣ",
    uang: "ㄨㄤ", ueng: "ㄨㄥ",
    v: "ㄩ", ve: "ㄩㄝ", van: "ㄩㄢ", vn: "ㄩㄣ",
  };

  const TONE_SUFFIX = { 1: "", 2: "ˊ", 3: "ˇ", 4: "ˋ" };

  function convertSyllable(syl) {
    if (!syl) return syl;
    const chars = Array.from(syl.toLowerCase());
    let plain = "";
    let tone = null;
    for (const ch of chars) {
      if (ACCENTS[ch]) {
        const [p, t] = ACCENTS[ch];
        plain += p;
        tone = t;
      } else if (ch === "ü") {
        plain += "v";
      } else {
        plain += ch;
      }
    }
    if (tone === null) tone = 5;

    if (plain === "er") return applyTone("ㄦ", tone);

    let initial = "";
    let final = plain;

    if (plain.startsWith("y") || plain.startsWith("w")) {
      if (ZERO_INITIAL_NORMALIZE[plain] !== undefined) {
        final = ZERO_INITIAL_NORMALIZE[plain];
      } else if (plain.startsWith("y")) {
        final = "i" + plain.slice(1);
      } else {
        final = "u" + plain.slice(1);
      }
    } else {
      for (const init of INITIALS_ORDERED) {
        if (plain.startsWith(init)) {
          initial = init;
          final = plain.slice(init.length);
          break;
        }
      }
    }

    if ((initial === "j" || initial === "q" || initial === "x") && final.startsWith("u")) {
      final = "v" + final.slice(1);
    }

    let symbol;
    if (BUZZING_INITIALS.has(initial) && final === "i") {
      symbol = INITIAL_MAP[initial];
    } else {
      const initSym = initial ? (INITIAL_MAP[initial] || "") : "";
      const finalSym = FINAL_MAP[final];
      if (finalSym === undefined) return syl; // unmapped, fall back to original
      symbol = initSym + finalSym;
    }

    return applyTone(symbol, tone);
  }

  function applyTone(symbol, tone) {
    if (tone === 5) return "˙" + symbol;
    return symbol + (TONE_SUFFIX[tone] || "");
  }

  // Converts a pinyin string that may contain multiple syllables separated
  // by spaces and/or slashes (e.g. "cháng / zhǎng"), preserving separators.
  const SEPARATOR_RE = /^(\s*\/\s*|\s+)$/;

  function pinyinToZhuyin(text) {
    if (!text) return "";
    return text
      .split(/(\s*\/\s*|\s+)/)
      .map((tok) => (tok === "" || SEPARATOR_RE.test(tok) ? tok : convertSyllable(tok)))
      .join("");
  }

  global.Bopomofo = { convertSyllable, pinyinToZhuyin };
})(window);
