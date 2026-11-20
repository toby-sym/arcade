// Emulation worker: owns the wasm module, runs mds_run_frame at the console's pace and publishes each new composed
// frame into the shared ring (js/frame-ring.js). Module worker; the main thread only draws.
import { RingWriter } from "./frame-ring.js";
import { AudioRingWriter } from "./audio-ring.js";
import { InputReader } from "./input.js";
import { createWorkerSaves, describeSaveType, getSave as readCartSave, saveStatus } from "./saves-core.js"; // phase 6
import { cheatHandlers } from "./cheats-worker.js"; // Phase 8

const DS_FPS = 59.8261; // fallback; the real value comes from retro_get_system_av_info (mds_get_fps)
let M = null, ring = null, running = false, speed = 1, loopToken = 0;
let inputReader = null; // Phase 5: shared input state (js/input.js), read before every frame
let wPtr = 0, hPtr = 0, sPtr = 0, strPtr = 0;
let lastSerial = -1, lastGeomSerial = -1;
// Audio (phase 4). `feeding` = the audio clock is the metronome: the AudioWorklet is alive (its heartbeat advances), speed is 1x
// and we are not paused. Otherwise the timer paces the emulator and the audio produced is discarded.
const AUDIO_MAX_FRAMES = 2048; // the core never delivers more than this per retro_run (core.cpp RenderAudio)
const ALIVE_MS = 150;          // heartbeat older than this => AudioContext suspended/absent => fall back to the timer
const AUDIBLE_MAX_SPEED = 2;   // up to here the audio keeps playing (sped up, higher pitch); above it, or "unlimited" (0), it is muted
let aw = null, audioPtr = 0, audioLatencyMs = 80, feeding = false, lastTick = -1, lastTickAt = 0, srcRate = 32728.498;
// Audio dynamic rate control (Phase 9, user decision 0.0 #4): "off" | "ff" | "always", default "always". Kept here so it
// can be set before or after loadRom; it only touches the shared ring, never the emulated behaviour.
const DRC_MODES = { off: 0, ff: 1, always: 2 };
let audioDynamicRate = "always";
const applyDynamicRate = () => { aw?.setDrcMode(DRC_MODES[audioDynamicRate]); };
let saves = null; // phase 6: save RAM / savestate handlers + change detector (js/saves-core.js)
const stats = { frames: 0, published: 0, emuMs: 0, windowFrames: 0, windowStart: 0 };

// ---- Phase 9b: three JS-only loop optimizations + test-only A/B switch and profiler (never changes the emulation) ----
// Each optimization is ON by default (that is the new behaviour). The `debugOpt` message can turn any of them off so the
// same build can measure "before" and "after"; all three are exact no-ops at 1x (1x keeps the pre-Phase-9b path).
const OPT = { publishDecimation: true, savesCadence: true, yieldEvery2: true };
// Minimum wall time between two published frames in FF/unlimited. The guide suggested ~16.7 ms, but measured: with a
// 16.7 ms threshold and an emulator at 60-120 fps the publication period quantises to 2 frames (~22-27 ms), so the main
// thread only receives ~40-45 frames/s and drawing drops from 60 to ~40 fps in fast-forward (a visible regression).
// With 8.3 ms (120 frames/s) decimation only kicks in above ~120 emulated fps, where the display cannot use the extra
// frames anyway and the copy/postMessage cost plus the main-thread flood are real (see tests/BENCH.md). At or below
// ~120 fps every frame is published, exactly like before.
const FRAME_PUBLISH_MS = 1000 / 120;
let lastPublishAt = -Infinity;      // performance.now() of the last frame copied to the ring
let lastYieldAt = 0, framesSinceYield = 0, savesSinceTick = 0, romLoaded = false;
// Test-only profiler: accumulated ms per stats window, published as `prof` in the `stats` message when enabled.
let profOn = false;
const PROF = { iterations: 0, frames: 0, windowStart: 0, core: 0, publish: 0, audio: 0, saves: 0, yield: 0, wait: 0 };
const resetProf = () => {
  PROF.iterations = PROF.frames = PROF.core = PROF.publish = PROF.audio = PROF.saves = PROF.yield = PROF.wait = 0;
  PROF.windowStart = performance.now();
};
resetProf();

