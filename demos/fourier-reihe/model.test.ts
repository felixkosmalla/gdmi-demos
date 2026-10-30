import { describe, expect, it } from 'vitest';
import { fourierSynthesize } from '../../src/lib/dsp';
import { M, N_MAX, coefficients, maxValue, paintSegment, presetPeriod } from './model';

const deg = (rad: number): number => (rad * 180) / Math.PI;

describe('presets', () => {
  it('square ±1: only odd harmonics, aₙ = 4/(πn)', () => {
    const c = coefficients(presetPeriod('rechteck'));
    expect(c.a0).toBe(0);
    expect(c.amp[1]).toBeCloseTo(1.273, 3);
    expect(c.amp[3]).toBeCloseTo(0.424, 3);
    expect(c.amp[5]).toBeCloseTo(0.255, 3);
    for (let n = 1; n <= 15; n += 2) {
      expect(c.amp[n]).toBeCloseTo(4 / (Math.PI * n), 3);
      expect(deg(c.phase[n])).toBeCloseTo(270, 6); // sine phase: cos(x − 90°)
    }
    for (let n = 2; n <= N_MAX; n += 2) {
      expect(c.amp[n]).toBe(0);
      expect(c.phase[n]).toBe(0);
    }
  });

  it('triangle: only odd harmonics, aₙ = 8/(π²n²)', () => {
    const c = coefficients(presetPeriod('dreieck'));
    expect(c.a0).toBeCloseTo(0, 12);
    for (let n = 1; n <= 15; n += 2) expect(c.amp[n]).toBeCloseTo(8 / (Math.PI ** 2 * n * n), 4);
    for (let n = 2; n <= 16; n += 2) expect(c.amp[n]).toBeCloseTo(0, 12);
  });

  it('sawtooth: all harmonics, aₙ = 2/(πn)', () => {
    const c = coefficients(presetPeriod('saegezahn'));
    expect(c.a0).toBeCloseTo(0, 12);
    for (let n = 1; n <= 10; n++) {
      expect(c.amp[n]).toBeCloseTo(2 / (Math.PI * n), 3);
      expect(deg(c.phase[n])).toBeCloseTo(90, 6);
    }
  });

  it('sine: only a₁ = 1', () => {
    const c = coefficients(presetPeriod('sinus'));
    expect(c.amp[1]).toBeCloseTo(1, 12);
    expect(deg(c.phase[1])).toBeCloseTo(270, 9);
    for (let n = 2; n <= N_MAX; n++) expect(c.amp[n]).toBe(0);
  });

  it('triangle converges faster than square (N = 5)', () => {
    const err = (name: 'rechteck' | 'dreieck'): number => {
      const p = presetPeriod(name);
      const c = coefficients(p);
      let sum = 0;
      for (let k = 0; k < M; k++) sum += (fourierSynthesize(c, 5, k / M) - p[k]) ** 2;
      return Math.sqrt(sum / M);
    };
    expect(err('dreieck')).toBeLessThan(err('rechteck') / 5);
  });
});

describe('Gibbs overshoot', () => {
  it('square at N = 50 peaks at ≈ 1.18 (9 % of the jump height 2)', () => {
    const peak = maxValue(coefficients(presetPeriod('rechteck')), 50);
    expect(peak).toBeCloseTo(1.179, 2);
    expect((peak - 1) / 2).toBeCloseTo(0.09, 2);
  });

  it('the peak does not shrink with larger N', () => {
    // a finer period so the sampled coefficients stay close to 4/(πn) up to n = 200
    const c = coefficients(presetPeriod('rechteck', 8192), 200);
    const peaks = [25, 50, 100, 200].map((n) => maxValue(c, n));
    for (const p of peaks) expect(p).toBeCloseTo(1.179, 2);
  });

  it('a smooth signal has no overshoot', () => {
    expect(maxValue(coefficients(presetPeriod('sinus')), 50)).toBeCloseTo(1, 6);
  });
});

