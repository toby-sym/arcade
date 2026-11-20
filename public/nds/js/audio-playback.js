// Consumer side of the audio path: reads the shared ring, resamples from the core rate (32728.498 Hz) to the
// AudioContext rate, and applies the pause / underrun / catch-up state machine. This file runs INSIDE the AudioWorklet
// (js/audio-worklet.js) and is also imported by the Node unit tests, so it must not touch any worklet global.
//
// Real-time rules for process(): no allocation, no locks, no Atomics.wait, no logging, no postMessage. All state is in
// numeric fields and in the SharedArrayBuffer.
import { CTRL, ST, MODE, ringViews } from "./audio-ring.js";

const RAMP_SECONDS = 0.006;      // fade in/out on pause, resume and (re)start: 6 ms is inaudible as a fade, and enough to avoid a click
const DECAY_SECONDS = 0.002;     // after an underrun the last value decays to zero with this time constant instead of cutting
const CATCHUP_RATE = 1.02;       // play 2 % faster (~+34 cents) while the fill exceeds 2x target
const CATCHUP_ON = 2.0, CATCHUP_OFF = 1.25; // hysteresis, as multiples of the target fill
const TRIM_FRACTION = 0.9;       // trim threshold: min(90 % of the capacity, 5x target) -- a burst, not a drift
const TRIM_TARGETS = 5;
const DRC_MIN = 0.5, DRC_FULL_AT = 0.9, DRC_SMOOTH = 0.01; // dynamic rate control: lowest factor, fill/target at which full speed is allowed, smoothing per quantum
const DRC_MIN_1X = 0.8;          // floor at 1x: the pitch may drop at most 20 % (user decision 0.0 #4, "always")
const DRC_OFF = 0, DRC_FF = 1, DRC_ALWAYS = 2; // CTRL.DRC_MODE: 0 off, 1 only in fast-forward, 2 always

export class AudioPlayback {
  /** @param {SharedArrayBuffer} sab audio ring; @param {number} ctxRate AudioContext sample rate; @param {SharedArrayBuffer|null} capture */
  constructor(sab, ctxRate, capture = null) {
    Object.assign(this, ringViews(sab));
    this.mask = this.capacity - 1;
    this.ctxRate = ctxRate;
    this.cap = capture ? new Float32Array(capture) : null;
    this.capMask = capture ? this.cap.length - 1 : 0;
    Atomics.store(this.ctrl, CTRL.CTX_RATE, ctxRate);
    this.rampStep = 1 / (RAMP_SECONDS * ctxRate);
    this.decay = Math.exp(-1 / (DECAY_SECONDS * ctxRate));
    this.r = Atomics.load(this.ctrl, CTRL.R);
    this.mode = MODE.PRIMING;
    this.gain = 0;
    this.phase = 1;                    // >= 1 forces a pull of source frames before the first output sample
    this.l0 = this.l1 = this.l2 = this.l3 = 0;
    this.r0 = this.r1 = this.r2 = this.r3 = 0;
    this.heldL = 0; this.heldR = 0;    // decaying tail after an underrun
    this.lastL = 0; this.lastR = 0;
    this.catchingUp = false;
    this.drc = 1;                      // dynamic rate control factor (mode "always" or fast-forward), 1 = full requested speed
    this.outCount = 0;
  }

