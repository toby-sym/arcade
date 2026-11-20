// Phase 6, wasm side: cartridge save RAM and savestates on top of the mds_* C API (core/host/saves.cpp).
// Works on a loaded Emscripten module `M`, so the emulation worker and the Node tests share exactly the same code.
// The main-thread half (debounce, caching, promises) is js/saves.js.

/** Error with a stable `code`: STATE_VERSION, STATE_INCOMPATIBLE, STATE_CORRUPT (API_CONTRACT.md section 6) plus
 *  STATE_UNSUPPORTED (DSi mode), NO_ROM and NO_SAVE_MEMORY. */
export class SaveError extends Error {
  constructor(code, message) { super(message); this.name = "SaveError"; this.code = code; }
}

// mds_load_state result codes (core/host/saves.cpp).
const STATE_CODES = {
  [-1]: ["NO_ROM", "no game is loaded"],
  [-3]: ["STATE_UNSUPPORTED", "this console mode cannot save or load states (DSi mode)"],
  [-10]: ["STATE_CORRUPT", "the state container is damaged (magic, length or CRC32 do not match)"],
  [-11]: ["STATE_VERSION", "the state container has a different format version"],
  [-12]: ["STATE_INCOMPATIBLE", "the state was made by a different build of the core"],
  [-13]: ["STATE_INCOMPATIBLE", "the state does not fit the loaded game (other ROM, or the core refused it)"],
};
function stateError(rc) {
  const [code, text] = STATE_CODES[rc] ?? ["STATE_CORRUPT", `unexpected result ${rc}`];
  return new SaveError(code, `${code}: ${text}`);
}

export const STATE_MAGIC = "MDSSTATE";
export const STATE_VERSION = 1;
export const STATE_HEADER_LEN = 28;

/** Cartridge save memory type implied by the SRAM length (NDSCart/CartRetail.cpp: sramlengths[] and SRAMType).
 *  melonDS does not tell EEPROM 64 KiB from FRAM apart (FRAM carts use the same SPI protocol) [VERIFICAR with a FRAM game]. */
export function describeSaveType(length) {
  if (!length) return "none";
  const table = {
    512: "EEPROM 512 B", 8192: "EEPROM 8 KiB", 65536: "EEPROM/FRAM 64 KiB", 131072: "EEPROM 128 KiB",
    262144: "Flash 256 KiB", 524288: "Flash 512 KiB", 1048576: "Flash 1 MiB",
    8388608: "NAND 8 MiB", 16777216: "NAND 16 MiB", 67108864: "NAND 64 MiB",
  };
  return table[length] ?? `unknown (${length} bytes)`;
}

let crcTable = null;
export function crc32(bytes, crc = 0) {
  if (!crcTable) crcTable = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  crc = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return ~crc >>> 0;
}

/** Reads the fixed header of a state container without validating it (tests, diagnostics). */
export function parseStateHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    magic: new TextDecoder().decode(bytes.subarray(0, 8)), version: dv.getUint32(8, true), flags: dv.getUint32(12, true),
    coreAbi: dv.getUint32(16, true), sramLen: dv.getUint32(20, true), stateLen: dv.getUint32(24, true),
  };
}

function withOut2(M, fn) {
  const p = M._malloc(8);
  try { return fn(p, p + 4); } finally { M._free(p); }
}

/** Copies the cartridge SRAM out of the core. null = the game has no save memory. Reflects every write the game has made
 *  so far (the core mirrors them into its staging buffer immediately). */
export function getSave(M) {
  return withOut2(M, (pp, lp) => {
    const rc = M._mds_get_save(pp, lp);
    if (rc !== 0) throw new SaveError("NO_ROM", "NO_ROM: no game is loaded");
    const ptr = M.HEAPU32[pp >> 2], len = M.HEAPU32[lp >> 2];
    return len ? M.HEAPU8.slice(ptr, ptr + len) : null; // slice() copies, even out of a SharedArrayBuffer
  });
}

/** Replaces the cartridge save and restarts the game ("loadSave"). Returns {resized}: true if `bytes` was not exactly the
 *  cartridge's save size (it is truncated or padded with 0xFF, like melonDS desktop does). */
export function setSave(M, bytes) {
  const p = M._malloc(Math.max(1, bytes.length));
  try {
    M.HEAPU8.set(bytes, p);
    const rc = M._mds_set_save(p, bytes.length);
    if (rc === -1) throw new SaveError("NO_ROM", "NO_ROM: no game is loaded");
    if (rc === -2) throw new SaveError("NO_SAVE_MEMORY", "NO_SAVE_MEMORY: this game has no save memory");
    return { resized: rc === 1 };
  } finally { M._free(p); }
}

/** Counter that increases whenever the SRAM changed since the previous call. */
export const pollSave = (M) => M._mds_poll_save() >>> 0;
export const saveStatus = (M) => M._mds_get_save_status();
export const coreAbi = (M) => M._mds_get_core_abi() >>> 0;

/** Builds the API_CONTRACT.md section 6 container (SRAM + retro_serialize blob + CRC32). */
export function saveState(M) {
  return withOut2(M, (pp, lp) => {
    const rc = M._mds_save_state(pp, lp);
    if (rc !== 0) throw stateError(rc);
    const ptr = M.HEAPU32[pp >> 2], len = M.HEAPU32[lp >> 2];
    return M.HEAPU8.slice(ptr, ptr + len);
  });
}

/** Validates and restores a container; throws SaveError STATE_VERSION / STATE_INCOMPATIBLE / STATE_CORRUPT. */
export function loadState(M, bytes) {
  const p = M._malloc(Math.max(1, bytes.length));
  try {
    M.HEAPU8.set(bytes, p);
    const rc = M._mds_load_state(p, bytes.length);
    if (rc !== 0) throw stateError(rc);
  } finally { M._free(p); }
}

/** Worker-side glue: request handlers plus the per-frame change detector behind onSave. */
export function createWorkerSaves(M, post, { pollEveryFrames = 10 } = {}) {
  let frames = 0, lastRev = 0;
  const tick = (force = false) => {
    if (!force && ++frames % pollEveryFrames) return;
    const rev = pollSave(M);
    if (rev !== lastRev) { lastRev = rev; post({ type: "saveChanged", rev }); }
  };
  const reply = (result) => ({ result, transfer: result instanceof Uint8Array ? [result.buffer] : [] });
  return {
    tick,
    reset() { frames = 0; lastRev = pollSave(M); },
    handlers: {
      getSave: () => reply(getSave(M)),
      setSave: ({ data }) => { const r = setSave(M, data); lastRev = pollSave(M); return reply(r); },
      saveState: () => reply(saveState(M)),
      loadState: ({ data }) => { loadState(M, data); tick(true); return reply(undefined); },
    },
  };
}
