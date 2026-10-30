/**
 * Pure math for the `audio-aliasing` demo (no DOM, no Web Audio): the sine
 * that ideal reconstruction makes of a sampled sine, and the frequency
 * "programs" (sweep, A/B comparison) that both the sound and the UI follow.
 * Tested in model.test.ts.
 */
import { aliasFrequency } from '../../src/lib/dsp';

/** Ideal reconstruction of the samples sin(2π f n / f_s): sign · sin(2π f t). */
export interface AliasSine {
  /** Alias frequency in [0, f_s/2]. */
  f: number;
  /** −1 above f_s/2 (samples equal those of −sin), 0 at exactly f_s/2 (all samples 0). */
  sign: 1 | -1 | 0;
}

/** The sine through the samples of sin(2π f t) taken at f_s (f ≥ 0). */
export function aliasSine(f: number, fs: number): AliasSine {
  const r = f % fs;
  const sign = r > fs / 2 ? -1 : r === fs / 2 ? 0 : 1;
  return { f: aliasFrequency(f, fs), sign };
}

/** A point of a frequency program: the input frequency is `f` at `t` seconds after the start. */
export interface FreqPoint {
  t: number;
  f: number;
  /** Reached by a linear ramp from the previous point (otherwise a jump at `t`). */
  ramp?: boolean;
}

/** Duration of one sweep direction in s. */
export const SWEEP_SECONDS = 10;

/** Sweep 0 → f_s in {@link SWEEP_SECONDS}, and back to 0 if `upDown`. */
export function sweepProgram(fs: number, upDown: boolean): FreqPoint[] {
  const p: FreqPoint[] = [
    { t: 0, f: 0 },
    { t: SWEEP_SECONDS, f: fs, ramp: true },
  ];
  if (upDown) p.push({ t: 2 * SWEEP_SECONDS, f: 0, ramp: true });
  return p;
}

/** Input frequency A of the A/B comparison; B = f_s − A has the same samples (up to the sign). */
export const AB_FREQUENCY = 3000;

/** A/B comparison: A, B, A for 1 s each (the last point only marks the end). */
export function abProgram(fs: number, fA = AB_FREQUENCY): FreqPoint[] {
  return [
    { t: 0, f: fA },
    { t: 1, f: fs - fA },
    { t: 2, f: fA },
    { t: 3, f: fA },
  ];
}

export function programDuration(p: readonly FreqPoint[]): number {
  return p[p.length - 1].t;
}

/** Input frequency of a program at time t (s after the start), held before the start and after the end. */
export function frequencyAt(p: readonly FreqPoint[], t: number): number {
  if (t <= p[0].t) return p[0].f;
  for (let i = 1; i < p.length; i++) {
    const b = p[i];
    if (t < b.t) {
      const a = p[i - 1];
      return b.ramp ? a.f + ((b.f - a.f) * (t - a.t)) / (b.t - a.t) : a.f;
    }
  }
  return p[p.length - 1].f;
}

/**
 * The same program in terms of the alias frequency (what you hear). A linear
 * ramp of f becomes a zigzag, so ramps are split where f crosses a multiple of
 * f_s/2. Used by the fallback sound, which plays the alias frequency directly.
 */
export function aliasProgram(p: readonly FreqPoint[], fs: number): FreqPoint[] {
  const half = fs / 2;
  const out: FreqPoint[] = [{ t: p[0].t, f: aliasFrequency(p[0].f, fs) }];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    if (b.ramp && b.f !== a.f) {
      const lo = Math.min(a.f, b.f);
      const hi = Math.max(a.f, b.f);
      const folds: number[] = [];
      for (let k = Math.floor(lo / half) + 1; k * half < hi; k++) folds.push(k * half);
      if (b.f < a.f) folds.reverse();
      for (const fk of folds) {
        out.push({ t: a.t + ((fk - a.f) / (b.f - a.f)) * (b.t - a.t), f: aliasFrequency(fk, fs), ramp: true });
      }
    }
    out.push({ t: b.t, f: aliasFrequency(b.f, fs), ramp: b.ramp });
  }
  return out;
}
