// AudioWorkletProcessor: thin shell around AudioPlayback (js/audio-playback.js), loaded with
// audioContext.audioWorklet.addModule(). Everything real-time lives in AudioPlayback.
import { AudioPlayback } from "./audio-playback.js";

class MelondsAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { ring, capture } = options.processorOptions;
    this.playback = new AudioPlayback(ring, sampleRate, capture ?? null); // `sampleRate` is the AudioWorkletGlobalScope global
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    const left = out[0], right = out.length > 1 ? out[1] : out[0];
    this.playback.process(left, right, left.length);
    return true; // keep the node alive for the lifetime of the context
  }
}
registerProcessor("melonds-audio", MelondsAudioProcessor);
