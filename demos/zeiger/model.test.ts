import { describe, expect, it } from 'vitest';
import { beatPeriod, chain, commonPeriod, equalFrequencySum, sum, type Pointer } from './model';

const two = (p2: number): Pointer[] => [
  { a: 1, f: 0.5, p: 0 },
  { a: 1, f: 0.5, p: p2 },
];

describe('zeiger model', () => {
  it('equal frequencies: 180° cancels, 0° doubles, 90° gives √2', () => {
    expect(equalFrequencySum(two(180))?.a).toBeCloseTo(0, 9);
    expect(equalFrequencySum(two(0))?.a).toBeCloseTo(2, 9);
    expect(equalFrequencySum(two(90))?.a).toBeCloseTo(Math.SQRT2, 9);
    expect(equalFrequencySum(two(90))?.p).toBeCloseTo(45, 9);
    for (let t = 0; t < 3; t += 0.37) expect(sum(two(180), t)).toBeCloseTo(0, 9);
  });

  it('matches A = √(A₁² + A₂² + 2A₁A₂·cos(φ₁ − φ₂))', () => {
    const ptrs: Pointer[] = [
      { a: 1, f: 1, p: 20 },
      { a: 0.6, f: 1, p: -110 },
    ];
    const expected = Math.sqrt(1 + 0.36 + 2 * 0.6 * Math.cos(130 * (Math.PI / 180)));
    expect(equalFrequencySum(ptrs)?.a).toBeCloseTo(expected, 9);
    // the sum really is that sine
    const s = equalFrequencySum(ptrs)!;
    for (let t = 0; t < 2; t += 0.13) {
      expect(sum(ptrs, t)).toBeCloseTo(s.a * Math.sin(2 * Math.PI * t + s.p * (Math.PI / 180)), 9);
    }
  });

  it('different frequencies: no equal-frequency sum', () => {
    expect(equalFrequencySum([{ a: 1, f: 0.5, p: 0 }, { a: 1, f: 1, p: 0 }])).toBeNull();
    // a pointer with amplitude 0 does not count
    expect(equalFrequencySum([{ a: 1, f: 0.5, p: 0 }, { a: 0, f: 1, p: 0 }])?.a).toBeCloseTo(1, 9);
  });

  it('chain ends at the sum and starts at the origin', () => {
    const ptrs: Pointer[] = [
      { a: 1, f: 0.5, p: 0 },
      { a: 0.5, f: 1, p: 30 },
      { a: 0.33, f: 1.5, p: -60 },
    ];
    const t = 0.83;
    const pts = chain(ptrs, t);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[3][1]).toBeCloseTo(sum(ptrs, t), 12);
  });

  it('period = 1 / ggT of the frequencies', () => {
    expect(commonPeriod([{ a: 1, f: 0.5, p: 0 }, { a: 0.5, f: 1, p: 0 }])).toBeCloseTo(2, 9);
    expect(commonPeriod([{ a: 1, f: 1, p: 0 }, { a: 1, f: 1.1, p: 0 }])).toBeCloseTo(10, 9);
    expect(commonPeriod([{ a: 1, f: 0.25, p: 0 }, { a: 1, f: 0.75, p: 0 }, { a: 1, f: 1.25, p: 0 }])).toBeCloseTo(4, 9);
    expect(commonPeriod([{ a: 1, f: Math.SQRT2, p: 0 }])).toBeNull();
  });

  it('beat period 1/|f₁ − f₂| only for close frequencies', () => {
    expect(beatPeriod([{ a: 1, f: 1, p: 0 }, { a: 1, f: 1.1, p: 0 }])).toBeCloseTo(10, 9);
    expect(beatPeriod([{ a: 1, f: 0.5, p: 0 }, { a: 1, f: 1, p: 0 }])).toBeNull();
    expect(beatPeriod([{ a: 1, f: 1, p: 0 }, { a: 1, f: 1, p: 0 }])).toBeNull();
  });

  it('the envelope of the beat repeats after 1/|f₁ − f₂|', () => {
    // equal amplitudes: |Σ| = 2|cos(π Δf t)|, minima at t = (k + ½)/Δf
    const ptrs: Pointer[] = [
      { a: 1, f: 1, p: 0 },
      { a: 1, f: 1.1, p: 0 },
    ];
    const mag = (t: number): number => Math.hypot(...chain(ptrs, t)[2]);
    expect(mag(5)).toBeCloseTo(0, 9);
    expect(mag(15)).toBeCloseTo(0, 9);
    expect(mag(10)).toBeCloseTo(2, 9);
  });
});