describe('paintSegment', () => {
  const Y = 1.5;

  it('fills the samples between two points by linear interpolation', () => {
    const p = new Float64Array(M);
    const a = M / 8;
    const b = M / 4;
    paintSegment(p, 0.125, 0, 0.25, 1, -Y, Y);
    expect(p[a]).toBe(0);
    expect(p[(a + b) / 2]).toBeCloseTo(0.5, 12);
    expect(p[b]).toBe(1);
    // every sample in between was written (monotonic ramp, no gaps)
    for (let k = a + 1; k <= b; k++) expect(p[k]).toBeGreaterThan(p[k - 1]);
    // endpoints between samples: the nearest sample gets the interpolated value
    const q = new Float64Array(M);
    const u0 = 0.1 * M;
    const u1 = 0.2 * M;
    paintSegment(q, 0.1, 0, 0.2, 1, -Y, Y);
    expect(q[Math.round(u0)]).toBeCloseTo((Math.round(u0) - u0) / (u1 - u0), 12);
    expect(q[Math.round(u1)]).toBeCloseTo(Math.min(1, (Math.round(u1) - u0) / (u1 - u0)), 12);
  });

  it('leaves samples outside the touched range unchanged', () => {
    const p = presetPeriod('rechteck');
    const before = Float64Array.from(p);
    paintSegment(p, 0.3, 0.2, 0.25, 0.2, -Y, Y); // right to left
    for (let k = 0; k < M; k++) {
      const inside = k >= Math.round(0.25 * M) && k <= Math.round(0.3 * M);
      expect(p[k]).toBe(inside ? 0.2 : before[k]);
    }
  });

  it('a single point writes the nearest sample', () => {
    const p = new Float64Array(M);
    paintSegment(p, 0.5, 0.7, 0.5, 0.7, -Y, Y);
    expect(p[M / 2]).toBe(0.7);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(0.7, 12);
  });

  it('clamps to the visible y range', () => {
    const p = new Float64Array(M);
    paintSegment(p, 0, 5, 0.125, -5, -Y, Y);
    expect(p[0]).toBe(Y);
    expect(p[M / 8]).toBe(-Y);
  });

  it('wraps across the period boundary (second period of the plot)', () => {
    const p = new Float64Array(M);
    paintSegment(p, 0.99, 1, 1.01, 1, -Y, Y);
    expect(p[M - 1]).toBe(1);
    expect(p[0]).toBe(1);
    expect(p[Math.floor(0.01 * M)]).toBe(1);
    expect(p[Math.round(0.02 * M)]).toBe(0);
    expect(p[M / 2]).toBe(0);
    // t in the second period paints the same samples as in the first
    paintSegment(p, 1.5, -1, 1.5, -1, -Y, Y);
    expect(p[M / 2]).toBe(-1);
  });

  it('a drawn constant shows up as a₀ only', () => {
    const p = new Float64Array(M);
    paintSegment(p, 0, 0.5, 2, 0.5, -Y, Y);
    const c = coefficients(p);
    expect(c.a0).toBeCloseTo(0.5, 12);
    for (let n = 1; n <= N_MAX; n++) expect(c.amp[n]).toBe(0);
  });

  it('a hand-drawn sine-like curve has a dominant a₁', () => {
    const p = new Float64Array(M);
    // coarse polyline with a little "hand" error, like pointer events
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) pts.push([i / 12 + 0.004 * Math.sin(7 * i), 0.9 * Math.sin((2 * Math.PI * i) / 12) + 0.05 * Math.cos(5 * i)]);
    for (let i = 1; i < pts.length; i++) paintSegment(p, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], -Y, Y);
    const c = coefficients(p);
    expect(c.amp[1]).toBeGreaterThan(0.8);
    for (let n = 2; n <= N_MAX; n++) expect(c.amp[n]).toBeLessThan(0.2 * c.amp[1]);
    expect(Math.abs(c.a0)).toBeLessThan(0.1);
  });
});
