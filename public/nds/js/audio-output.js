// Main-thread side of the audio path: AudioContext + AudioWorklet + volume/mute + MediaStream capture.
//
// Graph:  AudioWorkletNode("melonds-audio") --> GainNode(volume/mute) --> context.destination
//                                          \--> MediaStreamAudioDestinationNode  (only after captureStream(); NOT affected by
//                                               local volume/mute, so a WebRTC guest still hears the game when the host mutes)
//
// Autoplay policy: the context is created lazily, after the first user gesture (navigator.userActivation.hasBeenActive,
// or the first pointerdown/keydown/touchend/click on the document), so the browser never logs "AudioContext was not
// allowed to start". Until then the emulator runs on its timer and discards audio (see emu-worker.js).
import { createAudioRingBuffer, readRingStats, ringViews, CTRL } from "./audio-ring.js";

const VOLUME_TAU = 0.015; // setTargetAtTime time constant: volume/mute changes settle in ~50 ms without a click

export class AudioOutput {
  /**
   * @param {object} o
   * @param {SharedArrayBuffer} [o.ring] shared audio ring (created if omitted)
   * @param {number} [o.sampleRate] AudioContext rate; default = the device's (usually 44100 or 48000)
   * @param {string} [o.latencyHint] AudioContext latencyHint ("interactive" by default)
   * @param {URL|string} [o.workletUrl]
   * @param {SharedArrayBuffer} [o.capture] optional capture ring (tests)
   * @param {boolean} [o.autoUnlock] listen for the first gesture (default true)
   * @param {boolean} [o.ignoreActivation] create the context even before any user gesture (tests with --autoplay-policy=no-user-gesture-required)
   */
  constructor({ ring = createAudioRingBuffer(), sampleRate, latencyHint = "interactive", workletUrl = new URL("./audio-worklet.js", import.meta.url), capture = null, autoUnlock = true, ignoreActivation = false, onError = () => {} } = {}) {
    this.ignoreActivation = ignoreActivation; this.ring = ring; this.capture = capture; this.requestedRate = sampleRate; this.latencyHint = latencyHint; this.workletUrl = workletUrl; this.onError = onError;
    this.volume = 1; this.muted = false;
    this.ctx = null; this.node = null; this.gain = null; this.captureDest = null;
    this.ready = null;
    this.unlockEvents = ["pointerdown", "keydown", "touchend", "click"];
    this.unlock = () => { this.start().catch(onError); }; // start() disarms the listeners once it really starts
    if (autoUnlock && typeof document !== "undefined") {
      if (navigator.userActivation?.hasBeenActive) queueMicrotask(() => this.start().catch(onError));
      else for (const ev of this.unlockEvents) document.addEventListener(ev, this.unlock, { capture: true });
    }
  }
  #removeUnlock() { if (typeof document !== "undefined") for (const ev of this.unlockEvents) document.removeEventListener(ev, this.unlock, { capture: true }); }

  /** Creates the context and graph (once) and resumes it. Call from a user gesture, or let autoUnlock do it. */
  start() {
    // Never create the context before the user has interacted with the page (it would log an autoplay warning and stay
    // suspended). The unlock listeners stay armed and call start() again from the gesture.
    if (!this.ready && navigator.userActivation && !navigator.userActivation.hasBeenActive && !this.ignoreActivation) return Promise.resolve();
    this.#removeUnlock();
    if (this.ready) return this.ready.then(() => this.resumeContext());
    this.ready = (async () => {
      const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Ctx) throw Object.assign(new Error("Web Audio is not available"), { code: "NO_AUDIO" });
      const ctx = this.ctx = new Ctx({ latencyHint: this.latencyHint, ...(this.requestedRate ? { sampleRate: this.requestedRate } : {}) });
      await ctx.audioWorklet.addModule(this.workletUrl instanceof URL ? this.workletUrl.href : this.workletUrl);
      this.node = new AudioWorkletNode(ctx, "melonds-audio", {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { ring: this.ring, capture: this.capture },
      });
      this.node.onprocessorerror = () => this.onError(new Error("audio worklet crashed"));
      this.gain = ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.node.connect(this.gain).connect(ctx.destination);
      if (this.captureDest) this.node.connect(this.captureDest);
    })();
    return this.ready.then(() => this.resumeContext());
  }
  async resumeContext() { if (this.ctx && this.ctx.state !== "running") await this.ctx.resume(); }

  #applyGain() {
    if (!this.gain) return;
    this.gain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, VOLUME_TAU);
  }
  setVolume(v) {
    if (!(v >= 0 && v <= 1)) throw new RangeError("volume must be within 0..1");
    this.volume = v; this.#applyGain();
  }
  setMuted(m) { this.muted = !!m; this.#applyGain(); }
  /** Producer is (not) feeding: the worklet fades out, discards, and re-primes on resume. Safe from any thread. */
  setPaused(p) { Atomics.store(ringViews(this.ring).ctrl, CTRL.PAUSED, p ? 1 : 0); }

  /** Audio MediaStreamTrack for captureStream(); created on first use, created before the context if need be. */
  getCaptureTracks() {
    if (!this.ctx) throw Object.assign(new Error("audio not started yet: call after the first user gesture"), { code: "AUDIO_NOT_STARTED" });
    if (!this.captureDest) {
      this.captureDest = this.ctx.createMediaStreamDestination();
      this.captureDest.channelCount = 2;
      this.node?.connect(this.captureDest);
    }
    return this.captureDest.stream.getAudioTracks();
  }

  /** AnalyserNode on the final (post-volume) signal: lets tests and meters see what really goes to the speakers. */
  tapOutput(fftSize = 32768) {
    if (!this.gain) throw Object.assign(new Error("audio not started yet"), { code: "AUDIO_NOT_STARTED" });
    if (!this.analyser) { this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = fftSize; this.gain.connect(this.analyser); }
    return this.analyser;
  }

  get state() { return this.ctx?.state ?? "none"; }
  get baseLatencyMs() { return this.ctx ? (this.ctx.baseLatency + (this.ctx.outputLatency || 0)) * 1000 : 0; }
  getStats() { return { ...readRingStats(this.ring), contextState: this.state, outputLatencyMs: this.baseLatencyMs }; }

  async dispose() {
    this.#removeUnlock();
    try { this.node?.disconnect(); this.gain?.disconnect(); await this.ctx?.close(); } catch { /* already closed */ }
    this.ctx = this.node = this.gain = null;
  }
}
