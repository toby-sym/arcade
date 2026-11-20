// Public API of melonds-wasm (API_CONTRACT.md section 2): the `MelonDS` class.
//
// It is a thin facade over `VideoPlayer` (js/player.js), which keeps doing the work: worker, SAB rings, renderer,
// audio, input and saves. The facade exists so the contract can stay stable while the engine changes.
//
// Deviations from the literal contract (all recorded in tests/DEVIATIONS.md):
//   * `reset()`, `dispose()`, `loadSave()`, `saveState()`, `loadState()`, `setCheat()` and `clearCheats()` return
//     Promises, because the core lives in a worker and every operation is a round trip.
//   * `threads: false` is rejected with NO_THREADS_BUILD: there is only one wasm build and it needs SharedArrayBuffer.
//     The threadless `dist/st` variant is Phase 9 work.
//   * `setPostProcess(shader)` throws on a shader that does not compile (the contract keeps `void`).
//   * `audioDynamicRate` ("off" | "ff" | "always", default **"always"**, user decision 0.0 #4 of the plan) applies the
//     audio dynamic rate control at 1x too: with a CPU that keeps up nothing changes; with a CPU that is just short the
//     audio slows down to at most 0.8x (20 % lower pitch) instead of cutting. It can be changed live with
//     `setAudioDynamicRate()`, before or after `loadRom()`.
import { VideoPlayer, SCANLINES, normalizeAudioDynamicRate } from "./player.js";
import { LAYOUTS } from "./layouts.js";

export { SCANLINES };
export { FILTERS, FILTER_BY_ID } from "./filters.js";
export const LAYOUT_LABELS = LAYOUTS;

/** Firmware sizes the core accepts (config/constants.hpp, FIRMWARE_SIZES). */
export const FIRMWARE_SIZES = Object.freeze([131072, 262144, 524288]);
/** BIOS sizes the core reports for the DS (console.cpp LoadBios). */
export const BIOS_SIZES = Object.freeze({ arm7: 16384, arm9: 4096 });

const BUTTONS = Object.freeze(["A", "B", "X", "Y", "L", "R", "START", "SELECT", "UP", "DOWN", "LEFT", "RIGHT", "LID"]);

function apiError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** Reads the ROM header the way the DS defines it: title 0x00..0x0B, game code 0x0C..0x0F. */
export function readRomInfo(rom) {
  const latin = (from, to) => {
    let s = "";
    for (let i = from; i < to; i++) s += String.fromCharCode(rom[i]);
    return s.replace(/\0+$/g, "").trim();
  };
  return { title: latin(0, 12), code: latin(12, 16), size: rom.length };
}

export class MelonDS {
  /** @type {VideoPlayer|null} */
  #player = null;
  #canvas = null;
  #createOptions = null;
  #romBytes = null;
  #ready = false;
  #listeners = new Map();
  #firmware = null;
  #bios = null;
  #pendingSystemFiles = [];
  #pendingOptions = {};

  /** @param {object} opts create options of API_CONTRACT.md section 2 */
  constructor(opts = {}) {
    this.#createOptions = opts;
    this.#canvas = opts.canvas ?? null;
  }