const post = (msg) => self.postMessage(msg);
// Fill the audio ring aims for. Scaled with the playback speed so the cushion stays `audioLatencyMs` of REAL time:
// at 2x the worklet drains twice as fast, and 80 ms of audio would last only 40 ms before a hiccup becomes an underrun.
const applyAudioTarget = () => { if (aw) aw.setTargetFrames(Math.round((audioLatencyMs / 1000) * srcRate * (speed >= 1 ? speed : 1))); };
const cstr = (s) => { const b = new TextEncoder().encode(s + "\0"); const p = M._malloc(b.length); M.HEAPU8.set(b, p); return p; };
function setOption(key, value) {
  const k = cstr(key), v = cstr(value);
  M._mds_set_option(k, v);
  M._free(k); M._free(v);
}
const workerCount = () => (M?.PThread ? Object.keys(M.PThread.pthreads).length : -1);

async function init({ ring: sab, input, audioRing, audioLatencyMs: lat, moduleUrl, verbose, options, audioDynamicRate: dynamicRate }) {
  ring = new RingWriter(sab);
  if (DRC_MODES[dynamicRate] != null) audioDynamicRate = dynamicRate; // before the ring exists it is just remembered
  if (audioRing) { aw = new AudioRingWriter(audioRing); aw.setPaused(true); applyDynamicRate(); }
  if (lat) audioLatencyMs = lat;
  if (input) inputReader = new InputReader(input);
  const { default: createModule } = await import(moduleUrl);
  M = await createModule({
    print: (t) => post({ type: "log", level: "info", text: String(t) }),
    printErr: (t) => post({ type: "log", level: "err", text: String(t) }),
  });
  [wPtr, hPtr, sPtr, strPtr] = [M._malloc(4), M._malloc(4), M._malloc(4), M._malloc(4)];
  audioPtr = M._malloc(AUDIO_MAX_FRAMES * 4);
  if (M._mds_create(verbose ? 1 : 0) !== 0) throw new Error("mds_create failed");
  for (const [k, v] of Object.entries(options ?? {})) setOption(k, v);
  saves = createWorkerSaves(M, post);
  post({ type: "ready", sharedMemory: M.HEAPU8.buffer instanceof SharedArrayBuffer });
}

function loadRom(bytes, save) {
  // The core keeps ~3 copies of the ROM in the wasm heap (our buffer + NDSCart::ParseROM + CartRetail), so a 512 MB ROM
  // does not fit in a 1 GiB build and Emscripten aborts (RuntimeError: unreachable / Aborted) instead of returning an
  // error code. Convert that trap into a clean ROM_TOO_LARGE rejection: the page/adapter then fails fast with a useful
  // message instead of staying stuck in "Arrancando…" forever (API_CONTRACT.md:277). Rebuild with
  // -sMAXIMUM_MEMORY=2147483648 (scripts/build-host.sh) to make big ROMs fit.
  let p = 0, sp = 0;
  try {
    p = M._malloc(bytes.length);
    M.HEAPU8.set(bytes, p);
    sp = save?.length ? M._malloc(save.length) : 0; // optional .sav, applied before the first frame
    if (sp) M.HEAPU8.set(save, sp);
    const rc = M._mds_load_rom(p, bytes.length, sp, sp ? save.length : 0);
    if (rc !== 0) throw Object.assign(new Error(`mds_load_rom failed (${rc})`), { code: "ROM_INVALID" });
  } catch (error) {
    try { if (p) M._free(p); } catch { /* the runtime is already aborted: freeing is best effort */ }
    try { if (sp) M._free(sp); } catch { /* same */ }
    if (error.code === "ROM_INVALID") throw error;
    throw Object.assign(
      new Error("mds_load_rom aborted: the ROM does not fit in the wasm heap (MAXIMUM_MEMORY). Rebuild the host with -sMAXIMUM_MEMORY=2147483648 (2 GiB) - see scripts/build-host.sh"),
      { code: "ROM_TOO_LARGE", cause: error },
    );
  }
  try { M._free(p); } catch { /* the core copied what it needs; a dead runtime cannot free, not worth failing */ }
  try { if (sp) M._free(sp); } catch { /* same */ }
  romLoaded = true;
  srcRate = M._mds_get_sample_rate() || srcRate;
  if (aw) { aw.setSourceRate(srcRate); applyAudioTarget(); }
  saves.reset();
  const saveLen = readCartSave(M)?.length ?? 0;
  post({ type: "loaded", fps: M._mds_get_fps(), sampleRate: srcRate, workers: workerCount(), saveLen, saveType: describeSaveType(saveLen), saveStatus: saveStatus(M) });
}

