// Single-producer / single-consumer ring of interleaved int16 stereo frames over one SharedArrayBuffer.
//
// Producer = emulation worker (AudioRingWriter), consumer = AudioWorklet (AudioPlayback, js/audio-playback.js).
// Nobody ever waits and nothing allocates on the consumer side (the audio thread).
//
// Indices are free-running int32 frame counters (they wrap; `(w - r) | 0` is the fill as long as it is < 2^31).
// The WRITER only stores W, the READER only stores R, so there is no lost update and no lock. The writer stores W
// (Atomics.store, sequentially consistent) AFTER copying the samples, and the reader loads W before reading them,
// hence the samples are visible to the reader once it sees the new W.
//
// SAB layout (bytes):
//   [0, 128)     Int32 ctrl[32]   (indices below)
//   [128, 256)   Float64 stats[16] (written only by the worklet, see ST_*)
//   [256, ...)   Int16 data[capacity * 2]
export const CTRL = {
  W: 0,                // frames written (producer)
  R: 1,                // frames read (consumer; stored once per render quantum)
  PAUSED: 2,           // 1 = producer is not feeding: the consumer fades to silence, then discards whatever is left
  TICK: 3,             // +1 per process() call: heartbeat that tells the producer the audio clock is running
  SRC_RATE_MILLI: 4,   // core output rate in millihertz (32728498)
  UNDERRUN_EVENTS: 5,  // times the consumer ran dry while playing (one per episode)
  UNDERRUN_FRAMES: 6,  // output frames replaced by silence/decay because of it
  OVERRUN_FRAMES: 7,   // frames the producer had to DROP (ring full: newest are discarded)
  TRIMMED_FRAMES: 8,   // frames the consumer discarded to cut latency after a burst (fill > min(90 % of capacity, 5x target))
  CATCHUP_FRAMES: 9,   // output frames produced while playing 2 % faster to drain an excess of fill
  CTX_RATE: 10,        // sampleRate of the AudioContext (set by the worklet)
  TARGET_FRAMES: 11,   // fill the producer aims for; the consumer waits for it before (re)starting
  RESET_STATS: 12,     // set to 1 by anyone: the worklet zeroes maxJump/peak on its next quantum
  MODE: 13,            // 0 priming, 1 playing, 2 starved (written by the consumer; for display)
  CAPTURE_ON: 14,      // 1 = the worklet copies its output into the optional capture ring (tests/debug only)
  CAPTURE_POS: 15,     // frames written to the capture ring
  OVERRUN_EVENTS: 16,  // producer calls that had to drop frames
  CAPACITY: 17,        // capacity in frames (power of two)
  PLAY_RATE_MILLI: 18, // playback speed x1000 (1000 = real time, 2000 = fast-forward at 2x: twice as fast and an octave higher); 0 = 1000
  DRC_MODE: 19,        // dynamic rate control: 0 = off, 1 = fast-forward only, 2 = always (also at 1x). Set by the worker
  DRC_MILLI: 20,       // current DRC factor x1000 as applied by the consumer in the last quantum (1000 = no slowdown); 0 = not reported yet
};
export const ST = { SUMSQ: 0, FRAMES: 1, NONZERO: 2, PEAK: 3, MAXJUMP: 4 };
export const MODE = { PRIMING: 0, PLAYING: 1, STARVED: 2 };

const CTRL_BYTES = 128, STATS_BYTES = 128, HEADER_BYTES = CTRL_BYTES + STATS_BYTES;
export const DEFAULT_CAPACITY_FRAMES = 16384;

export function createAudioRingBuffer(capacityFrames = DEFAULT_CAPACITY_FRAMES) {
  if (capacityFrames & (capacityFrames - 1)) throw new RangeError("capacity must be a power of two");
  const sab = new SharedArrayBuffer(HEADER_BYTES + capacityFrames * 4);
  new Int32Array(sab, 0, 32)[CTRL.CAPACITY] = capacityFrames;
  return sab;
}

export function ringViews(sab) {
  const ctrl = new Int32Array(sab, 0, 32);
  const capacity = Atomics.load(ctrl, CTRL.CAPACITY);
  return { ctrl, stats: new Float64Array(sab, CTRL_BYTES, 16), data: new Int16Array(sab, HEADER_BYTES, capacity * 2), capacity };
}

/** Capture ring (tests/debug): mono Float32 copy of what the worklet outputs, 2^18 frames. */
export function createCaptureBuffer(frames = 1 << 18) { return new SharedArrayBuffer(frames * 4); }

export class AudioRingWriter {
  constructor(sab) {
    Object.assign(this, ringViews(sab));
    this.mask = this.capacity - 1;
  }
  get fill() { return (Atomics.load(this.ctrl, CTRL.W) - Atomics.load(this.ctrl, CTRL.R)) | 0; }
  get free() { return this.capacity - this.fill; }