  /** Fills outL/outR (Float32Array views of length >= n) with n frames. */
  process(outL, outR, n) {
    const ctrl = this.ctrl, data = this.data, mask = this.mask, stats = this.stats;
    Atomics.add(ctrl, CTRL.TICK, 1);
    if (Atomics.load(ctrl, CTRL.RESET_STATS) === 1) { stats[ST.MAXJUMP] = 0; stats[ST.PEAK] = 0; Atomics.store(ctrl, CTRL.RESET_STATS, 0); }
    const paused = Atomics.load(ctrl, CTRL.PAUSED) === 1;
    const w = Atomics.load(ctrl, CTRL.W);
    let r = this.r;
    const srcRate = Atomics.load(ctrl, CTRL.SRC_RATE_MILLI) / 1000 || 32728.498;
    const target = Atomics.load(ctrl, CTRL.TARGET_FRAMES) || 2048;
    let fill = (w - r) | 0;

    // Burst protection: if the producer got far ahead (more than 90 % of the ring) throw the oldest frames away.
    if (fill > Math.min(this.capacity * TRIM_FRACTION, target * TRIM_TARGETS) && !paused) {
      const skip = fill - target;
      r = (r + skip) | 0; fill = target;
      Atomics.add(ctrl, CTRL.TRIMMED_FRAMES, skip);
    }
    // Gentle catch-up while the excess lasts (hysteresis so it does not flap).
    if (!this.catchingUp && fill > target * CATCHUP_ON) this.catchingUp = true;
    else if (this.catchingUp && fill < target * CATCHUP_OFF) this.catchingUp = false;
    const playRate = (Atomics.load(ctrl, CTRL.PLAY_RATE_MILLI) || 1000) / 1000; // fast-forward: consume the ring faster (pitch rises with it)
    // Dynamic rate control (DRC). When the emulator cannot produce `playRate`x (the CPU is the limit), the ring drains
    // below target. Instead of running dry (underruns = audible cuts) the playback slows in proportion to the fill, so it
    // settles at whatever speed the emulator really sustains (pitch follows). At or above ~90 % of the target it plays at
    // the full requested rate. Smoothed per quantum (~0.3 s time constant) so the pitch glides instead of warbling.
    // DRC_MODE: 0 off, 1 fast-forward only (the original behaviour), 2 always (also at 1x). At 1x the floor is 0.8, so a
    // CPU that is just short sounds up to 20 % slower instead of cutting; with a CPU on time the fill stays above 90 % of
    // the target and the factor is 1, i.e. nothing changes.
    const drcMode = Atomics.load(ctrl, CTRL.DRC_MODE);
    if (paused) this.drc = 1; // no playback: there is nothing to slow down (avoids a bogus factor in the stats while muted)
    else if (drcMode === DRC_ALWAYS || (drcMode === DRC_FF && playRate > 1)) {
      const floor = playRate > 1 ? DRC_MIN : DRC_MIN_1X;
      const want = Math.min(1, Math.max(floor, fill / (target * DRC_FULL_AT)));
      this.drc += (want - this.drc) * DRC_SMOOTH;
    } else this.drc = 1;
    Atomics.store(ctrl, CTRL.DRC_MILLI, Math.round(this.drc * 1000)); // reported in readRingStats() for tests and the demo/stats
    const step = (srcRate * playRate * this.drc / this.ctxRate) * (this.catchingUp ? CATCHUP_RATE : 1);

    let { l0, l1, l2, l3, r0, r1, r2, r3, phase, gain, heldL, heldR, mode, lastL, lastR } = this;
    const rampStep = this.rampStep, decay = this.decay;
    let sumSq = 0, nonZero = 0, peak = 0, maxJump = 0, underrunFrames = 0, catchFrames = 0;

    for (let i = 0; i < n; i++) {
      let outL_ = 0, outR_ = 0;
      if (paused) {
        // Fade the real audio out (the ring still holds up to `target` frames), then drop the rest and wait.
        if (gain > 0 && mode === MODE.PLAYING) {
          // keep playing below with a falling gain
        } else {
          mode = MODE.PRIMING; r = w; fill = 0; gain = 0; phase = 1; l0 = l1 = l2 = l3 = r0 = r1 = r2 = r3 = 0;
        }
      }
      if (mode === MODE.PRIMING) {
        if (!paused && ((w - r) | 0) >= target) { mode = MODE.PLAYING; phase = 1; l0 = l1 = l2 = l3 = r0 = r1 = r2 = r3 = 0; gain = 0; }
      } else if (mode === MODE.STARVED) {
        if (((w - r) | 0) >= target) { mode = MODE.PLAYING; gain = 0; }
      }
      if (mode === MODE.PLAYING) {
        // Pull source frames until the interpolation window covers `phase`.
        let starved = false;
        while (phase >= 1) {
          if (r === w) { starved = true; break; }
          const k = (r & mask) * 2;
          l0 = l1; l1 = l2; l2 = l3; l3 = data[k] * (1 / 32768);
          r0 = r1; r1 = r2; r2 = r3; r3 = data[k + 1] * (1 / 32768);
          r = (r + 1) | 0; phase -= 1;
        }
        if (starved) {
          if (paused) { gain = 0; } else {
            mode = MODE.STARVED; heldL = lastL; heldR = lastR;
            Atomics.add(ctrl, CTRL.UNDERRUN_EVENTS, 1);
          }
        } else {
          // Catmull-Rom (cubic Hermite) between l1 and l2 at fraction `phase`.
          const t = phase;
          const a1 = 0.5 * (l2 - l0), a2 = l0 - 2.5 * l1 + 2 * l2 - 0.5 * l3, a3 = 0.5 * (l3 - l0) + 1.5 * (l1 - l2);
          const b1 = 0.5 * (r2 - r0), b2 = r0 - 2.5 * r1 + 2 * r2 - 0.5 * r3, b3 = 0.5 * (r3 - r0) + 1.5 * (r1 - r2);
          const target_gain = paused ? 0 : 1;
          if (gain < target_gain) { gain += rampStep; if (gain > target_gain) gain = target_gain; }
          else if (gain > target_gain) { gain -= rampStep; if (gain < target_gain) gain = target_gain; }
          outL_ = (((a3 * t + a2) * t + a1) * t + l1) * gain + heldL;
          outR_ = (((b3 * t + b2) * t + b1) * t + r1) * gain + heldR;
          heldL *= decay; heldR *= decay;
          phase += step;
          if (this.catchingUp) catchFrames++;
        }
      }
      if (mode === MODE.STARVED) { // (also reached in the same iteration the starvation was detected)
        outL_ = heldL; outR_ = heldR; heldL *= decay; heldR *= decay; underrunFrames++;
      }
      outL[i] = outL_; outR[i] = outR_;
      const jl = outL_ - lastL, jr = outR_ - lastR;
      const j = (jl < 0 ? -jl : jl) > (jr < 0 ? -jr : jr) ? (jl < 0 ? -jl : jl) : (jr < 0 ? -jr : jr);
      if (j > maxJump) maxJump = j;
      lastL = outL_; lastR = outR_;
      sumSq += (outL_ * outL_ + outR_ * outR_) * 0.5;
      const aL = outL_ < 0 ? -outL_ : outL_, aR = outR_ < 0 ? -outR_ : outR_;
      if (aL > 1e-4 || aR > 1e-4) nonZero++;
      const pk = aL > aR ? aL : aR; if (pk > peak) peak = pk;
    }

    this.l0 = l0; this.l1 = l1; this.l2 = l2; this.l3 = l3; this.r0 = r0; this.r1 = r1; this.r2 = r2; this.r3 = r3;
    this.phase = phase; this.gain = gain; this.heldL = heldL; this.heldR = heldR; this.mode = mode; this.lastL = lastL; this.lastR = lastR;
    this.r = r;
    Atomics.store(ctrl, CTRL.R, r);
    Atomics.store(ctrl, CTRL.MODE, mode);
    if (underrunFrames) Atomics.add(ctrl, CTRL.UNDERRUN_FRAMES, underrunFrames);
    if (catchFrames) Atomics.add(ctrl, CTRL.CATCHUP_FRAMES, catchFrames);
    stats[ST.SUMSQ] += sumSq; stats[ST.FRAMES] += n; stats[ST.NONZERO] += nonZero;
    if (peak > stats[ST.PEAK]) stats[ST.PEAK] = peak;
    if (maxJump > stats[ST.MAXJUMP]) stats[ST.MAXJUMP] = maxJump;

    if (this.cap && Atomics.load(ctrl, CTRL.CAPTURE_ON) === 1) {
      let p = Atomics.load(ctrl, CTRL.CAPTURE_POS);
      for (let i = 0; i < n; i++) this.cap[(p + i) & this.capMask] = outL[i];
      Atomics.store(ctrl, CTRL.CAPTURE_POS, (p + n) | 0);
    }
  }
}
