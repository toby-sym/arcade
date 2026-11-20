// Action Replay cheat text -> the string `retro_cheat_set` accepts. Pure functions, no DOM, no wasm (Phase 8).
//
// Input accepted (API_CONTRACT.md section 4): 32-bit hexadecimal words (exactly 8 hex digits, any case) separated by
// "+", spaces, tabs, "-" or line breaks. That covers the one-line "A+B+C" form, one word per line, and "XXXXXXXX XXXXXXXX" pairs.
//
// Output: canonical "AAAAAAAA+BBBBBBBB+..." (upper case, no trailing separator). The core validates with
// ^\s*[0-9A-Fa-f]{8}([+\s-]*[0-9A-Fa-f]{8})*$ (core.hpp:186), so a trailing newline would be rejected by it; the canonical form never has one.
//
// Why validate here as well: the core only checks the *syntax* of each token. The engine (melonDS AREngine.cpp, RunCheat)
// reads the code two words at a time with no bounds check, so an odd number of words, or an E-type opcode whose payload is
// cut short, makes it read past the end of the vector. Those are reported as errors and never reach the core.

export const MAX_WORDS = 0x10000; // sanity limit (256 KiB of code); the engine has none
// An E-type instruction whose payload is at most this many words short is accepted and zero-padded (see parseCheat). Real, widely used
// codes are exactly 2 words short (the HGSS "Anti-Piracy Bypass" in reference/cheats-sample.json and in libretro-database); anything
// bigger in real data (330 words, millions of bytes) is a misaligned or corrupt code.
export const MAX_PAD_WORDS = 4;

const HEX8 = /^[0-9A-Fa-f]{8}$/;

/** Error codes returned in `error.code`. */
export const CheatErrorCode = Object.freeze({
  EMPTY: "EMPTY", // nothing but separators
  NOT_STRING: "NOT_STRING",
  BAD_TOKEN: "BAD_TOKEN", // not exactly 8 hex digits (wrong length, non-hex characters, "0x" prefix...)
  ODD_WORDS: "ODD_WORDS", // AR instructions are pairs of words
  TRUNCATED_PAYLOAD: "TRUNCATED_PAYLOAD", // an Exxxxxxx instruction announces more than MAX_PAD_WORDS data words beyond what the code has
  TOO_LONG: "TOO_LONG",
});

/** Warning codes returned in `warnings[].code` (code is accepted; the engine will ignore or abort at that instruction). */
export const CheatWarningCode = Object.freeze({
  PAYLOAD_PADDED: "PAYLOAD_PADDED", // E-type payload was up to MAX_PAD_WORDS words short; zero words were appended so the engine never reads past the end
  UNKNOWN_OPCODE: "UNKNOWN_OPCODE", // engine logs "bad AR opcode" and stops running the code there
  UNSUPPORTED_OPCODE: "UNSUPPORTED_OPCODE", // C4: the engine logs an error and stops
});

// Splits `text` into tokens with 1-based line/column. Separators: + - whitespace (the same set as the core regex).
function tokenize(text) {
  const tokens = [];
  let line = 1, col = 1, start = -1, startLine = 1, startCol = 1;
  const flush = (end) => {
    if (start >= 0) tokens.push({ text: text.slice(start, end), line: startLine, column: startCol });
    start = -1;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "+" || ch === "-" || ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f" || ch === "\v" || ch === " " || ch === "﻿") {
      flush(i);
      if (ch === "\n") { line++; col = 1; } else col++;
    } else {
      if (start < 0) { start = i; startLine = line; startCol = col; }
      col++;
    }
  }
  flush(text.length);
  return tokens;
}

const err = (code, message, extra = {}) => ({ ok: false, error: { code, message, ...extra } });

/** Number of data words that follow an Exxxxxxx / E-type instruction with byte count `b` (engine: loop of 8 bytes per word pair). */
export const payloadWords = (b) => 2 * Math.ceil(b / 8);

/**
 * Parses one cheat.
 * @param {string} text
 * @returns {{ok:true, words:number[], code:string, warnings:{code:string,message:string,wordIndex:number}[]}
 *          | {ok:false, error:{code:string,message:string,line?:number,column?:number,token?:string,wordIndex?:number}}}
 */
