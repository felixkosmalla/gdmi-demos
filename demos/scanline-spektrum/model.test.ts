import { describe, expect, it } from 'vitest';
import {
  BRIGHTNESS_RANGE,
  K_MAX,
  extractLine,
  growRange,
  keptEnergyShare,
  lineIndex,
  lineSpectrum,
  lowEnergyShare,
  lowpass,
  luminance,
  maxAcAmplitude,
  normalizeParams,
  ortsfrequenzInfo,
  peakBin,
  posOfIndex,
} from './model';
import { HI, LO, N, STRIPES_COARSE, patternLuminance } from './patterns';

const cosLine = (k: number, a: number, n = N): Float64Array =>
  Float64Array.from({ length: n }, (_, x) => a * Math.cos((2 * Math.PI * k * x) / n));

describe('luminance', () => {
  it('uses the Rec. 709 weights', () => {
    const y = luminance([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 100, 100, 100, 0]);
    expect(y[0]).toBeCloseTo(0.2126 * 255, 9);
    expect(y[1]).toBeCloseTo(0.7152 * 255, 9);
    expect(y[2]).toBeCloseTo(0.0722 * 255, 9);
    expect(y[3]).toBeCloseTo(100, 9); // grey stays grey, alpha is ignored
  });
});

describe('lines', () => {
  // 4 × 4 image with value 10·y + x
  const img = Float64Array.from({ length: 16 }, (_, i) => 10 * Math.floor(i / 4) + (i % 4));

  it('extracts a row (over x) and a column (over y)', () => {
    expect([...extractLine(img, 4, 'zeile', 2)]).toEqual([20, 21, 22, 23]);
    expect([...extractLine(img, 4, 'spalte', 1)]).toEqual([1, 11, 21, 31]);
  });

  it('maps positions 0…1 to pixel indices and back', () => {
    expect(lineIndex(0)).toBe(0);
    expect(lineIndex(1)).toBe(N - 1);
    expect(lineIndex(0.5)).toBe(256);
    expect(lineIndex(-3)).toBe(0);
    expect(lineIndex(7)).toBe(N - 1);
    for (let i = 0; i < N; i++) expect(lineIndex(posOfIndex(i))).toBe(i);
    expect(posOfIndex(153)).toBe(0.2994); // short URL value
  });
});

describe('spectrum of a line', () => {
  it('a cosine with k periods gives its amplitude at bin k; bin 0 is the mean', () => {
    const line = cosLine(20, 50).map((v) => v + 100);
    const spec = lineSpectrum(line);
    expect(spec.length).toBe(K_MAX + 1);
    expect(spec[0]).toBeCloseTo(100, 9);
    expect(spec[20]).toBeCloseTo(50, 9);
    expect(peakBin(spec)).toBe(20);
  });

  it('peakBin ignores the mean and returns -1 for a constant line', () => {
    expect(peakBin([100, 0, 3, 1])).toBe(2);
    expect(peakBin([100, 0, 0, 0])).toBe(-1);
  });

  it('a Hann window spreads a peak to its neighbours but keeps it in place', () => {
    const spec = lineSpectrum(cosLine(20, 50), true);
    expect(peakBin(spec)).toBe(20);
    expect(spec[20]).toBeCloseTo(50, 6);
    expect(spec[19]).toBeCloseTo(25, 6);
    expect(spec[22]).toBeLessThan(1e-9);
  });

  it('with a Hann window the mean stays at k = 0 (no leak into k = 1)', () => {
    const constant = lineSpectrum(new Float64Array(N).fill(128), true);
    expect(constant[0]).toBeCloseTo(128, 9);
    expect(peakBin(constant)).toBe(-1);
    const stripes = lineSpectrum(extractLine(patternLuminance('streifen-grob'), N, 'zeile', 0), true);
    expect(stripes[0]).toBeCloseTo((LO + HI) / 2, 9);
    expect(stripes[1]).toBeLessThan(1e-9);
    expect(peakBin(stripes)).toBe(STRIPES_COARSE);
    expect(peakBin(lineSpectrum(extractLine(patternLuminance('schachbrett'), N, 'zeile', 0), true))).toBe(4);
  });
});

describe('lowEnergyShare', () => {
  it('splits the AC energy (Parseval) and ignores the mean', () => {
    const line = cosLine(4, 3).map((v, x) => v + 4 * Math.cos((2 * Math.PI * 40 * x) / N) + 200);
    const spec = lineSpectrum(line);
    expect(lowEnergyShare(spec, 16)).toBeCloseTo(9 / 25, 9); // 3² / (3² + 4²)
    expect(lowEnergyShare(spec, K_MAX)).toBeCloseTo(1, 12);
  });

  it('counts the bin at N/2 with its full power', () => {
    const alt = Float64Array.from({ length: N }, (_, x) => (x % 2 ? -1 : 1));
    const spec = lineSpectrum(alt.map((v, x) => v + Math.cos((2 * Math.PI * x) / N)));
    expect(lowEnergyShare(spec, 1)).toBeCloseTo(0.5 / 1.5, 9);
  });

  it('is NaN for a constant line', () => {
    expect(lowEnergyShare(lineSpectrum(new Float64Array(N).fill(7)), 16)).toBeNaN();
  });
});

