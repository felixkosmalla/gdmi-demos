// Pure math for the "Fourier-Reihe" demo: one period of a signal as M samples
// (presets and drawings use the same representation), its Fourier
// coefficients, painting a pointer stroke into the samples, and the largest
// value of the approximation (Gibbs overshoot). Time t is measured in periods.
import { fourierSeries, fourierSynthesize, type FourierCoefficients } from '../../src/lib/dsp';

/**
 * Samples per period (a power of two, so fourierSeries uses the FFT). Not 512:
 * a sampled jump gives aₙ = (4/M)·cot(πn/M) instead of 4/(πn), at M = 512 about
 * 3 % too small at n = 50, so the Gibbs peak would read 1,17 instead of 1,18
 * and sink slightly with N. At 2048 the error is 0,2 %.
 */
export const M = 2048;
/** Largest number of harmonics the demo offers. */
export const N_MAX = 50;

export type Preset = 'rechteck' | 'dreieck' | 'saegezahn' | 'sinus';

/**
 * One period of a preset with amplitude ±1, sampled at t = k/m. All presets are
 * odd (x(−t) = −x(t)), so they start at 0 and their phases are 90° or 270°.
 * At a jump the sample takes the mean of both sides (0), the value the Fourier
 * series converges to there; this keeps the sampled period exactly odd.
 */
export function presetPeriod(name: Preset, m = M): Float64Array {
  const out = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    const t = k / m;
    switch (name) {
      case 'rechteck': // +1 in the first half, −1 in the second
        out[k] = k === 0 || 2 * k === m ? 0 : t < 0.5 ? 1 : -1;
        break;
      case 'dreieck': // 0 → 1 at T/4 → −1 at 3T/4 → 0
        out[k] = t < 0.25 ? 4 * t : t < 0.75 ? 2 - 4 * t : 4 * t - 4;
        break;
      case 'saegezahn': // ramp from −1 to +1 over the whole period
        out[k] = k === 0 ? 0 : 2 * t - 1;
        break;
      case 'sinus':
        out[k] = Math.sin(2 * Math.PI * t);
        break;
    }
  }
  return out;
}

/** Coefficients a₀, aₙ, θₙ for n = 0…nMax (default {@link N_MAX}). */
export function coefficients(period: ArrayLike<number>, nMax = N_MAX): FourierCoefficients {
  return fourierSeries(period, nMax);
}

/**
 * Paints a straight stroke from (t0, y0) to (t1, y1) into `period` (in place):
 * every sample index between the two points gets the linearly interpolated
 * value, so fast pointer moves leave no gaps, and samples outside the touched
 * x range stay as they are. t is in periods and may lie outside [0, 1) (a plot
 * showing two periods); indices wrap modulo the period length. y is clamped
 * to [yMin, yMax]. A stroke never covers more than one period.
 */
export function paintSegment(
  period: Float64Array,
  t0: number,
  y0: number,
  t1: number,
  y1: number,
  yMin: number,
  yMax: number,
): void {
  const m = period.length;
  const clamp = (y: number): number => Math.min(yMax, Math.max(yMin, y));
  let u0 = t0 * m;
  let u1 = t1 * m;
  let v0 = clamp(y0);
  let v1 = clamp(y1);
  if (u1 < u0) {
    [u0, u1] = [u1, u0];
    [v0, v1] = [v1, v0];
  }
  const k0 = Math.round(u0);
  const k1 = Math.min(Math.round(u1), k0 + m - 1);
  for (let k = k0; k <= k1; k++) {
    const u = Math.min(u1, Math.max(u0, k));
    const v = u1 === u0 ? v1 : v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
    period[((k % m) + m) % m] = v;
  }
}

/** Largest value of the approximation with n harmonics over one period (sampled densely). */
export function maxValue(coeffs: FourierCoefficients, n: number, steps = Math.max(4096, 40 * n)): number {
  let max = -Infinity;
  for (let i = 0; i < steps; i++) max = Math.max(max, fourierSynthesize(coeffs, n, i / steps));
  return max;
}
