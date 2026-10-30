// AudioWorklet for `audio-aliasing`: a sine sampled at the context's sample
// rate (the demo runs the context at f_s, e.g. 8000 Hz). The samples come from
// a phase accumulator φ += 2π f / f_s, so frequency jumps and sweeps stay
// click-free. Nothing is band-limited: an input frequency above f_s/2 aliases,
// which is the point of the demo. Loaded via `?worker&url` (see voice.ts).

// Globals of AudioWorkletGlobalScope (not part of TypeScript's DOM lib).
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const TWO_PI = 2 * Math.PI;

class SampledSine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'frequency', defaultValue: 1000, minValue: 0, maxValue: 192000, automationRate: 'a-rate' }];
  }

  private phase = 0;

  process(_inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const out = outputs[0];
    const ch0 = out[0];
    const f = parameters.frequency;
    const k = TWO_PI / sampleRate;
    let phase = this.phase;
    for (let i = 0; i < ch0.length; i++) {
      ch0[i] = Math.sin(phase);
      phase = (phase + k * (f.length > 1 ? f[i] : f[0])) % TWO_PI;
    }
    this.phase = phase;
    for (let c = 1; c < out.length; c++) out[c].set(ch0);
    return true;
  }
}

registerProcessor('sampled-sine', SampledSine);

export {};
