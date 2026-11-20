// Phase 6, main-thread side of saves and savestates (API_CONTRACT.md section 6).
//
// The wasm module lives in the emulation worker, so anything that needs its memory is a round trip. To keep the
// synchronous `getSave()` of the contract, this class caches the last SRAM copy it received and refreshes it whenever the
// worker reports a change (the worker polls the core every ~10 frames, js/saves-core.js). `getSaveNow()` always asks the
// worker for the live bytes. See tests/DEVIATIONS.md (Phase 6) for why saveState/loadState are async here.
import { crc32 } from "./saves-core.js";
export { SaveError, describeSaveType, parseStateHeader } from "./saves-core.js";

const DEFAULT_DEBOUNCE_MS = 500;

/**
 * @param {object} io
 * @param {(msg: object) => Promise<any>} io.call   posts a request to the worker and resolves with the ack result
 * @param {(type: string, cb: Function) => Function} io.on  subscribes to worker messages ("saveChanged", "loaded"); returns unsubscribe
 */
export class SaveClient {
  constructor({ call, on }) {
    this.call = call;
    this.cache = null;       // last SRAM bytes seen (copy), null = none known / the game has no save memory
    this.listeners = new Map(); // callback -> { debounceMs, timer }
    this.offChanged = on("saveChanged", () => this.#changed());
    this.offLoaded = on("loaded", (m) => { this.cache = null; this.info = { length: m.saveLen, type: m.saveType, status: m.saveStatus }; if (m.saveLen) this.refresh().catch(() => {}); });
    this.info = { length: 0, type: "none", status: 0 };
  }

  /** Last SRAM copy the worker reported (at most ~170 ms behind the game while it runs); null when unknown or when
   *  the game has no save memory. Use `await getSaveNow()` when you need the exact bytes (e.g. before closing). */
  getSave() { return this.cache ? this.cache.slice() : null; }

  /** Asks the worker for the live SRAM and refreshes the cache. */
  async getSaveNow() { const bytes = (await this.call({ type: "getSave" })) ?? null; this.cache = bytes; return bytes ? bytes.slice() : null; }
  async refresh() { return this.getSaveNow(); }

  /** Replaces the cartridge save and restarts the game. Resolves {resized}. */
  async loadSave(data) {
    const r = await this.call({ type: "setSave", data: data instanceof Uint8Array ? data : new Uint8Array(data) });
    await this.getSaveNow();
    return r;
  }

  /**
   * Calls cb(bytes) once the SRAM changed and stayed unchanged for `debounceMs` (not on every write).
   * @returns {() => void} unsubscribe
   */
  onSave(cb, debounceMs = DEFAULT_DEBOUNCE_MS) {
    const entry = { debounceMs, timer: null };
    this.listeners.set(cb, entry);
    return () => { clearTimeout(entry.timer); this.listeners.delete(cb); };
  }

  /** Delivers any pending onSave notification right now (call it before the page is hidden or closed). */
  async flush() {
    const pending = [...this.listeners.entries()].filter(([, e]) => e.timer !== null);
    if (!pending.length) return;
    for (const [, e] of pending) { clearTimeout(e.timer); e.timer = null; }
    const bytes = await this.getSaveNow();
    for (const [cb] of pending) if (bytes) cb(bytes.slice());
  }

  #changed() {
    for (const [cb, e] of this.listeners) {
      clearTimeout(e.timer);
      e.timer = setTimeout(async () => {
        e.timer = null;
        try { const bytes = await this.getSaveNow(); if (bytes && this.listeners.get(cb) === e) cb(bytes.slice()); } catch { /* worker gone */ }
      }, e.debounceMs);
    }
    this.getSaveNow().catch(() => {}); // keep the synchronous cache fresh even without listeners
  }

  /** Container of API_CONTRACT.md section 6 (async: the core lives in the worker). */
  saveState() { return this.call({ type: "saveState" }); }
  /** Throws SaveError with code STATE_VERSION, STATE_INCOMPATIBLE or STATE_CORRUPT (plus STATE_UNSUPPORTED / NO_ROM). */
  async loadState(data) { await this.call({ type: "loadState", data: data instanceof Uint8Array ? data : new Uint8Array(data) }); await this.getSaveNow(); }

  dispose() { this.offChanged(); this.offLoaded(); for (const e of this.listeners.values()) clearTimeout(e.timer); this.listeners.clear(); }
}

/** CRC32 helper for hosts that want to compare/index saves (same polynomial as the state container). */
export const saveCrc32 = (bytes) => crc32(bytes);
