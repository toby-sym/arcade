// Phase 5 input: buttons, keyboard, gamepad and pointer/touch -> a small SharedArrayBuffer the emulation worker reads
// right before every mds_run_frame (no postMessage queue, so no extra latency and several events in one frame collapse
// into the newest state). No DOM access at import time: everything here also loads in Node for the unit tests.
//
// Space contract (verified in third_party/melonds-ds/src/libretro/screenlayout.cpp:312-319 and input/cursor.cpp):
//  * the pointer is sent in the space of the frame AS DISPLAYED (already rotated by the renderer), normalised to
//    -32767..32767; the core itself applies layout, gap, hybrid mode AND rotation. JS must NOT rotate anything.
//  * the visible canvas is exactly the displayed frame (js/renderer.js fitCanvas), so (clientX - rect.left) / rect.width
//    is the normalised position. `contentFit` handles the case of a letterboxed element anyway.

/** Bit index = RETRO_DEVICE_ID_JOYPAD_* (libretro.h). 0..11 is also the numbering of the online-room messages (section 5). */
export const JOYPAD_BIT = Object.freeze({
  B: 0, Y: 1, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7, A: 8, X: 9, L: 10, R: 11,
});
const L2 = 12, L3 = 14; // extra ids the core reads (input/input.cpp input_descriptors, joypad.cpp)

/**
 * Button -> bit mask. LID and MIC are the extras of API_CONTRACT.md / the core:
 *  - LID  = L2 + Y: joypad.cpp toggles the lid on the rising edge of Y while L2 is held. Y also reaches the game for that
 *    press (the core reads one Y bit for both), and the lid TOGGLES: releasing the button does nothing.
 *  - MIC  = L3: "Microphone" descriptor; only meaningful once the core's microphone input is configured (Phase 4+).
 */
export const BUTTON_MASK = Object.freeze({
  ...Object.fromEntries(Object.entries(JOYPAD_BIT).map(([k, b]) => [k, 1 << b])),
  LID: (1 << L2) | (1 << JOYPAD_BIT.Y),
  MIC: 1 << L3,
});
export const BUTTONS = Object.freeze(Object.keys(BUTTON_MASK));

/** Online-room index (API_CONTRACT.md section 5) -> Button; the adapter uses it for `{player, index, value}`. */
export const INDEX_TO_BUTTON = Object.freeze(["B", "Y", "SELECT", "START", "UP", "DOWN", "LEFT", "RIGHT", "A", "X", "L", "R"]);

/** Default keyboard map (API_CONTRACT.md section 5), keyed by KeyboardEvent.code (physical key, layout independent). */
export const DEFAULT_KEYMAP = Object.freeze({
  ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
  KeyZ: "A", KeyX: "B", KeyA: "X", KeyS: "Y", KeyQ: "L", KeyE: "R",
  Enter: "START", KeyV: "SELECT",
});

/**
 * Standard-mapping gamepad (https://w3c.github.io/gamepad/#remapping) -> DS. Nintendo-style positions: the DS "A" is the
 * RIGHT face button, "B" the bottom one, "X" the top one, "Y" the left one (so it feels like a DS, not like an Xbox pad).
 * Index -> Button; the left stick also drives the D-pad (see GAMEPAD_STICK_THRESHOLD).
 */
export const DEFAULT_PADMAP = Object.freeze({
  0: "B", 1: "A", 2: "Y", 3: "X", // bottom, right, left, top face buttons
  4: "L", 5: "R",                 // bumpers
  8: "SELECT", 9: "START",        // back/select, start
  12: "UP", 13: "DOWN", 14: "LEFT", 15: "RIGHT",
});
export const GAMEPAD_STICK_THRESHOLD = 0.5;

const maskOf = (name) => {
  const m = BUTTON_MASK[name];
  if (m === undefined) throw Object.assign(new Error(`Unknown button "${name}"`), { code: "BUTTON_INVALID" });
  return m;
};

