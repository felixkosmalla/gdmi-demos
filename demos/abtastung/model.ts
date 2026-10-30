/**
 * Pure math for the `abtastung` demo (no DOM): the test signal, its samples,
 * the ideal reconstruction, the analytic spectrum with its copies, and the
 * aliasing analysis behind the status line. Tested in model.test.ts.
 */
import { aliasFrequency, sincReconstructUniform } from '../../src/lib/dsp';

/** One sine component a·sin(2π f t). */
export interface Component {
  f: number;
  a: number;
}

/** The three frequencies from the slide (d07, slide 26). */
export const FREQS = [28, 84, 140] as const;

/** x(t) = Σ a·sin(2π f t). */
export function signal(cs: readonly Component[], t: number): number {
  let s = 0;
  for (const c of cs) s += c.a * Math.sin(2 * Math.PI * c.f * t);
  return s;
}

/**
 * Samples kept on each side of the visible window for the reconstruction.
 * The truncated sinc sum converges slowly for components just below f_s/2
 * (e.g. 140 Hz at f_s = 281 Hz); with 3000 samples per side the error in the
 * window stays around 0.01 (sub-pixel), and the cost is ~6000 operations per
 * pixel column.
 */
export const MARGIN_SAMPLES = 3000;

export interface SampleBlock {
  /** Time of values[0] in s. */
  t0: number;
  fs: number;
  values: Float64Array;
  /** Index range of the samples inside the visible window [0, win]. */
  first: number;
  last: number;
}

/** Samples x(n/f_s) for the window [0, win] plus `margin` samples on each side. */
export function sampleBlock(cs: readonly Component[], fs: number, win: number, margin = MARGIN_SAMPLES): SampleBlock {
  const nEnd = Math.floor(win * fs + 1e-9);
  const n0 = -margin;
  const count = nEnd + 2 * margin + 1;
  const values = new Float64Array(count);
  for (let i = 0; i < count; i++) values[i] = signal(cs, (n0 + i) / fs);
  return { t0: n0 / fs, fs, values, first: margin, last: margin + nEnd };
}

/** Ideal (sinc) reconstruction from the block's samples at time t (s). */
export function reconstruct(block: SampleBlock, t: number): number {
  return sincReconstructUniform(block.t0, block.values, block.fs, t);
}

export type LineKind = 'original' | 'copy' | 'alias';

export interface SpectrumLine {
  /** Position in Hz (≥ 0). */
  f: number;
  /** Amplitude (= amplitude of the source component). */
  a: number;
  /** Frequency of the original component this line comes from. */
  source: number;
  /** Line position = k·f_s + sign·source. */
  k: number;
  sign: 1 | -1;
  /**
   * `original`: the component itself (k = 0).
   * `alias`: the copy of a component above f_s/2 that lands inside [0, f_s/2] –
   *   kept by the reconstruction instead of the original.
   * `copy`: any other spectral copy.
   */
  kind: LineKind;
}

/**
 * Lines of the sampled signal's spectrum in [0, fMax]: every component f
 * appears at k·f_s ± f for all integers k (positive frequencies only, so the
 * copies from k = −2…2 and beyond that land at f ≥ 0 are all included).
 */
export function spectrumLines(cs: readonly Component[], fs: number, fMax: number): SpectrumLine[] {
  const out: SpectrumLine[] = [];
  const eps = 1e-9;
  for (const c of cs) {
    if (!(c.a > 0)) continue;
    const above = c.f > fs / 2 + eps;
    const seen = new Set<string>();
    const kMax = Math.ceil((fMax + c.f) / fs) + 1;
    for (let k = -kMax; k <= kMax; k++) {
      for (const sign of [1, -1] as const) {
        const f = Math.max(0, k * fs + sign * c.f);
        if (k * fs + sign * c.f < -eps || f > fMax + eps) continue;
        // copies of one component can coincide (at 0 and at f_s/2): keep one line
        const key = f.toFixed(6);
        if (seen.has(key)) continue;
        seen.add(key);
        let kind: LineKind = 'copy';
        if (k === 0 && sign === 1) kind = 'original';
        else if (above && f <= fs / 2 + eps) kind = 'alias';
        out.push({ f, a: c.a, source: c.f, k, sign, kind });
      }
    }
  }
  return out;
}

export interface AliasInfo {
  /** Original frequency. */
  f: number;
  /** Frequency it appears at after sampling, in [0, f_s/2]. */
  alias: number;
}

export interface Analysis {
  /** Highest active frequency (0 without an active component). */
  fMax: number;
  /**
   * `none`: no active component. `ok`: f_s > 2·f_max. `limit`: f_s = 2·f_max
   * exactly. `aliasing`: f_s < 2·f_max.
   */
  verdict: 'none' | 'ok' | 'limit' | 'aliasing';
  /** Components above f_s/2, highest first, with their alias frequency. */
  aliases: AliasInfo[];
  /** Components exactly at f_s/2. */
  atNyquist: number[];
}

/** Which components alias at sample rate fs (only components with a > 0 count). */
export function analyze(cs: readonly Component[], fs: number): Analysis {
  const active = cs.filter((c) => c.a > 0).map((c) => c.f);
  const fMax = active.length ? Math.max(...active) : 0;
  const eps = 1e-9;
  const sorted = [...active].sort((x, y) => y - x);
  const aliases = sorted.filter((f) => f > fs / 2 + eps).map((f) => ({ f, alias: aliasFrequency(f, fs) }));
  const atNyquist = sorted.filter((f) => Math.abs(f - fs / 2) <= eps);
  let verdict: Analysis['verdict'];
  if (!active.length) verdict = 'none';
  else if (fs > 2 * fMax + eps) verdict = 'ok';
  else if (Math.abs(fs - 2 * fMax) <= eps) verdict = 'limit';
  else verdict = 'aliasing';
  return { fMax, verdict, aliases, atNyquist };
}

/** Right end of the spectrum's frequency axis: fixed 450 Hz up to f_s = 290 Hz, then grows so the copies around f_s stay visible. */
export function spectrumMax(fs: number): number {
  return Math.max(450, Math.ceil((fs + 160) / 50) * 50);
}
