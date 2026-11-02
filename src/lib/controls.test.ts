import { describe, expect, it } from 'vitest';
import { formatNumber, snapToStep } from './controls';

describe('snapToStep', () => {
  it('rounds to the nearest step, counted from min', () => {
    expect(snapToStep(2.5, 0, 50, 1)).toBe(3); // fourier-reihe ?n=2.5
    expect(snapToStep(2.4, 0, 50, 1)).toBe(2);
    expect(snapToStep(5000.5, 0, 16000, 10)).toBe(5000); // audio-aliasing ?f=5000.5
    expect(snapToStep(0.123, 0, 1.5, 0.01)).toBe(0.12); // zeiger ?a1=0.123
    expect(snapToStep(0.123, 0.05, 2, 0.05)).toBe(0.1); // zeiger ?f1=0.123 (grid 0.05, 0.10, 0.15, …)
    expect(snapToStep(7, 0.5, 10, 0.5)).toBe(7);
    expect(snapToStep(7.3, 0.5, 10, 0.5)).toBe(7.5);
  });

  it('gives clean decimals (no 0.30000000000000004)', () => {
    expect(snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(0.29, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(0.071, 0.03, 0.4, 0.01)).toBe(0.07);
    expect(snapToStep(1.12, 0.05, 2, 0.05)).toBe(1.1);
    expect(snapToStep(-0.4, -180, 180, 5)).toBe(0);
    expect(Object.is(snapToStep(-0.4, -180, 180, 5), -0)).toBe(false);
  });

  it('clamps to [min, max] and stays on the grid below an off-grid max', () => {
    expect(snapToStep(999, 0, 50, 1)).toBe(50);
    expect(snapToStep(-3, 0, 50, 1)).toBe(0);
    expect(snapToStep(1e9, 0, 11025, 10)).toBe(11020);
  });

  it('keeps every default and preset value the demos use (slide links keep their meaning)', () => {
    const cases: [number, number, number, number][] = [
      // [value, min, max, step]
      [150, 20, 600, 1], // abtastung fs (README link ?fs=150), presets 280, 400
      [280, 20, 600, 1],
      [400, 20, 600, 1],
      [1, 0, 1, 0.05], // abtastung a28/a84/a140
      [0.1, 0.03, 0.4, 0.01], // abtastung win
      [1000, 0, 16000, 10], // audio-aliasing f
      [0.2, 0, 1, 0.05], // audio-aliasing vol
      [5, 0, 50, 1], // fourier-reihe n
      [0.33, 0, 1.5, 0.01], // zeiger a3 (preset)
      [0.8, 0, 1.5, 0.01],
      [0.5, 0.05, 2, 0.05], // zeiger f (presets 0.5, 1, 1.1, 1.2, 1.5)
      [1.1, 0.05, 2, 0.05],
      [1.2, 0.05, 2, 0.05],
      [1.5, 0.05, 2, 0.05],
      [60, -180, 180, 5], // zeiger phases
      [150, -180, 180, 5],
      [1, 0.1, 2, 0.05], // zeiger speed
      [20, 2, 30, 1], // zeiger win
      [2, 0.5, 10, 0.5], // template f
    ];
    for (const [v, min, max, step] of cases) expect(snapToStep(v, min, max, step)).toBe(v);
  });
});

describe('formatNumber', () => {
  it('formats with German decimals and no grouping', () => {
    expect(formatNumber(0.25, 2)).toBe('0,25');
    expect(formatNumber(8000)).toBe('8000');
    expect(formatNumber(-1.5, 1)).toBe('-1,5');
  });

  it('never prints "-0": values that round to zero have no sign', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-0.24)).toBe('0');
    expect(formatNumber(-0.004, 2)).toBe('0,00');
    expect(formatNumber(-1e-12, 1)).toBe('0,0');
    expect(formatNumber(-0.6)).toBe('-1');
    expect(formatNumber(-0.005, 2)).toBe('-0,01');
  });
});
