import { describe, expect, it } from 'vitest';
import { K_LOW, extractLine, lineIndex, lineSpectrum, lowEnergyShare, peakBin } from './model';
import {
  CHECKER_SQUARES,
  HI,
  LO,
  N,
  PATTERNS,
  STRIPES_COARSE,
  STRIPES_FINE,
  greyRGBA,
  patternLuminance,
  type PatternId,
} from './patterns';

const row = (id: PatternId, y: number): Float64Array => extractLine(patternLuminance(id), N, 'zeile', y);
const col = (id: PatternId, x: number): Float64Array => extractLine(patternLuminance(id), N, 'spalte', x);

describe('patterns', () => {
  it('are N × N grey values within [LO, HI]', () => {
    for (const id of PATTERNS) {
      const lum = patternLuminance(id);
      expect(lum.length).toBe(N * N);
      expect(lum.reduce((m, v) => Math.min(m, v))).toBeGreaterThanOrEqual(LO - 1e-9);
      expect(lum.reduce((m, v) => Math.max(m, v))).toBeLessThanOrEqual(HI + 1e-9);
    }
  });

  it('stripes: the peak index equals the number of stripe periods across the image', () => {
    for (const [id, periods] of [
      ['streifen-grob', STRIPES_COARSE],
      ['streifen-fein', STRIPES_FINE],
    ] as const) {
      for (const y of [0, 153, 511]) {
        const spec = lineSpectrum(row(id, y));
        expect(peakBin(spec)).toBe(periods);
        expect(spec[periods]).toBeCloseTo((HI - LO) / 2, 9);
        // a clean line: nothing else besides the mean
        for (let k = 1; k < spec.length; k++) if (k !== periods) expect(spec[k]).toBeLessThan(1e-9);
      }
    }
    expect(STRIPES_FINE).toBeGreaterThan(STRIPES_COARSE);
  });

  it('stripes: a column has constant brightness (only the mean, no peak)', () => {
    const spec = lineSpectrum(col('streifen-fein', 100));
    expect(peakBin(spec)).toBe(-1);
    expect(spec[0]).toBeCloseTo((LO + HI) / 2, 9);
  });

  it('checkerboard: square wave with CHECKER_SQUARES / 2 periods, odd multiples only', () => {
    const periods = CHECKER_SQUARES / 2;
    const spec = lineSpectrum(row('schachbrett', 300));
    expect(peakBin(spec)).toBe(periods);
    for (let k = 1; k < spec.length; k++) {
      const odd = k % periods === 0 && (k / periods) % 2 === 1;
      if (!odd) expect(spec[k]).toBeLessThan(1e-9);
    }
    expect(spec[3 * periods]).toBeCloseTo(spec[periods] / 3, 0);
  });

  it('Verlauf: nearly all energy at the lowest frequencies, in every row and column', () => {
    for (const i of [0, 100, 256, 400, 511]) {
      for (const line of [row('verlauf', i), col('verlauf', i)]) {
        const spec = lineSpectrum(line);
        expect(lowEnergyShare(spec, 2)).toBeGreaterThan(0.97);
        expect(lowEnergyShare(spec, K_LOW)).toBeGreaterThan(0.999);
      }
    }
  });

  it('Kante: a single jump, odd harmonics decaying like 1/k (the square wave of fourier-reihe)', () => {
    const spec = lineSpectrum(row('kante', lineIndex(0.5)));
    const jump = HI - LO;
    expect(spec[0]).toBeCloseTo((LO + HI) / 2, 9);
    expect(peakBin(spec)).toBe(1);
    for (let k = 1; k <= 51; k += 2) {
      // exact DFT of a sampled jump: (2·jump/N) / sin(πk/N) ≈ 2·jump/(πk)
      expect(spec[k]).toBeCloseTo((2 * jump) / N / Math.sin((Math.PI * k) / N), 6);
      // k · aₖ stays constant (within 2 % up to k = 51): aₖ ∝ 1/k
      expect((spec[k] * k) / spec[1]).toBeGreaterThan(0.99);
      expect((spec[k] * k) / spec[1]).toBeLessThan(1.02);
    }
    for (let k = 2; k <= 50; k += 2) expect(spec[k]).toBeLessThan(1e-9);
    // slowly decaying: much more energy at high frequencies than the smooth Verlauf
    expect(lowEnergyShare(spec, K_LOW)).toBeLessThan(0.99);
    expect(lowEnergyShare(spec, 2)).toBeLessThan(0.85);
  });

  it('greyRGBA: opaque grey pixels', () => {
    const rgba = greyRGBA([0, 127.6, 255]);
    expect([...rgba]).toEqual([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  });
});