/** Pure: gamepad state -> button mask. Accepts a Gamepad or any {buttons:[{pressed}|number], axes:[]}. */
export function gamepadToMask(pad, { map = DEFAULT_PADMAP, threshold = GAMEPAD_STICK_THRESHOLD, stick = true } = {}) {
  if (!pad) return 0;
  let mask = 0;
  const buttons = pad.buttons ?? [];
  for (const [index, name] of Object.entries(map)) {
    const b = buttons[+index];
    if (b && (typeof b === "number" ? b > 0.5 : b.pressed)) mask |= maskOf(name);
  }
  if (stick) {
    const [x = 0, y = 0] = pad.axes ?? [];
    if (x <= -threshold) mask |= BUTTON_MASK.LEFT;
    if (x >= threshold) mask |= BUTTON_MASK.RIGHT;
    if (y <= -threshold) mask |= BUTTON_MASK.UP;
    if (y >= threshold) mask |= BUTTON_MASK.DOWN;
  }
  return mask;
}

/** Pure: KeyboardEvent-like -> Button name, trying `code` then `key` (single characters upper-cased). */
export function keyToButton(e, map = DEFAULT_KEYMAP) {
  if (e.code && map[e.code]) return map[e.code];
  const key = e.key, up = key && key.length === 1 ? key.toUpperCase() : key;
  return (key && (map[key] || map[up] || map["Key" + up])) || null;
}

// Keys that must never scroll / activate the page while playing, even if the user remapped them away.
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
const isTextTarget = (t) => !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName ?? ""));

// ---- pointer maths ------------------------------------------------------------------------------------------------

/** libretro pointer range. */
export const POINTER_MAX = 32767;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0..1 -> -32767..32767, clamped. */
export function toPointerSpace(n) {
  return Math.round((clamp01(n) * 2 - 1) * POINTER_MAX);
}

/**
 * Client coordinates -> 0..1 over the drawn frame. `rect` is canvas.getBoundingClientRect(). If the element is bigger than
 * the picture (object-fit: contain style bars), pass `contentFit = {width, height}` (the frame size) to subtract the bars.
 * `inside` is false when the point is outside the picture; nx/ny are always clamped to 0..1.
 */
export function normalizeClient(clientX, clientY, rect, contentFit = null) {
  let { left, top, width, height } = rect;
  if (contentFit && contentFit.width > 0 && contentFit.height > 0 && width > 0 && height > 0) {
    const s = Math.min(width / contentFit.width, height / contentFit.height);
    const w = contentFit.width * s, h = contentFit.height * s;
    left += (width - w) / 2; top += (height - h) / 2; width = w; height = h;
  }
  if (!(width > 0 && height > 0)) return { nx: 0, ny: 0, inside: false };
  const fx = (clientX - left) / width, fy = (clientY - top) / height;
  return { nx: clamp01(fx), ny: clamp01(fy), inside: fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1 };
}

// ---- shared state -------------------------------------------------------------------------------------------------

/** Int32 slots of the shared input buffer. */
export const SLOT = Object.freeze({ MASK: 0, X: 1, Y: 2, DOWN: 3, SEQ: 4, TAP_X: 5, TAP_Y: 6, TAP_BITS: 7 });
export const INPUT_BUFFER_BYTES = 8 * 4;

export function createInputBuffer() {
  return new SharedArrayBuffer(INPUT_BUFFER_BYTES);
}

/** Main-thread side: merges sources (API, keyboard, gamepad) and the pointer into the shared buffer. */
export class InputState {
  constructor(buffer = createInputBuffer()) {
    this.buffer = buffer;
    this.i32 = new Int32Array(buffer);
    this.sources = { api: 0, keyboard: 0, pad: 0 };
    this.owner = null;      // pointerId that currently owns the DS touch (first finger / mouse wins)
    this.lastPos = { nx: 0.5, ny: 0.5 };
  }

  get mask() { return Atomics.load(this.i32, SLOT.MASK); }
  get pointer() {
    const i = this.i32;
    return { x: Atomics.load(i, SLOT.X), y: Atomics.load(i, SLOT.Y), pressed: Atomics.load(i, SLOT.DOWN) === 1 };
  }

