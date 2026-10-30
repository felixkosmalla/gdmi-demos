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
 * If all active pointers have the same frequency, the sum is again a sine:
 * Σ Aₖ·e^{iφₖ} = A·e^{iφ}. Returns its amplitude A and phase φ in degrees
 * (−180, 180], or null if the frequencies differ.
 */
export function equalFrequencySum(ptrs: readonly Pointer[]): { a: number; p: number } | null {
  const act = active(ptrs);
  if (act.length === 0) return { a: 0, p: 0 };
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

/**
 * Period of the summed oscillation, 1 / ggT(f₁, f₂, …), with frequencies on
 * a 0.01 Hz grid. Null if no pointer is active or a frequency is off the grid
 * (then the ratio is treated as irrational: not periodic).
 */
export function commonPeriod(ptrs: readonly Pointer[]): number | null {
  const act = active(ptrs).filter((ptr) => ptr.f > 0);
  if (act.length === 0) return null;
  let g = 0;
  for (const ptr of act) {
    const k = Math.round(ptr.f * 100);
    if (Math.abs(ptr.f * 100 - k) > 1e-6) return null;
    g = gcd(g, k);
  }
  return 100 / g;
}

/**
 * Beat period 1 / |f₁ − f₂| for exactly two active pointers with close
 * frequencies (|f₁ − f₂| ≤ ¼ of the larger one); otherwise null.
 */
export function beatPeriod(ptrs: readonly Pointer[]): number | null {
  const act = active(ptrs);
  if (act.length !== 2) return null;
  const df = Math.abs(act[0].f - act[1].f);
  if (df < 1e-9 || df > 0.25 * Math.max(act[0].f, act[1].f)) return null;
  return 1 / df;
}