export function parseCheat(text) {
  if (typeof text !== "string") return err(CheatErrorCode.NOT_STRING, "el código debe ser una cadena de texto");
  const tokens = tokenize(text);
  if (tokens.length === 0) return err(CheatErrorCode.EMPTY, "el código está vacío", { line: 1, column: 1 });
  if (tokens.length > MAX_WORDS) return err(CheatErrorCode.TOO_LONG, `demasiadas palabras (${tokens.length} > ${MAX_WORDS})`);

  const words = new Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!HEX8.test(t.text)) {
      const why = /^0[xX]/.test(t.text) ? "no lleva prefijo 0x" : /^[0-9A-Fa-f]+$/.test(t.text) ? `tiene ${t.text.length} dígitos, se esperan 8` : "contiene caracteres no hexadecimales";
      return err(CheatErrorCode.BAD_TOKEN, `línea ${t.line}, columna ${t.column}: «${t.text.slice(0, 24)}» ${why} (palabra ${i + 1})`, { line: t.line, column: t.column, token: t.text, wordIndex: i });
    }
    words[i] = parseInt(t.text, 16) >>> 0;
  }
  if (words.length % 2 !== 0) {
    const last = tokens[tokens.length - 1];
    return err(CheatErrorCode.ODD_WORDS, `línea ${last.line}: ${words.length} palabras; las instrucciones son pares de 8 dígitos y sobra «${last.text}»`, { line: last.line, column: last.column, token: last.text, wordIndex: words.length - 1 });
  }

  // Walk the instructions pair by pair, skipping E-type payloads, as the engine does. (`words` may grow when a payload is padded.)
  const warnings = [];
  for (let i = 0; i < words.length; i += 2) {
    const a = words[i], b = words[i + 1], op = a >>> 24;
    if ((op & 0xF0) === 0xE0) {
      const need = payloadWords(b);
      const missing = i + 2 + need - words.length;
      if (missing > MAX_PAD_WORDS) {
        const t = tokens[i];
        return err(CheatErrorCode.TRUNCATED_PAYLOAD, `línea ${t.line}: la instrucción ${t.text} ${tokens[i + 1].text} copia ${b} bytes y necesita ${need} palabras de datos, pero solo quedan ${words.length - i - 2}`, { line: t.line, column: t.column, token: t.text, wordIndex: i });
      }
      if (missing > 0) {
        // The engine would read `missing` words past the end of its vector (undefined contents) and copy them to RAM. Pad with zeros instead.
        const t = tokens[i];
        for (let k = 0; k < missing; k++) words.push(0);
        warnings.push({ code: CheatWarningCode.PAYLOAD_PADDED, wordIndex: i, line: t.line, message: `línea ${t.line}: la instrucción ${t.text} ${tokens[i + 1].text} anuncia ${need} palabras de datos y faltan ${missing}; se rellenan con ceros` });
      }
      i += need;
      continue;
    }
    const w = knownOpcodeWarning(op);
    if (w) warnings.push({ ...w, wordIndex: i, line: tokens[i].line, message: `línea ${tokens[i].line}: ${w.message} (${tokens[i].text} ${tokens[i + 1].text})` });
  }

  return { ok: true, words, code: toRetroCode(words), warnings };
}

// Opcodes the engine handles (AREngine.cpp RunCheat): 0x00-0xBF (high nibble 0..B), C0, C4(aborts), C5, C6, D0..DC, E0-EF, F0-FF.
function knownOpcodeWarning(op) {
  if (op < 0xC0) return null;
  if (op === 0xC0 || op === 0xC5 || op === 0xC6) return null;
  if (op === 0xC4) return { code: CheatWarningCode.UNSUPPORTED_OPCODE, message: "el opcode C4 no está soportado por melonDS (registra un error y detiene el código)" };
  if (op >= 0xD0 && op <= 0xDC) return null;
  if (op >= 0xF0) return null;
  return { code: CheatWarningCode.UNKNOWN_OPCODE, message: `el opcode ${op.toString(16).toUpperCase().padStart(2, "0")} no existe en el motor (detiene el código)` };
}

/** words (uint32[]) -> "AAAAAAAA+BBBBBBBB+..." */
export function toRetroCode(words) {
  return Array.from(words, (w) => (w >>> 0).toString(16).toUpperCase().padStart(8, "0")).join("+");
}

/**
 * Walks a catalog in the web app format: {id, title, categories:[{name, en, cheats:[{n, c, e}]}]}.
 * Yields flat entries with a running `index` (0-based over the whole catalog; the web app's own id scheme is not known here).
 */
export function* catalogEntries(catalog) {
  let index = 0;
  for (const cat of catalog?.categories ?? []) {
    for (const ch of cat.cheats ?? []) {
      yield { index: index++, category: cat.name, categoryEn: cat.en, name: ch.n, nameEn: ch.e, code: ch.c };
    }
  }
}

/** Parses every cheat of a catalog. Returns {total, ok, failed:[{index,category,name,error}], warned:[{index,name,warnings}], entries}. */
export function parseCatalog(catalog) {
  const out = { id: catalog?.id, total: 0, ok: 0, failed: [], warned: [], entries: [] };
  for (const e of catalogEntries(catalog)) {
    out.total++;
    const r = parseCheat(e.code);
    if (r.ok) {
      out.ok++;
      out.entries.push({ ...e, words: r.words, retro: r.code });
      if (r.warnings.length) out.warned.push({ index: e.index, name: e.name, warnings: r.warnings });
    } else {
      out.failed.push({ index: e.index, category: e.category, name: e.name, error: r.error });
    }
  }
  return out;
}