  /**
   * Appends `frames` stereo frames from `src` (interleaved int16). If the ring cannot take them all, the NEWEST are
   * dropped (counted in OVERRUN_FRAMES): the writer must not move R, and the oldest frames are already promised.
   * @returns frames accepted
   */
  write(src, frames) {
    const w = Atomics.load(this.ctrl, CTRL.W);
    const n = Math.min(frames, this.free);
    if (n < frames) { Atomics.add(this.ctrl, CTRL.OVERRUN_FRAMES, frames - n); Atomics.add(this.ctrl, CTRL.OVERRUN_EVENTS, 1); }
    if (n > 0) {
      const start = w & this.mask, first = Math.min(n, this.capacity - start);
      this.data.set(src.subarray(0, first * 2), start * 2);
      if (n > first) this.data.set(src.subarray(first * 2, n * 2), 0);
      Atomics.store(this.ctrl, CTRL.W, (w + n) | 0);
    }
    return n;
  }
  setPaused(p) { Atomics.store(this.ctrl, CTRL.PAUSED, p ? 1 : 0); }
  get paused() { return Atomics.load(this.ctrl, CTRL.PAUSED) === 1; }
  get tick() { return Atomics.load(this.ctrl, CTRL.TICK); }
  setPlayRate(x) { Atomics.store(this.ctrl, CTRL.PLAY_RATE_MILLI, Math.round(x * 1000)); }
  /** 0 = off, 1 = fast-forward only, 2 = always (also at 1x). See js/audio-playback.js. */
  setDrcMode(mode) { Atomics.store(this.ctrl, CTRL.DRC_MODE, mode | 0); }
  get drcMode() { return Atomics.load(this.ctrl, CTRL.DRC_MODE); }
  setSourceRate(hz) { Atomics.store(this.ctrl, CTRL.SRC_RATE_MILLI, Math.round(hz * 1000)); }
  get sourceRate() { return Atomics.load(this.ctrl, CTRL.SRC_RATE_MILLI) / 1000; }
  setTargetFrames(n) { Atomics.store(this.ctrl, CTRL.TARGET_FRAMES, n); }
  get targetFrames() { return Atomics.load(this.ctrl, CTRL.TARGET_FRAMES); }
}

/** Plain consumer (no resampling): used by the tests and by anything that just wants the PCM. AudioPlayback is the real-time one. */
export class AudioRingReader {
  constructor(sab) { Object.assign(this, ringViews(sab)); this.mask = this.capacity - 1; }
  get fill() { return (Atomics.load(this.ctrl, CTRL.W) - Atomics.load(this.ctrl, CTRL.R)) | 0; }
  /** Copies up to `maxFrames` frames into `dst` (interleaved int16); returns frames copied. */
  read(dst, maxFrames) {
    const r = Atomics.load(this.ctrl, CTRL.R), n = Math.min(maxFrames, (Atomics.load(this.ctrl, CTRL.W) - r) | 0);
    for (let i = 0; i < n; i++) { const k = ((r + i) & this.mask) * 2; dst[i * 2] = this.data[k]; dst[i * 2 + 1] = this.data[k + 1]; }
    if (n > 0) Atomics.store(this.ctrl, CTRL.R, (r + n) | 0);
    return n;
  }
}

/** Read-only view for the main thread (stats). */
export function readRingStats(sab) {
  const { ctrl, stats } = ringViews(sab);
  const L = (i) => Atomics.load(ctrl, i);
  const src = L(CTRL.SRC_RATE_MILLI) / 1000;
  const fill = (L(CTRL.W) - L(CTRL.R)) | 0;
  return {
    fillFrames: fill, bufferMs: src ? (fill * 1000) / src : 0, sourceRate: src, contextRate: L(CTRL.CTX_RATE), mode: L(CTRL.MODE),
    underrunEvents: L(CTRL.UNDERRUN_EVENTS), underrunFrames: L(CTRL.UNDERRUN_FRAMES),
    overrunFrames: L(CTRL.OVERRUN_FRAMES), overrunEvents: L(CTRL.OVERRUN_EVENTS), trimmedFrames: L(CTRL.TRIMMED_FRAMES), catchupFrames: L(CTRL.CATCHUP_FRAMES),
    tick: L(CTRL.TICK), paused: L(CTRL.PAUSED) === 1, targetFrames: L(CTRL.TARGET_FRAMES),
    playRate: (L(CTRL.PLAY_RATE_MILLI) || 1000) / 1000, drcMode: L(CTRL.DRC_MODE), drc: (L(CTRL.DRC_MILLI) || 1000) / 1000,
    sumSq: stats[ST.SUMSQ], framesOut: stats[ST.FRAMES], nonZeroFrames: stats[ST.NONZERO], peak: stats[ST.PEAK], maxJump: stats[ST.MAXJUMP],
  };
}