describe('lowpass', () => {
  const line = cosLine(3, 40).map((v, x) => v + 10 * Math.sin((2 * Math.PI * 100 * x) / N) + 120);

  it('removes frequencies above the cutoff and keeps the rest', () => {
    const low = lowpass(line, 50);
    for (let x = 0; x < N; x++) expect(low[x]).toBeCloseTo(120 + 40 * Math.cos((2 * Math.PI * 3 * x) / N), 9);
  });

  it('keeps the line unchanged at cutoff K_MAX', () => {
    const same = lowpass(line, K_MAX);
    for (let x = 0; x < N; x++) expect(same[x]).toBeCloseTo(line[x], 9);
  });

  it('keptEnergyShare is the share of the filtered curve, also when the spectrum uses a Hann window', () => {
    expect(keptEnergyShare(line, lowpass(line, 50))).toBeCloseTo(40 ** 2 / (40 ** 2 + 10 ** 2), 9);
    // Kante row: the windowed spectrum gives a different share than the low-pass actually keeps
    const edge = extractLine(patternLuminance('kante'), N, 'zeile', 0);
    const kept = keptEnergyShare(edge, lowpass(edge, 10));
    expect(kept).toBeCloseTo(lowEnergyShare(lineSpectrum(edge), 10), 9);
    expect(Math.abs(kept - lowEnergyShare(lineSpectrum(edge, true), 10))).toBeGreaterThan(0.01);
    expect(keptEnergyShare(new Float64Array(N).fill(5), new Float64Array(N).fill(5))).toBeNaN();
  });
});

describe('growRange', () => {
  it('keeps 0 … 255 while the values fit', () => {
    expect(growRange(BRIGHTNESS_RANGE, [0, 128, 255])).toEqual([0, 255]);
  });

  it('widens to the low-pass overshoot of a 0/255 line, in steps of 10', () => {
    const edge = Float64Array.from({ length: N }, (_, x) => (x < N / 2 ? 0 : 255));
    const low = lowpass(edge, 100);
    expect(Math.min(...low)).toBeLessThan(-20);
    const [lo, hi] = growRange(BRIGHTNESS_RANGE, low);
    expect(lo).toBeLessThanOrEqual(Math.min(...low));
    expect(hi).toBeGreaterThanOrEqual(Math.max(...low));
    expect(Number.isInteger(lo / 10) && Number.isInteger(hi / 10)).toBe(true);
    expect(lo).toBeGreaterThan(Math.min(...low) - 10);
  });

  it('never shrinks a range that was already widened', () => {
    expect(growRange([-30, 290], [0, 255])).toEqual([-30, 290]);
    expect(growRange([-30, 260], [-5, 271])).toEqual([-30, 280]);
  });
});

describe('maxAcAmplitude', () => {
  it('is the largest AC amplitude over all rows or columns', () => {
    const n = 8;
    // row y: cosine with amplitude y over x, so every column is constant per row … but varies over y
    const img = new Float64Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) img[y * n + x] = 50 + y * Math.cos((2 * Math.PI * x) / n);
    expect(maxAcAmplitude(img, n, 'zeile')).toBeCloseTo(n - 1, 9);
    expect(maxAcAmplitude(new Float64Array(n * n).fill(3), n, 'spalte')).toBe(0);
    expect(maxAcAmplitude(new Float64Array(n * n).fill(3), n, 'spalte', true)).toBeLessThan(1e-9);
  });
});

describe('normalizeParams', () => {
  const defaults = { img: 'foto', dir: 'zeile', pos: 0.5, tp: K_MAX };

  it('keeps valid values', () => {
    const p = { img: 'streifen-fein', dir: 'spalte', pos: 0.3, tp: 20 };
    expect(normalizeParams(p, defaults)).toEqual(p);
  });

  it('replaces unknown names and clamps numbers', () => {
    expect(normalizeParams({ img: 'eigenes', dir: 'diagonal', pos: 1.7, tp: 999 }, defaults)).toEqual({
      img: 'foto',
      dir: 'zeile',
      pos: 1,
      tp: K_MAX,
    });
    expect(normalizeParams({ img: 'kante', dir: 'zeile', pos: -2, tp: 3.6 }, defaults)).toMatchObject({ pos: 0, tp: 4 });
    expect(normalizeParams({ img: 'kante', dir: 'zeile', pos: 0, tp: 0 }, defaults).tp).toBe(1);
  });
});

describe('ortsfrequenzInfo', () => {
  it('names the stripe count and direction', () => {
    expect(ortsfrequenzInfo('streifen-fein', 'zeile')).toContain('k = 32');
    expect(ortsfrequenzInfo('streifen-grob', 'zeile')).toContain('k = 8');
    expect(ortsfrequenzInfo('foto', 'spalte')).toContain('Bildhöhe');
    expect(ortsfrequenzInfo('foto', 'zeile')).toContain('Bildbreite');
  });
  it('explains the odd k of the Kante with the periodic continuation', () => {
    const tip = ortsfrequenzInfo('kante', 'zeile');
    expect(tip).toContain('k = 1, 3, 5');
    expect(tip).toContain('periodisch');
    expect(tip).toContain('Rechteck');
  });
  it('says a column of stripes is constant', () => {
    expect(ortsfrequenzInfo('streifen-grob', 'spalte')).toContain('nur k = 0');
  });
});