function applyInput() {
  if (!inputReader) return;
  const s = inputReader.read();
  M._mds_set_key_mask(s.mask);
  M._mds_set_pointer(s.x, s.y, s.pressed ? 1 : 0);
}

function publishFrame(force = false) {
  const serial = M._mds_get_frame_serial();
  if (serial === lastSerial) return; // data == NULL: the core asked to repeat the previous frame, nothing new to show
  // Phase 9b (a): in fast-forward/unlimited the screen cannot use more than ~60 fps, so copying the composed frame into
  // the ring and posting one message per emulated frame is pure overhead when the emulator runs at 100+ fps. Publish at
  // most one frame every FRAME_PUBLISH_MS; `force` (pause/stop) publishes the newest one immediately so the screen is
  // never stale. The duplicated-serial detection above is untouched, and at 1x this branch does not apply at all.
  if (!force && speed !== 1 && OPT.publishDecimation && performance.now() - lastPublishAt < FRAME_PUBLISH_MS) return;
  lastSerial = serial;
  const p = M._mds_get_frame(wPtr, hPtr, sPtr);
  if (!p) return;
  const width = M.HEAPU32[wPtr >> 2], height = M.HEAPU32[hPtr >> 2], stride = M.HEAPU32[sPtr >> 2];
  ring.target.set(M.HEAPU8.subarray(p, p + stride * height)); // the single copy: wasm heap -> ring slot, stride preserved
  ring.publish({ width, height, stride, rotation: M._mds_get_frame_rotation(), geometrySerial: M._mds_get_geometry_serial() });
  lastPublishAt = performance.now();
  post({ type: "frame" }); // lets the main thread queue the frame right away (see VideoPlayer.#pump) instead of waiting for the next rAF
}

// Phase 9b (b): cartridge SRAM change detector. saves.tick() already polls the core only every 10 calls, so calling it
// every 3 frames in fast-forward/unlimited means one poll every 30 frames (~100-170 ms of game time at 2x-3x): plenty for
// an autosave, and 3x fewer calls into wasm. At 1x it is called every frame, exactly as before. Pausing still does a
// forced tick (handler `pause`) so a change made in the last frames is not lost.
function tickSaves() {
  const every = speed === 1 || !OPT.savesCadence ? 1 : 3;
  if (++savesSinceTick >= every) { savesSinceTick = 0; saves.tick(); }
}

// Moves the audio the core produced during the last mds_run_frame into the shared ring, or drops it when not feeding.
function drainAudio() {
  if (!feeding) { M._mds_flush_audio(); return; }
  const n = M._mds_get_audio(audioPtr, AUDIO_MAX_FRAMES);
  if (n) aw.write(M.HEAP16.subarray(audioPtr >> 1, (audioPtr >> 1) + n * 2), n);
}

// Decides who is the metronome. Called once per loop iteration.
function refreshAudioMode(now) {
  if (!aw) return;
  const tick = aw.tick;
  if (tick !== lastTick) { lastTick = tick; lastTickAt = now; }
  const should = speed >= 1 && speed <= AUDIBLE_MAX_SPEED && now - lastTickAt < ALIVE_MS;
  if (should !== feeding) {
    feeding = should;
    aw.setPaused(!feeding);            // false: the worklet (re)primes and fades in; true: it fades out and drops what is left
    M._mds_flush_audio();
    post({ type: "audio-mode", feeding, speed });
  }
}

const channel = new MessageChannel();
const yieldToEvents = () => new Promise((resolve) => { channel.port1.onmessage = resolve; channel.port2.postMessage(0); });
const sleepSab = new Int32Array(new SharedArrayBuffer(4));