  #commit() {
    const merged = this.sources.api | this.sources.keyboard | this.sources.pad;
    const prev = Atomics.load(this.i32, SLOT.MASK);
    const rising = merged & ~prev;
    // TAP_BITS remembers presses shorter than one emulated frame; the worker ORs and clears it, so a quick tap is never lost.
    if (rising) Atomics.or(this.i32, SLOT.TAP_BITS, rising);
    Atomics.store(this.i32, SLOT.MASK, merged);
  }
  #setSource(name, mask) { if (this.sources[name] !== mask) { this.sources[name] = mask; this.#commit(); } }

  /** MelonDS.button(b, down). */
  button(name, down) {
    const m = maskOf(name);
    this.#setSource("api", down ? this.sources.api | m : this.sources.api & ~m);
  }
  setKeyboardMask(mask) { this.#setSource("keyboard", mask); }
  setGamepadMask(mask) { this.#setSource("pad", mask); }
  releaseAll() {
    this.sources = { api: 0, keyboard: 0, pad: 0 };
    this.#commit();
    this.releaseTouch();
  }

  /** MelonDS.touchFromCanvas(nx, ny, state): nx, ny in 0..1 over the drawn frame. */
  touchFromCanvas(nx, ny, state) {
    if (state !== "down" && state !== "move" && state !== "up") {
      throw Object.assign(new Error(`touch state must be "down", "move" or "up" (got ${state})`), { code: "TOUCH_INVALID" });
    }
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) throw Object.assign(new Error("touch coordinates must be finite"), { code: "TOUCH_INVALID" });
    const x = toPointerSpace(nx), y = toPointerSpace(ny), i = this.i32;
    this.lastPos = { nx: clamp01(nx), ny: clamp01(ny) };
    Atomics.store(i, SLOT.X, x); Atomics.store(i, SLOT.Y, y);
    if (state === "down") {
      Atomics.store(i, SLOT.TAP_X, x); Atomics.store(i, SLOT.TAP_Y, y);
      Atomics.store(i, SLOT.DOWN, 1);
      Atomics.add(i, SLOT.SEQ, 1);
    } else if (state === "up") {
      Atomics.store(i, SLOT.DOWN, 0);
    } // "move" keeps the pressed state: it drags while down, hovers (cursor only) while up
  }
  /** Pointer left the picture without touching: the core reads (0, 0) as "not over the play area". */
  pointerAway() {
    Atomics.store(this.i32, SLOT.X, 0); Atomics.store(this.i32, SLOT.Y, 0); Atomics.store(this.i32, SLOT.DOWN, 0);
  }
  releaseTouch() { this.owner = null; Atomics.store(this.i32, SLOT.DOWN, 0); }

  // ---- DOM attachments (browser only) ----

  /** Keyboard -> buttons. Returns the detach function. `el` defaults to `document`. */
  attachKeyboard(el = globalThis.document, map = DEFAULT_KEYMAP) {
    const held = new Map(); // event.code -> Button
    const recompute = () => { let m = 0; for (const b of held.values()) m |= maskOf(b); this.setKeyboardMask(m); };
    const onDown = (e) => {
      if (isTextTarget(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      const b = keyToButton(e, map);
      if (b || GAME_KEYS.has(e.code)) e.preventDefault(); // no scrolling with arrows / space while playing
      if (!b || e.repeat) return;
      held.set(e.code || e.key, b); recompute();
    };
    const onUp = (e) => {
      const key = e.code || e.key;
      if (GAME_KEYS.has(e.code) && !isTextTarget(e.target)) e.preventDefault();
      if (held.delete(key)) recompute();
    };
    const onBlur = () => { held.clear(); recompute(); }; // a key released while another window had focus would stick
    el.addEventListener("keydown", onDown); el.addEventListener("keyup", onUp);
    globalThis.addEventListener?.("blur", onBlur);
    return () => { el.removeEventListener("keydown", onDown); el.removeEventListener("keyup", onUp); globalThis.removeEventListener?.("blur", onBlur); onBlur(); };
  }

  /**
   * Gamepad API (standard mapping only: pads with another `mapping` are ignored, their indices mean nothing portable).
   * Polls on requestAnimationFrame; every connected standard pad is OR-ed together. Returns the detach function.
   */
  attachGamepad({ map = DEFAULT_PADMAP, threshold = GAMEPAD_STICK_THRESHOLD, getGamepads = () => navigator.getGamepads?.() ?? [], raf = (f) => requestAnimationFrame(f), caf = (h) => cancelAnimationFrame(h) } = {}) {
    let handle = 0, alive = true;
    const poll = () => {
      if (!alive) return;
      let mask = 0;
      for (const pad of getGamepads()) if (pad && pad.connected !== false && pad.mapping === "standard") mask |= gamepadToMask(pad, { map, threshold });
      this.setGamepadMask(mask);
      handle = raf(poll);
    };
    handle = raf(poll);
    return () => { alive = false; caf(handle); this.setGamepadMask(0); };
  }

  /**
   * Mouse / touch / pen on the visible canvas via Pointer Events. One pointer owns the DS touch at a time (the DS has a single
   * touch point): the first to go down wins, other fingers are ignored until it lifts. Pointer capture means a release outside
   * the canvas still arrives (clamped to the edge) so the stylus never stays stuck. Returns the detach function.
   */
  attachPointer(canvas, { contentFit = null } = {}) {
    canvas.style.touchAction = "none"; // otherwise the browser steals touch moves for scrolling / zoom
    const norm = (e) => normalizeClient(e.clientX, e.clientY, canvas.getBoundingClientRect(), typeof contentFit === "function" ? contentFit() : contentFit);
    const onDown = (e) => {
      if (this.owner !== null) return;                      // another pointer owns the touch
      if (e.pointerType === "mouse" && e.button !== 0) return; // left button only
      e.preventDefault();
      this.owner = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
      const { nx, ny } = norm(e);
      this.touchFromCanvas(nx, ny, "down");
    };
    const onMove = (e) => {
      if (this.owner !== null && e.pointerId !== this.owner) return;
      if (this.owner === null && e.pointerType !== "mouse") return; // hover only makes sense for a mouse
      const { nx, ny } = norm(e);
      this.touchFromCanvas(nx, ny, "move");
    };
    const onUp = (e) => {
      if (e.pointerId !== this.owner) return;
      const { nx, ny } = norm(e);
      this.touchFromCanvas(nx, ny, "up");
      this.owner = null;
      if (e.pointerType !== "mouse") this.pointerAway(); // a lifted finger is no longer "over" anything
    };
    const onCancel = (e) => { if (e.pointerId === this.owner) { this.releaseTouch(); this.pointerAway(); } };
    const onLeave = (e) => { if (this.owner === null && e.pointerType === "mouse") this.pointerAway(); };
    const onMenu = (e) => e.preventDefault();
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("contextmenu", onMenu);
    return () => {
      for (const [n, f] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onCancel], ["pointerleave", onLeave], ["contextmenu", onMenu]]) canvas.removeEventListener(n, f);
      this.releaseTouch(); this.pointerAway();
    };
  }
}

/** Worker side: turns the shared buffer into what to hand to mds_set_key_mask / mds_set_pointer for the next frame. */
export class InputReader {
  constructor(buffer) {
    this.i32 = new Int32Array(buffer);
    this.lastSeq = Atomics.load(this.i32, SLOT.SEQ);
  }
  /** Call once per emulated frame, right before mds_run_frame. */
  read() {
    const i = this.i32;
    // Presses shorter than a frame: the held mask is already back to 0 but TAP_BITS remembers them for exactly one frame.
    const mask = Atomics.load(i, SLOT.MASK) | Atomics.exchange(i, SLOT.TAP_BITS, 0);
    const seq = Atomics.load(i, SLOT.SEQ);
    const down = Atomics.load(i, SLOT.DOWN) === 1;
    let x = Atomics.load(i, SLOT.X), y = Atomics.load(i, SLOT.Y), pressed = down;
    if (!down && seq !== this.lastSeq) { // tapped and released within one frame: report one frame of touch at the tap position
      x = Atomics.load(i, SLOT.TAP_X); y = Atomics.load(i, SLOT.TAP_Y); pressed = true;
    }
    this.lastSeq = seq;
    return { mask, x, y, pressed };
  }
}
