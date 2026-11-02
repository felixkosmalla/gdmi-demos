import { describe, expect, it } from 'vitest';
import { analyze, fold, reconstruct, sampleBlock, signal, spectrumLines, spectrumMax, type Component } from './model';

const all: Component[] = [
  { f: 28, a: 1 },
  { f: 84, a: 1 },
  { f: 140, a: 1 },
];

function maxErrorInMiddle(cs: Component[], fs: number, win = 0.1): number {
  const block = sampleBlock(cs, fs, win);
  let max = 0;
  for (let i = 0; i <= 400; i++) {
    const t = win * (0.25 + (0.5 * i) / 400);
    max = Math.max(max, Math.abs(reconstruct(block, t) - signal(cs, t)));
  }
  return max;
}

describe('abtastung model', () => {
  it('slide example f_s = 150 Hz: 140 → 10 Hz and 84 → 66 Hz', () => {
    const r = analyze(all, 150);
    expect(r.verdict).toBe('aliasing');
    expect(r.fMax).toBe(140);
    expect(r.aliases).toEqual([
      { f: 140, alias: 10, vanishes: false },
      { f: 84, alias: 66, vanishes: false },
    ]);
    const aliasLines = spectrumLines(all, 150, 450).filter((l) => l.kind === 'alias');
    expect(aliasLines.map((l) => [l.source, l.f]).sort((x, y) => x[1] - y[1])).toEqual([
      [140, 10],
      [84, 66],
    ]);
  });

  it('every alias line lies inside [0, f_s/2] and equals aliasFrequency', () => {
    for (const fs of [20, 56, 100, 112, 150, 170, 200, 279]) {
      const lines = spectrumLines(all, fs, 900);
      for (const l of lines.filter((x) => x.kind === 'alias')) {
        expect(l.f).toBeGreaterThanOrEqual(0);
        expect(l.f).toBeLessThanOrEqual(fs / 2);
      }
      const a = analyze(all, fs);
      const aliasFs = lines.filter((x) => x.kind === 'alias').map((x) => x.f).sort((x, y) => x - y);
      expect(aliasFs).toEqual(a.aliases.map((x) => x.alias).sort((x, y) => x - y));
    }
  });

  it('copies sit at k·f_s ± f', () => {
    const lines = spectrumLines([{ f: 28, a: 0.5 }], 300, 700);
    expect(lines.map((l) => l.f).sort((x, y) => x - y)).toEqual([28, 272, 328, 572, 628]);
    expect(lines.every((l) => l.a === 0.5)).toBe(true);
    expect(lines.filter((l) => l.kind === 'original').map((l) => l.f)).toEqual([28]);
  });

  it('verdicts at the limits', () => {
    expect(analyze(all, 281).verdict).toBe('ok');
    expect(analyze(all, 280).verdict).toBe('limit');
    expect(analyze(all, 280).atNyquist).toEqual([140]);
    const no140 = all.slice(0, 2);
    expect(analyze(no140, 170).verdict).toBe('ok');
    expect(analyze(no140, 168).verdict).toBe('limit');
    expect(analyze(no140, 167).verdict).toBe('aliasing');
    expect(analyze([{ f: 28, a: 0 }], 10).verdict).toBe('none');
  });

  it('reconstruction is exact above 2·f_max (middle of the window)', () => {
    expect(maxErrorInMiddle(all, 281)).toBeLessThan(0.03);
    expect(maxErrorInMiddle(all, 300)).toBeLessThan(0.01);
    expect(maxErrorInMiddle(all, 600)).toBeLessThan(0.01);
    expect(maxErrorInMiddle(all.slice(0, 2), 170)).toBeLessThan(0.03);
  });

  it('spectrum heights match the samples for every slider position', () => {
    // over one second (f_s samples) the sines at integer frequencies in (0, f_s/2) are orthogonal,
    // so (2/f_s)·Σ x[n]·sin(2πφn/f_s) is exactly the amplitude of the sampled signal at φ
    const sets: Component[][] = [
      all,
      [{ f: 28, a: 1 }, { f: 84, a: 0.6 }, { f: 140, a: 0.3 }],
      [{ f: 28, a: 1 }, { f: 140, a: 1 }],
    ];
    for (const cs of sets) {
      for (let fs = 20; fs <= 600; fs++) {
        const x = Array.from({ length: fs }, (_, n) => signal(cs, n / fs));
        const amplitudeAt = (phi: number): number =>
          phi === 0 || phi === fs / 2
            ? 0
            : Math.abs((2 / fs) * x.reduce((s, v, n) => s + v * Math.sin((2 * Math.PI * phi * n) / fs), 0));
        const lines = spectrumLines(cs, fs, spectrumMax(fs));
        for (const l of lines) {
          const phi = l.f <= fs / 2 ? l.f : fold(l.f, fs).alias;
          expect(l.height, `f_s = ${fs}, line at ${l.f} Hz`).toBeCloseTo(amplitudeAt(phi), 9);
        }
        const silent = x.every((v) => Math.abs(v) < 1e-9);
        expect(analyze(cs, fs).silent, `f_s = ${fs}`).toBe(silent);
      }
    }
  });

  it('reports overlapping and vanishing components', () => {
    const at168 = analyze(all, 168);
    expect(at168.overlaps).toEqual([{ at: 28, sources: [28, 140], net: 0 }]);
    expect(at168.atNyquist).toEqual([84]);
    expect(at168.silent).toBe(true);

    expect(analyze(all, 112).overlaps).toEqual([{ at: 28, sources: [28, 84, 140], net: 1 }]);
    expect(analyze(all.filter((c) => c.f !== 84), 112).overlaps).toEqual([{ at: 28, sources: [28, 140], net: 2 }]);

    const at70 = analyze(all, 70);
    expect(at70.aliases).toEqual([
      { f: 140, alias: 0, vanishes: true },
      { f: 84, alias: 14, vanishes: false },
    ]);
    expect(at70.silent).toBe(false);

    const at150 = analyze(all, 150);
    expect(at150.overlaps).toEqual([]);
    expect(at150.silent).toBe(false);
    expect(spectrumLines(all, 150, 450).every((l) => l.height === l.a)).toBe(true);
  });

  it('reconstruction at f_s = 150 Hz is the aliased signal, not the original', () => {
    const block = sampleBlock(all, 150, 0.1);
    // ideal reconstruction: 28 Hz stays, 84 → 66 Hz and 140 → 10 Hz with flipped sign
    const expected = (t: number): number =>
      Math.sin(2 * Math.PI * 28 * t) - Math.sin(2 * Math.PI * 66 * t) - Math.sin(2 * Math.PI * 10 * t);
    let maxDiff = 0;
    for (let i = 0; i <= 200; i++) {
      const t = 0.025 + (0.05 * i) / 200;
      const r = reconstruct(block, t);
      expect(r).toBeCloseTo(expected(t), 1);
      maxDiff = Math.max(maxDiff, Math.abs(r - signal(all, t)));
    }
    expect(maxDiff).toBeGreaterThan(1);
  });
});