async function loop(token) {
  const frameMs = () => 1000 / (M._mds_get_fps() || DS_FPS) / (speed || 1);
  let next = performance.now();
  stats.windowStart = next;
  lastYieldAt = next;
  framesSinceYield = 0;
  let lastStats = next;
  while (running && token === loopToken) {
    if (profOn) PROF.iterations++;
    const now = performance.now();
    refreshAudioMode(now);
    let stepped = false;
    if (feeding) {
      // The audio clock is the metronome: the worklet drains the ring in real time, we emulate a frame whenever the fill
      // is below target. Steady state: fill oscillates between target and target + one DS frame (~547 audio frames).
      const fill = aw.fill, target = aw.targetFrames;
      if (fill < target) stepped = stepFrame();
      else {
        const waitMs = Math.min(8, Math.max(0.5, ((fill - target) / srcRate) * 1000));
        if (profOn) { const a = performance.now(); Atomics.wait(sleepSab, 0, 0, waitMs); PROF.wait += performance.now() - a; }
        else Atomics.wait(sleepSab, 0, 0, waitMs);
      }
      next = performance.now(); // keep the timer base fresh in case we fall back to it
    } else {
      stepped = stepFrame();
      if (speed !== 0) { // timer-paced: sleep (Atomics.wait is precise in workers) until the next frame is due
        next += frameMs();
        const wait = next - performance.now();
        if (wait > 0) {
          if (profOn) { const a = performance.now(); Atomics.wait(sleepSab, 0, 0, wait); PROF.wait += performance.now() - a; }
          else Atomics.wait(sleepSab, 0, 0, wait);
        } else if (wait < -100) next = performance.now(); // fell far behind: do not try to catch up in a burst
      }
    }
    const t1 = performance.now();
    if (t1 - lastStats >= 500) {
      postStats(t1);
      lastStats = t1;
    }
    // Phase 9b (c): in fast-forward/unlimited, yield to the message loop every other emulated frame instead of every
    // frame: one less macrotask hop per frame, at the cost of up to ~1 frame (~8-17 ms) of extra latency for control
    // messages (speed changes, pause, options) in FF. The time guard also yields when frames are scarce (the audio-clock
    // loop can wait many iterations between frames), so messages never starve. At 1x: every frame, as before.
    if (stepped) framesSinceYield++;
    const yieldEvery = speed !== 1 && OPT.yieldEvery2 ? 2 : 1;
    if (framesSinceYield >= yieldEvery || t1 - lastYieldAt > 40) {
      framesSinceYield = 0;
      if (profOn) { const a = performance.now(); await yieldToEvents(); PROF.yield += performance.now() - a; }
      else await yieldToEvents(); // let setOption / pause messages in between frames
      lastYieldAt = performance.now();
    }
  }
}

function postStats(now) {
  const msg = { type: "stats", fps: (stats.windowFrames * 1000) / (now - stats.windowStart), emuMs: stats.windowFrames ? stats.emuMs / stats.windowFrames : 0, frames: Number(M._mds_get_frame_count()), duplicated: Number(M._mds_get_duplicated_frames()), workers: workerCount(), feeding, hostAudio: { total: Number(M._mds_get_audio_frames_total()), overruns: Number(M._mds_get_audio_overruns()), underruns: Number(M._mds_get_audio_underruns()) } };
  if (profOn) {
    // Test-only breakdown of the loop, per window (ms). Meaning:
    //   core    applyInput() + mds_run_frame()      publish  copying the frame to the ring + postMessage("frame")
    //   audio   drainAudio()                        saves    the (cadenced) SRAM change detector
    //   yield   awaiting the macrotask yield        wait     Atomics.wait() pacing the loop
    //   iterations  loop iterations                 frames   emulated frames in the window
    msg.prof = { iterations: PROF.iterations, frames: PROF.frames, windowMs: now - PROF.windowStart, core: PROF.core, publish: PROF.publish, audio: PROF.audio, saves: PROF.saves, yield: PROF.yield, wait: PROF.wait, opt: { ...OPT }, speed };
    resetProf();
  }
  post(msg);
  stats.windowFrames = 0; stats.emuMs = 0; stats.windowStart = now;
}

function stepFrame() {
  const t0 = performance.now();
  const prof = profOn;
  let a = 0, tCore = 0, tPublish = 0, tAudio = 0, tSaves = 0;
  if (prof) a = performance.now();
  applyInput(); // Phase 5: latch keys/pointer right before the frame that consumes them (also for debugBurst)
  M._mds_run_frame();
  if (prof) { tCore = performance.now() - a; a = performance.now(); }
  publishFrame();
  if (prof) { tPublish = performance.now() - a; a = performance.now(); }
  drainAudio();
  if (prof) { tAudio = performance.now() - a; a = performance.now(); }
  tickSaves(); // Phase 6: SRAM change detector, after the frame's writes (cadence scaled in FF, Phase 9b (b))
  if (prof) { PROF.core += tCore; PROF.publish += tPublish; PROF.audio += tAudio; PROF.saves += performance.now() - a; PROF.frames++; }
  stats.emuMs += performance.now() - t0; stats.frames++; stats.windowFrames++;
  return true;
}

