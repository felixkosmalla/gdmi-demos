// AudioWorklet for `audio-aliasing`: a sine sampled at the context's sample
// rate (the demo runs the context at f_s, e.g. 8000 Hz). The samples come from
// a phase accumulator φ += 2π f / f_s, so frequency jumps and sweeps stay
// click-free. Nothing is band-limited: an input frequency above f_s/2 aliases,
// which is the point of the demo. Loaded via `?worker&url` (see voice.ts).
//
// Above f_s/2 (mod f_s) the phase steps backwards in terms of the alias
// frequency: sin(φ + 2π f n/f_s) = sin(φ − 2π (f_s − f) n/f_s). Where f changes
// sides (a jump from 3000 to 5000 Hz, or a sweep through f_s/2), φ becomes
// π − φ: the sample value stays the same and the alias sine continues with
// continuous phase, so A/B jumps between f and f_s − f don't tick.

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
  /** True if f mod f_s lies above f_s/2. */
  private upper = false;

  process(_inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const out = outputs[0];
    const ch0 = out[0];
    const f = parameters.frequency;
    const k = TWO_PI / sampleRate;
    const half = sampleRate / 2;
    let phase = this.phase;
    let upper = this.upper;
    for (let i = 0; i < ch0.length; i++) {
      const fi = f.length > 1 ? f[i] : f[0];
      if (fi % sampleRate > half !== upper) {
        upper = !upper;
        phase = Math.PI - phase;
      }
      ch0[i] = Math.sin(phase);
      phase = (phase + k * fi) % TWO_PI;
    }
    this.phase = phase;
    this.upper = upper;
    for (let c = 1; c < out.length; c++) out[c].set(ch0);
    return true;
  }
}

registerProcessor('sampled-sine', SampledSine);

export {};
