import { beforeAll, describe, expect, it } from 'vitest';
import { aliasFrequency } from '../../src/lib/dsp';

const FS = 8000;
const BLOCK = 128;

interface Processor {
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
let Processor: new () => Processor;

beforeAll(async () => {
  // the worklet's globals (AudioWorkletGlobalScope)
  const g = globalThis as Record<string, unknown>;
  g.sampleRate = FS;
  g.AudioWorkletProcessor = class {};
  g.registerProcessor = (_name: string, ctor: new () => Processor) => {
    Processor = ctor;
  };
  await import('./aliasing-worklet');
});

/** Runs the worklet with input frequency `f(n)` for sample n (a-rate) and returns n samples. */
function render(f: (n: number) => number, n: number): Float64Array {
  const p = new Processor();
  const out = new Float64Array(n);
  for (let start = 0; start < n; start += BLOCK) {
    const ch = new Float32Array(BLOCK);
    const freq = new Float32Array(BLOCK).map((_, i) => f(start + i));
    p.process([], [[ch]], { frequency: freq });
    out.set(ch.subarray(0, Math.min(BLOCK, n - start)), start);
  }
  return out;
}

/** The samples of a sine at the alias frequency with continuous phase: what the reconstruction should play. */
function aliasStream(f: (n: number) => number, n: number): Float64Array {
  const out = new Float64Array(n);
  let psi = 0;
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(psi);
    psi += (2 * Math.PI * aliasFrequency(Math.fround(f(i)), FS)) / FS;
  }
  return out;
}

function maxDiff(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

describe('aliasing worklet', () => {
  it('A/B 3000 ↔ 5000 Hz gives one continuous 3-kHz sine (no kink at the switches)', () => {
    const ab = (n: number): number => (n >= 1000 && n < 2037 ? 5000 : 3000);
    const x = render(ab, 3000);
    const expected = Float64Array.from({ length: 3000 }, (_, n) => Math.sin((2 * Math.PI * 3000 * n) / FS));
    expect(maxDiff(x, expected)).toBeLessThan(1e-5);
  });

  it('jumps with the same alias (f_s ± f, 2·f_s − f) continue the sine', () => {
    for (const fB of [5000, 11000, 13000]) {
      const f = (n: number): number => (n % 500 < 250 ? 3000 : fB);
      expect(maxDiff(render(f, 2000), aliasStream(f, 2000))).toBeLessThan(1e-5);
    }
  });

  it('jumps and sweeps across f_s/2 keep the alias phase continuous', () => {
    const jumps = (n: number): number => [1000, 6500, 3999, 4000, 4001, 7000, 8000, 2500][Math.floor(n / 301) % 8];
    expect(maxDiff(render(jumps, 4000), aliasStream(jumps, 4000))).toBeLessThan(1e-5);
    const sweep = (n: number): number => (n < 8000 ? n : 16000 - n); // 0 → f_s → 0 at 1 Hz per sample
    expect(maxDiff(render(sweep, 16000), aliasStream(sweep, 16000))).toBeLessThan(1e-4);
  });
});