function start() {
  if (running) return;
  running = true; loop(++loopToken);
}
function stop() {
  // Phase 9b (a): with publish decimation the last emulated frame may not have been copied yet; publish it now so the
  // screen freezes on the newest picture instead of an older one (pause/stop/dispose). No-op at 1x and when there is no ROM.
  if (running && romLoaded && M) { try { publishFrame(true); } catch { /* shutting down: not worth failing */ } }
  running = false; loopToken++;
  if (aw) { aw.setPaused(true); feeding = false; if (M) M._mds_flush_audio(); }
}

const handlers = {
  init, loadRom: ({ rom, save }) => loadRom(rom, save),
  options: ({ set }) => { for (const [k, v] of Object.entries(set)) setOption(k, v); },
  start, pause: () => { stop(); saves.tick(true); }, resume: start, // phase 6: one last SRAM check when pausing
  ...cheatHandlers(() => M), // Phase 8: cheat, cheatClear
  // Phase 7/10: drop a file into the core's system directory (firmware.bin, bios7.bin, bios9.bin) before loadRom.
  systemFile: ({ name, bytes }) => {
    if (typeof M._mds_write_system_file !== "function") {
      throw Object.assign(new Error("mds_write_system_file is not exported by this wasm build"), { code: "SYSTEM_FILE_UNSUPPORTED" });
    }
    const n = cstr(name);
    const p = M._malloc(bytes.length);
    M.HEAPU8.set(bytes, p);
    const rc = M._mds_write_system_file(n, p, bytes.length);
    M._free(p); M._free(n);
    if (rc !== 0) throw Object.assign(new Error(`mds_write_system_file(${name}) failed (${rc})`), { code: "SYSTEM_FILE_FAILED" });
    return { name, length: bytes.length };
  },
  speed: ({ value }) => { speed = value; aw?.setPlayRate(value >= 1 ? value : 1); applyAudioTarget(); },
  // Phase 9: "off" | "ff" | "always" (default "always"); the worker keeps it and applies it whenever the audio ring exists.
  audioDynamicRate: ({ mode }) => {
    if (DRC_MODES[mode] == null) throw Object.assign(new Error(`audioDynamicRate must be "off" | "ff" | "always", got ${mode}`), { code: "AUDIO_DYNAMIC_RATE_INVALID" });
    audioDynamicRate = mode;
    applyDynamicRate();
  },
  // Test hooks for the stress measurements in tests/phase4-browser.mjs (not part of the public API).
  debugStall: ({ ms }) => { Atomics.wait(sleepSab, 0, 0, ms); },   // block the producer: provokes an underrun
  debugBurst: ({ frames }) => { if (!feeding) return; for (let i = 0; i < frames; i++) stepFrame(); }, // run ahead: provokes an overrun / trim
  // Phase 9b test hooks (not part of the public API): A/B switch for the three loop optimizations and the loop profiler.
  // debugOpt is valid at any time (the three switches are read every iteration); false = pre-Phase-9b behaviour.
  debugOpt: ({ set }) => {
    for (const [key, value] of Object.entries(set ?? {})) if (key in OPT) OPT[key] = !!value;
    return { result: { ...OPT } };
  },
  debugProfile: ({ on }) => { profOn = !!on; resetProf(); return { result: { on: profOn } }; },
  debugPing: () => ({ result: { ok: true } }), // round-trip latency probe: measures how long a control message waits
  // Integration test hook (tests/integration-browser.mjs): read bytes of DS main RAM (0x02000000..) to prove a cheat wrote them.
  debugPeek: ({ addr, len }) => {
    const base = M._mds_ram_data(), size = Number(M._mds_ram_size()), o = (addr >>> 0) - 0x02000000;
    if (!base || o < 0 || o + len > size) throw Object.assign(new Error("address outside main RAM"), { code: "PEEK_RANGE" });
    const out = M.HEAPU8.slice(base + o, base + o + len);
    return { result: out, transfer: [out.buffer] };
  },
  dispose: () => { stop(); if (M) M._mds_destroy(); post({ type: "disposed" }); },
};

self.onmessage = async ({ data }) => {
  try {
    const out = (await (handlers[data.type] ?? saves?.handlers[data.type])?.(data)) ?? {};
    if (data.type === "loadState" || data.type === "setSave") M._mds_flush_audio(); // the old audio belongs to the previous timeline
    if (data.id != null) self.postMessage({ type: "ack", id: data.id, result: out.result }, out.transfer ?? []);
  }
  catch (error) { post({ type: "error", id: data.id, code: error.code ?? "WORKER", message: String(error.message ?? error), stack: error.stack }); }
};
