// Pure math for "Frequenzraum bei Bilddaten": luminance, slicing a row or
// column, its spectrum, a simple FFT low-pass, and URL parameter cleanup.
// No DOM access, so everything here is unit-tested in model.test.ts.
import { fft, ifft, magnitudeSpectrum } from '../../src/lib/dsp';
import { CHECKER_SQUARES, N, PATTERNS, STRIPES_COARSE, STRIPES_FINE } from './patterns';

export type Direction = 'zeile' | 'spalte';

/** Values of the `img` URL parameter (the own image is local only, never in the URL). */
export const IMAGES = [...PATTERNS, 'foto'] as const;
export type ImageId = (typeof IMAGES)[number];

/** Highest spatial frequency (bin) of a line of N pixels. */
export const K_MAX = N / 2;
/** "Low frequencies" for the energy readout: k ≤ K_LOW. */
export const K_LOW = 16;

/**
 * Brightness Y = 0.2126·R + 0.7152·G + 0.0722·B (Rec. 709 weights, applied to
 * the sRGB values as stored) per pixel of RGBA data.
 */
export function luminance(rgba: ArrayLike<number>): Float64Array {
  const out = new Float64Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2];
  }
  return out;
}

/** Row y (dir 'zeile', values over x) or column x (dir 'spalte', values over y) of an n × n image. */
export function extractLine(lum: ArrayLike<number>, n: number, dir: Direction, index: number): Float64Array {
  const out = new Float64Array(n);
  if (dir === 'zeile') for (let x = 0; x < n; x++) out[x] = lum[index * n + x];
  else for (let y = 0; y < n; y++) out[y] = lum[y * n + index];
  return out;
}

/** Pixel index of a line position given as a fraction 0…1 of the image height/width. */
export function lineIndex(pos: number, n = N): number {
  return Math.min(n - 1, Math.max(0, Math.round(pos * (n - 1))));
}

/** Inverse of {@link lineIndex}, rounded to 4 decimals for a short URL (lineIndex still recovers the index). */
export function posOfIndex(index: number, n = N): number {
  return Math.round((index / (n - 1)) * 1e4) / 1e4;
}

/**
 * Amplitude spectrum of a line for k = 0 … n/2 (cycles per image width/height).
 * A cosine with amplitude A and k periods across the line gives A at bin k,
 * bin 0 is the mean brightness (Gleichanteil).
 */
export function lineSpectrum(line: ArrayLike<number>, hann = false): Float64Array {
  return magnitudeSpectrum(line, { window: hann ? 'hann' : 'none' });
}

/** Bin k ≥ 1 with the largest amplitude, or -1 if the line is constant. */
export function peakBin(spec: ArrayLike<number>): number {
  let best = -1;
  let max = 1e-9;
  for (let k = 1; k < spec.length; k++) {
    if (spec[k] > max) {
      max = spec[k];
      best = k;
    }
  }
  return best;
}

/**
 * Share of the AC energy (without the mean, k = 0) in the bins 1 … kLow, for an
 * amplitude spectrum from {@link lineSpectrum}. A cosine of amplitude A has the
 * power A²/2, the bin at n/2 (alternating ±A) has A². NaN for a constant line.
 */
export function lowEnergyShare(spec: ArrayLike<number>, kLow: number): number {
  const last = spec.length - 1;
  let low = 0;
  let total = 0;
  for (let k = 1; k <= last; k++) {
    const e = (k === last ? 1 : 0.5) * spec[k] * spec[k];
    total += e;
    if (k <= kLow) low += e;
  }
  return total > 1e-12 ? low / total : NaN;
}

/** Ideal low-pass: keeps the frequencies k ≤ cutoff (and the mean), removes all higher ones. */
export function lowpass(line: ArrayLike<number>, cutoff: number): Float64Array {
  const n = line.length;
  const re = Float64Array.from(line);
  const im = new Float64Array(n);
  fft(re, im);
  for (let k = 0; k < n; k++) {
    if (Math.min(k, n - k) > cutoff) {
      re[k] = 0;
      im[k] = 0;
    }
  }
  ifft(re, im);
  return re;
}

/**
 * Largest AC amplitude (k ≥ 1) over all rows or all columns of an image. Used as
 * a fixed linear y range per image, so the axis doesn't jump while dragging.
 */
export function maxAcAmplitude(lum: ArrayLike<number>, n: number, dir: Direction, hann = false): number {
  let max = 0;
  for (let i = 0; i < n; i++) {
    const spec = lineSpectrum(extractLine(lum, n, dir, i), hann);
    for (let k = 1; k < spec.length; k++) if (spec[k] > max) max = spec[k];
  }
  return max;
}

export interface Params {
  img: string;
  dir: string;
  pos: number;
  tp: number;
}

/** Replaces invalid URL values: unknown image/direction → default, pos clamped to 0…1, cutoff to 1…K_MAX (integer). */
export function normalizeParams(p: Params, defaults: Params): Params {
  return {
    img: (IMAGES as readonly string[]).includes(p.img) ? p.img : defaults.img,
    dir: p.dir === 'zeile' || p.dir === 'spalte' ? p.dir : defaults.dir,
    pos: Math.min(1, Math.max(0, p.pos)),
    tp: Math.min(K_MAX, Math.max(1, Math.round(p.tp))),
  };
}

/** Info-tip text for "Ortsfrequenz", adapted to the shown image and the line direction. */
export function ortsfrequenzInfo(id: ImageId | 'eigenes', dir: Direction): string {
  const across = dir === 'zeile' ? 'Bildbreite' : 'Bildhöhe';
  const def = `Ortsfrequenz k: Perioden pro ${across}, also wie oft sich die Helligkeit entlang der Linie wiederholt. `;
  const flat = dir === 'spalte' && (id === 'streifen-grob' || id === 'streifen-fein' || id === 'kante');
  if (flat) return def + 'Hier ändert sich die Helligkeit entlang der Linie nicht: Es gibt nur k = 0, den Mittelwert.';
  switch (id) {
    case 'streifen-grob':
    case 'streifen-fein': {
      const n = id === 'streifen-grob' ? STRIPES_COARSE : STRIPES_FINE;
      return def + `Hier passen ${n} Hell-Dunkel-Streifen ins Bild, der einzige Gipfel liegt bei k = ${n}.`;
    }
    case 'schachbrett': {
      const n = CHECKER_SQUARES / 2;
      return def + `Hier wiederholt sich ein Feldpaar (hell, dunkel) ${n}-mal, der stärkste Gipfel liegt bei k = ${n}.`;
    }
    case 'verlauf':
      return def + 'Der weiche Verlauf ändert sich langsam: Es kommen fast nur kleine k vor.';
    case 'kante':
      return def + 'Die Kante enthält viele Frequenzen (k = 1, 3, 5, …), die mit wachsendem k schwächer werden.';
    default: // foto, eigenes
      return def + 'Glatte Flächen ergeben kleine k, feine Details und Kanten große k.';
  }
}
