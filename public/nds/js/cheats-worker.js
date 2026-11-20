// Worker-side cheat handlers (Phase 8): text -> js/cheats.js -> mds_cheat_set / mds_cheat_clear.
// Kept out of emu-worker.js so the shared file only needs two small lines. `getModule()` returns the Emscripten module (or null before init).
import { parseCheat } from "./cheats.js";

// Return codes of mds_cheat_set (core/host/cheats.cpp) -> Error.code
const RC = { "-1": ["CHEAT_NO_ROM", "no hay juego cargado"], "-2": ["CHEAT_EMPTY", "código vacío"], "-3": ["CHEAT_INVALID", "el código no tiene palabras de 8 dígitos hexadecimales"], "-4": ["CHEAT_ODD_WORDS", "número impar de palabras"], "-5": ["CHEAT_TRUNCATED", "carga E-type incompleta"] };

/** @returns {number} slot used by the core. Throws Error with `code` (CHEAT_*) and, for syntax errors, `line`/`column`/`detail`. */
export function setCheat(M, id, enabled, code) {
  if (!M) throw Object.assign(new Error("el módulo no está inicializado"), { code: "NOT_READY" });
  if (!Number.isInteger(id) || id < 0 || id > 0xffffffff) throw Object.assign(new Error(`id de truco inválido: ${id}`), { code: "CHEAT_ID" });
  let canon = "";
  const warnings = [];
  if (code != null && code !== "") {
    const r = parseCheat(code);
    if (!r.ok) throw Object.assign(new Error(r.error.message), { code: `CHEAT_${r.error.code}`, line: r.error.line, column: r.error.column, detail: r.error });
    canon = r.code;
    warnings.push(...r.warnings);
  } // empty code + known id: the glue reuses the text it stored for that id (toggle)
  const bytes = new TextEncoder().encode(canon);
  const p = bytes.length ? M._malloc(bytes.length) : 0;
  try {
    if (p) M.HEAPU8.set(bytes, p);
    const rc = M._mds_cheat_set(id, enabled ? 1 : 0, p, bytes.length);
    if (rc < 0) { const [c, m] = RC[rc] ?? ["CHEAT_ERROR", `mds_cheat_set devolvió ${rc}`]; throw Object.assign(new Error(m), { code: c }); }
    return { slot: rc, warnings };
  } finally {
    if (p) M._free(p);
  }
}

export function clearCheats(M) {
  if (!M) throw Object.assign(new Error("el módulo no está inicializado"), { code: "NOT_READY" });
  M._mds_cheat_clear();
}

/** Handlers to spread into emu-worker.js `handlers`: {type:"cheat", cheatId, enabled, code}, {type:"cheatClear"}. The worker acks by
 *  the message `id`. Integration fix: the VideoPlayer request/ack protocol puts its own `id` on every message, which overwrote the
 *  cheat's id, so the cheat id travels as `cheatId`; plain `id` is still accepted for direct calls (tests/cheats-memory.test.mjs). */
export const cheatHandlers = (getModule) => ({
  cheat: ({ cheatId, id, enabled, code }) => { setCheat(getModule(), cheatId ?? id, enabled, code); },
  cheatClear: () => { clearCheats(getModule()); },
});