  static async create(opts = {}) {
    const threads = opts.threads ?? "auto";
    if (threads === false) {
      throw apiError(
        "NO_THREADS_BUILD",
        "this build needs SharedArrayBuffer; the threadless variant (dist/st) is not built yet - see tests/DEVIATIONS.md",
      );
    }
    if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
      throw apiError(
        "NO_THREADS",
        "SharedArrayBuffer unavailable: serve the page with COOP: same-origin and COEP: require-corp (scripts/serve.mjs)",
      );
    }
    const instance = new MelonDS(opts);
    await instance.#boot({ threadedRenderer: threads !== false });
    return instance;
  }

  #moduleUrl() {
    const { locateFile } = this.#createOptions;
    return locateFile ? locateFile("melonds.js") : new URL("../dist/melonds.js", import.meta.url).href;
  }

  #workerUrl() {
    const { locateFile } = this.#createOptions;
    return locateFile ? locateFile("emu-worker.js") : new URL("./emu-worker.js", import.meta.url).href;
  }

  async #boot({ threadedRenderer }) {
    const { canvas, container, backend = "auto", audio = true, audioLatencyMs = 80, verbose = false, onStatus } =
      this.#createOptions;
    this.#player = await VideoPlayer.create({
      canvas,
      container,
      moduleUrl: this.#moduleUrl(),
      workerUrl: this.#workerUrl(),
      backend,
      verbose,
      threadedRenderer,
      audio,
      audioLatencyMs,
      audioDynamicRate: this.#createOptions.audioDynamicRate, // default "always" inside VideoPlayer.create()
      onStatus,
    });
    this.#player.on("error", (error) => this.#emit("error", error));
    this.#player.on("frame", (frame) => this.#emit("frame", frame));
    for (const [key, value] of Object.entries(this.#pendingOptions)) this.#player.setCoreOption(key, value);
    this.#pendingOptions = {};
    this.#ready = true;
    for (const { name, bytes } of this.#pendingSystemFiles.splice(0)) {
      await this.#writeSystemFile(name, bytes);
    }
  }

  // ---- lifecycle ----

  /** Loads a ROM and resolves with its header info. `opts.save` is the cartridge .sav to start from (optional). */
  async loadRom(rom, { save = null } = {}) {
    this.#assertPlayer();
    if (!(rom instanceof Uint8Array)) throw apiError("ROM_INVALID", "loadRom expects a Uint8Array");
    if (rom.length < 0x200) throw apiError("ROM_INVALID", `ROM is too small (${rom.length} bytes)`);
    await this.#player.loadRom(rom, { save });
    this.#romBytes = rom.slice();
    const info = readRomInfo(rom);
    return { ...info, saveType: this.#player.saves.info?.type ?? "none" };
  }

  start() {
    this.#assertPlayer();
    this.#player.start();
  }

  pause() {
    this.#assertPlayer();
    this.#player.pause();
    this.#emit("paused");
  }

  resume() {
    this.#assertPlayer();
    this.#player.resume();
    this.#emit("resumed");
  }

  /**
   * Restarts the cartridge with the current save (the equivalent of EmulatorJS `restart()`).
   * The worker cannot reload the core in place, so this rebuilds it: it is the only API that costs ~1 s.
   */
  async reset() {
    this.#assertPlayer();
    if (!this.#romBytes) throw apiError("NO_ROM", "load a ROM before resetting");
    const wasRunning = this.#player.running && !this.#player.paused;
    const save = await this.#player.saves.getSaveNow().catch(() => null);
    const old = this.#player;
    this.#player = null;
    await old.saves.dispose?.();
    await old.dispose().catch(() => {});
    this.#ready = false;
    await this.#boot({ threadedRenderer: this.#createOptions.threads !== false });
    await this.#player.loadRom(this.#romBytes, { save });
    if (wasRunning) this.#player.start();
  }

  async dispose() {
    const player = this.#player;
    this.#player = null;
    this.#ready = false;
    this.#listeners.clear();
    if (!player) return;
    await player.saves.dispose?.();
    await player.dispose();
  }

  get running() {
    return !!this.#player?.running;
  }

  get paused() {
    return !!this.#player?.paused;
  }

  // ---- firmware / BIOS (before loadRom) ----

  /**
   * `null` leaves the firmware to the core (built-in, generated at boot). A real dump must be 128/256/512 KB.
   * `settings` overrides the user settings the core writes into the firmware (melonds_override_fw_settings).
   */
  setFirmware(fw, settings = undefined) {
    if (fw != null) {
      if (!(fw instanceof Uint8Array)) throw apiError("FIRMWARE_INVALID", "setFirmware expects a Uint8Array or null");
      if (!FIRMWARE_SIZES.includes(fw.length)) {
        throw apiError("FIRMWARE_INVALID", `firmware must be one of ${FIRMWARE_SIZES.join(" / ")} bytes, got ${fw.length}`);
      }
    }
    this.#firmware = fw ? fw.slice() : null;
    if (fw) this.#queueSystemFile("firmware.bin", fw);
    const set = { melonds_override_fw_settings: settings ? "enabled" : "disabled" };
    if (settings) {
      if (settings.language != null) set.melonds_firmware_language = String(settings.language);
      if (settings.nickname != null) set.melonds_firmware_username = String(settings.nickname).slice(0, 10);
      if (settings.birthday) {
        set.melonds_firmware_birth_month = String(settings.birthday[0]);
        set.melonds_firmware_birth_day = String(settings.birthday[1]);
      }
      if (settings.favoriteColor != null) set.melonds_firmware_favorite_color = String(settings.favoriteColor);
    }
    // The firmware is read during retro_load_game, so the file must already be in /system and the option must point at
    // it. With no file the core falls back to its built-in firmware (config/console.cpp), so an empty value is enough.
    const options = { ...set, melonds_firmware_nds_path: fw ? "firmware.bin" : "" };
    if (fw) options.melonds_sysfile_mode = "native"; // values::NATIVE (config/constants.hpp)
    if (this.#player) for (const [k, v] of Object.entries(options)) this.#player.setCoreOption(k, v);
    else Object.assign(this.#pendingOptions, options);
  }

  /** `null` = FreeBIOS (the default: melonDS's built-in BIOS). */
  setBios(bios) {
    this.#bios = bios ?? null;
    if (!bios) return;
    for (const [key, name] of [["arm7", "bios7.bin"], ["arm9", "bios9.bin"]]) {
      const bytes = bios[key];
      if (bytes == null) continue;
      if (!(bytes instanceof Uint8Array)) throw apiError("BIOS_INVALID", `setBios: ${key} must be a Uint8Array`);
      if (bytes.length !== BIOS_SIZES[key]) {
        throw apiError("BIOS_INVALID", `setBios: ${key} must be ${BIOS_SIZES[key]} bytes, got ${bytes.length}`);
      }
      this.#queueSystemFile(name, bytes);
    }
  }

  #queueSystemFile(name, bytes) {
    const copy = bytes.slice();
    if (this.#player) this.#writeSystemFile(name, copy).catch((error) => this.#emit("error", error));
    else this.#pendingSystemFiles.push({ name, bytes: copy });
  }

  async #writeSystemFile(name, bytes) {
    await this.#player.systemFile(name, bytes);
  }

  // ---- speed ----

  setSpeed(multiplier) {
    this.#assertPlayer();
    const n = Number(multiplier);
    if (!Number.isFinite(n) || n < 0) throw apiError("SPEED_INVALID", `speed must be >= 0, got ${multiplier}`);
    this.#player.setSpeed(n);
  }

  /**
   * Audio dynamic rate control: "off" | "ff" | "always" (default "always", user decision 0.0 #4). At 1x, "always" slows
   * the playback down to at most 0.8x instead of cutting the audio when the emulator cannot keep up; "ff" only acts in
   * fast-forward (the pre-Phase-9 behaviour) and "off" never acts. Returns the normalized mode.
   */
  setAudioDynamicRate(mode) {
    this.#assertPlayer();
    const m = normalizeAudioDynamicRate(mode);
    this.#player.setAudioDynamicRate(m);
    return m;
  }

  /** Frames emulated since loadRom (the `getFrameNum` of EmulatorJS). */
  getFrameCount() {
    return this.#player?.getStats().frameCount ?? 0;
  }

  // ---- video ----

  setLayout(label) {
    this.#assertPlayer();
    this.#player.setLayout(label);
  }

  setScreenGap(px) {
    this.#assertPlayer();
    this.#player.setScreenGap(px);
  }

  setHybridSmallScreen(mode) {
    this.#assertPlayer();
    this.#player.setHybridSmallScreen(mode);
  }

  setPostProcess(shader) {
    this.#assertPlayer();
    const result = this.#player.setPostProcess(shader);
    if (result && result.ok === false) throw apiError("SHADER_INVALID", result.error ?? "post-process shader failed");
  }

  setScaling(opts) {
    this.#assertPlayer();
    this.#player.setScaling(opts);
  }

  async screenshot() {
    if (!this.#canvas) throw apiError("NO_CANVAS", "screenshot needs the canvas given to create()");
    return await new Promise((resolve, reject) => {
      this.#canvas.toBlob((blob) => (blob ? resolve(blob) : reject(apiError("NO_CANVAS", "toBlob returned nothing"))), "image/png");
    });
  }

  getFrame() {
    this.#assertPlayer();
    return this.#player.getFrame();
  }

  captureStream(fps = 60) {
    this.#assertPlayer();
    const state = this.#player.audio?.getStats?.().contextState;
    if (this.#player.audio && state !== "running") {
      throw apiError("AUDIO_NOT_STARTED", "call unlockAudio() from a user gesture before captureStream()");
    }
    return this.#player.captureStream(fps);
  }

  // ---- audio ----

  setVolume(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1) throw new RangeError(`volume must be 0..1, got ${v}`);
    this.#assertPlayer();
    this.#player.setVolume(n);
  }

  setMuted(m) {
    this.#assertPlayer();
    this.#player.setMuted(m);
  }

  unlockAudio() {
    return this.#player?.unlockAudio() ?? Promise.resolve();
  }

  // ---- input ----

  button(button, down, player = 0) {
    if (!BUTTONS.includes(button)) throw apiError("BUTTON_INVALID", `unknown button "${button}"`);
    this.#assertPlayer();
    this.#player.button(button, !!down, player);
  }

  touchFromCanvas(nx, ny, state) {
    this.#assertPlayer();
    this.#player.touchFromCanvas(nx, ny, state);
  }

  attachKeyboard(el, map) {
    this.#assertPlayer();
    return this.#player.attachKeyboard(el, map);
  }

  attachGamepad(opts) {
    this.#assertPlayer();
    return this.#player.attachGamepad(opts);
  }

  attachPointer(el, opts) {
    this.#assertPlayer();
    return this.#player.attachPointer(el, opts);
  }

  /** Microphone: pending (needs the libretro microphone interface in core/host, Phase 7/10). */
  setMicInput() {
    throw apiError("MIC_UNSUPPORTED", "the microphone host side is not implemented yet");
  }

  // ---- saves and states ----

  getSave() {
    return this.#player?.saves.getSave() ?? null;
  }

  async getSaveNow() {
    this.#assertPlayer();
    return this.#player.saves.getSaveNow();
  }

  async loadSave(bytes) {
    this.#assertPlayer();
    return this.#player.saves.loadSave(bytes);
  }

  onSave(cb, debounceMs) {
    this.#assertPlayer();
    return this.#player.saves.onSave(cb, debounceMs);
  }

  async saveState() {
    this.#assertPlayer();
    return this.#player.saves.saveState();
  }

  async loadState(bytes) {
    this.#assertPlayer();
    return this.#player.saves.loadState(bytes);
  }

  // ---- cheats ----

  async setCheat(id, enabled, code) {
    this.#assertPlayer();
    return this.#player.setCheat(id, !!enabled, code);
  }

  async clearCheats() {
    this.#assertPlayer();
    return this.#player.clearCheats();
  }

  // ---- stats and events ----

  getStats() {
    if (!this.#player) return { fps: 0, emuMs: 0, renderMs: 0, audioBufferMs: 0, threads: false };
    const s = this.#player.getStats();
    const costs = s.drawCosts ?? [];
    const renderMs = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    return {
      fps: s.emuFps ?? 0,
      emuMs: s.emuMs ?? 0,
      renderMs,
      audioBufferMs: s.audioBufferMs ?? 0,
      threads: (s.workers ?? 0) > 0,
    };
  }

  on(event, cb) {
    if (event === "ready" && this.#ready) {
      queueMicrotask(() => {
        try {
          cb();
        } catch (error) {
          this.#emit("error", error);
        }
      });
      return () => {};
    }
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, (set = new Set()));
    set.add(cb);
    return () => set.delete(cb);
  }

  #emit(event, payload) {
    for (const cb of this.#listeners.get(event) ?? []) {
      try {
        cb(payload);
      } catch (error) {
        if (event !== "error") this.#emit("error", error);
      }
    }
  }

  #assertPlayer() {
    if (!this.#player) {
      if (this.#ready) throw apiError("DISPOSED", "this MelonDS instance was disposed");
      throw apiError("NO_PLAYER", "create() the MelonDS instance first");
    }
  }
}

export default MelonDS;
