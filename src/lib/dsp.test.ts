import { describe, expect, it } from 'vitest';
import {
  aliasFrequency,
  fft,
  fourierSeries,
  fourierSynthesize,
  ifft,
  magnitudeSpectrum,
  sincReconstruct,
  sincReconstructUniform,
  wrapPhase,
} from './dsp';

/** Deterministic pseudo-random numbers in [-1, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 2 ** 32) * 2 - 1;
  };
}

function naiveDft(re: Float64Array, im: Float64Array): [Float64Array, Float64Array] {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < n; t++) {
      const ang = (-2 * Math.PI * k * t) / n;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      sr += re[t] * c - im[t] * s;
      si += re[t] * s + im[t] * c;
    }
    outRe[k] = sr;
    outIm[k] = si;
  }
  return [outRe, outIm];
}

describe('fft', () => {
  for (const n of [8, 64, 1024]) {
    it(`matches a naive DFT on random input (N = ${n})`, () => {
      const rand = rng(n);
      const re = Float64Array.from({ length: n }, rand);
      const im = Float64Array.from({ length: n }, rand);
      const [expRe, expIm] = naiveDft(re, im);
      fft(re, im);
      for (let k = 0; k < n; k++) {
        expect(re[k]).toBeCloseTo(expRe[k], 8);
        expect(im[k]).toBeCloseTo(expIm[k], 8);
      }
    });
  }

  it('throws for lengths that are not a power of two', () => {
    expect(() => fft(new Float64Array(12), new Float64Array(12))).toThrow();
    expect(() => fft(new Float64Array(0), new Float64Array(0))).toThrow();
  });

  it('ifft inverts fft', () => {
    const rand = rng(7);
    const re = Float64Array.from({ length: 256 }, rand);
    const im = Float64Array.from({ length: 256 }, rand);
    const re0 = re.slice();
    const im0 = im.slice();
    fft(re, im);
    ifft(re, im);
    for (let i = 0; i < 256; i++) {
      expect(re[i]).toBeCloseTo(re0[i], 10);
      expect(im[i]).toBeCloseTo(im0[i], 10);
    }
  });
});

describe('magnitudeSpectrum', () => {
  it('gives the amplitude of a sine at its bin and the DC value at bin 0', () => {
    const n = 512;
    const x = Float64Array.from({ length: n }, (_, i) => 0.5 + 2 * Math.sin((2 * Math.PI * 10 * i) / n));
    const mag = magnitudeSpectrum(x);
    expect(mag.length).toBe(n / 2 + 1);
    expect(mag[0]).toBeCloseTo(0.5, 10);
    expect(mag[10]).toBeCloseTo(2, 10);
    expect(mag[11]).toBeCloseTo(0, 10);
  });

  it('keeps the amplitude scale with a Hann window', () => {
    const n = 512;
    const x = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 20 * i) / n));
    const mag = magnitudeSpectrum(x, { window: 'hann' });
    expect(mag[20]).toBeCloseTo(1, 10);
    expect(mag[19]).toBeCloseTo(0.5, 10); // Hann main lobe spreads to neighbours
  });

  it('keeps a constant at bin 0 only with a Hann window', () => {
    const mag = magnitudeSpectrum(new Float64Array(64).fill(-3), { window: 'hann' });
    expect(mag[0]).toBeCloseTo(3, 10);
    for (let k = 1; k <= 32; k++) expect(mag[k]).toBeCloseTo(0, 10);
  });

  it('reports the true mean and no leakage of it with a Hann window', () => {
    const n = 512;
    const x = Float64Array.from({ length: n }, (_, i) => 100 + 50 * Math.cos((2 * Math.PI * 20 * i) / n));
    const mag = magnitudeSpectrum(x, { window: 'hann' });
    expect(mag[0]).toBeCloseTo(100, 10);
    expect(mag[1]).toBeCloseTo(0, 10);
    expect(mag[20]).toBeCloseTo(50, 10);
    expect(mag[21]).toBeCloseTo(25, 10);
  });
});

describe('fourierSeries', () => {
  const m = 1024;
  const square = Float64Array.from({ length: m }, (_, i) => (i < m / 2 ? 1 : -1));

  it('square wave (±1): amplitudes ≈ 4/(πk) for odd k, ≈ 0 for even k', () => {
    const c = fourierSeries(square, 15);
    expect(c.a0).toBeCloseTo(0, 12);
    for (let k = 1; k <= 15; k++) {
      if (k % 2 === 1) expect(c.amp[k]).toBeCloseTo(4 / (Math.PI * k), 3);
      else expect(c.amp[k]).toBeCloseTo(0, 10);
    }
    // sin(t) = cos(t − π/2) → phase ≈ 3π/2 (up to a half-sample offset)
    expect(c.phase[1]).toBeCloseTo((3 * Math.PI) / 2, 2);
    expect(c.phase[2]).toBe(0);
  });

  it('works for lengths that are not a power of two (direct DFT)', () => {
    const p = Float64Array.from({ length: 300 }, (_, i) => 0.25 + 0.75 * Math.cos((2 * Math.PI * 3 * i) / 300 + 1));
    const c = fourierSeries(p, 5);
    expect(c.a0).toBeCloseTo(0.25, 10);
    expect(c.amp[3]).toBeCloseTo(0.75, 10);
    expect(c.phase[3]).toBeCloseTo(1, 10);
    expect(c.amp[1]).toBe(0);
  });

  it('represents a negative DC term with phase π at index 0', () => {
    const c = fourierSeries(new Float64Array(64).fill(-2), 3);
    expect(c.a0).toBeCloseTo(-2, 12);
    expect(c.amp[0]).toBeCloseTo(2, 12);
    expect(c.phase[0]).toBeCloseTo(Math.PI, 12);
  });

  it('fourierSynthesize reproduces the sampled period with enough harmonics', () => {
    const p = Float64Array.from({ length: 256 }, (_, i) => {
      const t = i / 256;
      return 0.3 + Math.sin(2 * Math.PI * t) - 0.4 * Math.cos(2 * Math.PI * 5 * t + 0.7);
    });
    const c = fourierSeries(p, 10);
    for (const i of [0, 17, 100, 255]) expect(fourierSynthesize(c, 10, i / 256)).toBeCloseTo(p[i], 10);
    // with n = 1 only DC + fundamental remain
    expect(fourierSynthesize(c, 1, 0.25)).toBeCloseTo(1.3, 10);
  });
});

describe('wrapPhase', () => {
  it('wraps into [0, 2π)', () => {
    expect(wrapPhase(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(wrapPhase(2 * Math.PI)).toBe(0);
    expect(wrapPhase(5 * Math.PI)).toBeCloseTo(Math.PI, 12);
  });
});

describe('aliasFrequency', () => {
  it('folds into [0, fs/2]', () => {
    expect(aliasFrequency(5000, 8000)).toBe(3000);
    expect(aliasFrequency(140, 150)).toBe(10);
    expect(aliasFrequency(84, 150)).toBe(66);
    expect(aliasFrequency(3000, 8000)).toBe(3000);
    expect(aliasFrequency(4000, 8000)).toBe(4000);
    expect(aliasFrequency(8000, 8000)).toBe(0);
    expect(aliasFrequency(9000, 8000)).toBe(1000);
    expect(aliasFrequency(28, 150)).toBe(28);
  });
});

describe('sinc reconstruction', () => {
  const fs = 300;
  const f = 28;
  // long sample window: −2 s … +2 s
  const t0 = -2;
  const count = 4 * fs + 1;
  const times = Float64Array.from({ length: count }, (_, i) => t0 + i / fs);
  const values = times.map((t) => Math.sin(2 * Math.PI * f * t));

  it('sincReconstruct reproduces a 28 Hz sine sampled at 300 Hz in the middle of the window', () => {
    for (let t = -0.05; t <= 0.05; t += 0.00137) {
      expect(Math.abs(sincReconstruct(times, values, fs, t) - Math.sin(2 * Math.PI * f * t))).toBeLessThan(5e-3);
    }
  });

  it('sincReconstructUniform agrees with sincReconstruct', () => {
    for (let t = -0.05; t <= 0.05; t += 0.0031) {
      expect(sincReconstructUniform(t0, values, fs, t)).toBeCloseTo(sincReconstruct(times, values, fs, t), 9);
    }
    // exactly on a sample
    expect(sincReconstructUniform(t0, values, fs, times[700])).toBeCloseTo(values[700], 12);
  });
});
