/**
 * Pure math for the `zeiger` demo (no DOM): rotating pointers (phasors)
 * A·e^{i(2πft + φ)}, their tip-to-tail chain, the projection Im(Σ) shown in
 * the time plot, and the readouts (equal-frequency sum, period, beat period).
 * Tested in model.test.ts.
 */

export interface Pointer {
  /** Amplitude (pointer length). */
  a: number;
  /** Frequency in Hz (rotations per second of demo time). */
  f: number;
  /** Start angle in degrees. */
  p: number;
}

const DEG = Math.PI / 180;

/** Angle of a pointer at time t in radians. */
export function angle(ptr: Pointer, t: number): number {
  return 2 * Math.PI * ptr.f * t + ptr.p * DEG;
}

/** The oscillation of one pointer: Im(A·e^{i(2πft + φ)}) = A·sin(2πft + φ). */
export function component(ptr: Pointer, t: number): number {
  return ptr.a * Math.sin(angle(ptr, t));
}

/** The summed oscillation Im(Σ pointers) at time t. */
export function sum(ptrs: readonly Pointer[], t: number): number {
  let y = 0;
  for (const ptr of ptrs) y += component(ptr, t);
  return y;
}

/**
 * Tip-to-tail chain at time t: the origin followed by the tip of each pointer
 * (pointer k starts at the tip of pointer k − 1). The last point is the sum.
 */
export function chain(ptrs: readonly Pointer[], t: number): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  let x = 0;
  let y = 0;
  for (const ptr of ptrs) {
    const w = angle(ptr, t);
    x += ptr.a * Math.cos(w);
    y += ptr.a * Math.sin(w);
    pts.push([x, y]);
  }
  return pts;
}

/** Pointers that contribute (amplitude > 0). */
export function active(ptrs: readonly Pointer[]): Pointer[] {
  return ptrs.filter((ptr) => ptr.a > 0);
}

/**
 * If at least two pointers are active and all active ones have the same
 * frequency, the sum is again a sine: Σ Aₖ·e^{iφₖ} = A·e^{iφ}. Returns its
 * amplitude A and phase φ in degrees (−180, 180], or null if the frequencies
 * differ or fewer than two pointers contribute (then nothing is added).
 */
export function equalFrequencySum(ptrs: readonly Pointer[]): { a: number; p: number } | null {
  const act = active(ptrs);
  if (act.length < 2) return null;
  if (act.some((ptr) => Math.abs(ptr.f - act[0].f) > 1e-9)) return null;
  let x = 0;
  let y = 0;
  for (const ptr of act) {
    x += ptr.a * Math.cos(ptr.p * DEG);
    y += ptr.a * Math.sin(ptr.p * DEG);
  }
  const a = Math.hypot(x, y);
  if (a < 1e-9) return { a: 0, p: 0 };
  let p = Math.atan2(y, x) / DEG;
  if (p <= -180 + 1e-9) p += 360;
  return { a, p };
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Largest denominator accepted for a frequency ratio; beyond it the ratio counts as irrational. */
const MAX_DENOMINATOR = 10000;

/**
 * Fraction p/q (q ≤ MAX_DENOMINATOR) equal to x ≥ 1 up to rounding noise,
 * via the convergents of its continued fraction; null if there is none.
 */
function fraction(x: number): [number, number] | null {
  let [p0, q0, p1, q1] = [0, 1, 1, 0];
  let y = x;
  for (;;) {
    const k = Math.floor(y);
    [p0, q0, p1, q1] = [p1, q1, k * p1 + p0, k * q1 + q0];
    if (!(q1 <= MAX_DENOMINATOR)) return null; // also stops on NaN
    if (Math.abs(x - p1 / q1) <= 1e-9 * x) return [p1, q1];
    y = 1 / (y - k);
  }
}

/**
 * Period of the summed oscillation, 1 / ggT(f₁, f₂, …), from the exact
 * ratios of the frequencies (so it also works for values off the slider grid,
 * e.g. 0,123 Hz and 0,246 Hz from the URL). Null if no pointer is active or
 * a ratio is irrational (then the sum is not periodic).
 */
export function commonPeriod(ptrs: readonly Pointer[]): number | null {
  const act = active(ptrs).filter((ptr) => ptr.f > 0);
  if (act.length === 0) return null;
  // fₖ = f_min · pₖ/qₖ = (f_min/L) · nₖ with L = lcm(qₖ) and integers nₖ = pₖ·L/qₖ
  const fMin = Math.min(...act.map((ptr) => ptr.f));
  const ratios: [number, number][] = [];
  let lcm = 1;
  for (const ptr of act) {
    const r = fraction(ptr.f / fMin);
    if (!r) return null;
    ratios.push(r);
    lcm = (lcm / gcd(lcm, r[1])) * r[1];
    if (lcm > MAX_DENOMINATOR) return null;
  }
  let g = 0;
  for (const [p, q] of ratios) g = gcd(g, p * (lcm / q));
  return lcm / (g * fMin);
}

/**
 * Beat period 1 / |f₁ − f₂| for exactly two active pointers with almost the
 * same frequency (|f₁ − f₂| ≤ ⅛ of the larger one, i.e. at least about 7
 * oscillations per beat); otherwise null.
 */
export function beatPeriod(ptrs: readonly Pointer[]): number | null {
  const act = active(ptrs);
  if (act.length !== 2) return null;
  const df = Math.abs(act[0].f - act[1].f);
  if (df < 1e-9 || df > 0.125 * Math.max(act[0].f, act[1].f) + 1e-9) return null;
  return 1 / df;
}
