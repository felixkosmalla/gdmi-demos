// Synthetic test images for "Frequenzraum bei Bilddaten", generated directly
// as luminance (0…255) at the working size N × N. Chosen so the teaching facts
// hold exactly at N = 512: every pattern repeats a whole number of times per
// image width, so its spectral lines fall exactly on FFT bins.

/** Working size in pixels (width = height). Power of two for the FFT. */
export const N = 512;

export const PATTERNS = ['streifen-grob', 'streifen-fein', 'schachbrett', 'verlauf', 'kante'] as const;
export type PatternId = (typeof PATTERNS)[number];

/** Stripe periods per image width (= the spectral peak index of a row). */
export const STRIPES_COARSE = 8;
export const STRIPES_FINE = 32;
/** Squares per row of the checkerboard (64 px each at N = 512). */
export const CHECKER_SQUARES = 8;

/** Dark and bright grey value of all patterns. */
export const LO = 30;
export const HI = 225;

/**
 * Luminance of a synthetic pattern, row by row (index y · n + x).
 * - Streifen: vertical sine stripes, brightness varies along x only.
 * - Schachbrett: CHECKER_SQUARES × CHECKER_SQUARES squares.
 * - Verlauf: radial gradient, bright in the centre and falling off linearly
 *   with the distance, so every row/column is smooth and starts and ends at the
 *   same value (no jump when the FFT repeats the line).
 * - Kante: dark left half, bright right half (one vertical edge).
 */
export function patternLuminance(id: PatternId, n = N): Float64Array {
  const out = new Float64Array(n * n);
  const mid = (LO + HI) / 2;
  const amp = (HI - LO) / 2;
  const square = n / CHECKER_SQUARES;
  const radius = n / Math.SQRT2; // centre → corner
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v: number;
      switch (id) {
        case 'streifen-grob':
          v = mid + amp * Math.cos((2 * Math.PI * STRIPES_COARSE * x) / n);
          break;
        case 'streifen-fein':
          v = mid + amp * Math.cos((2 * Math.PI * STRIPES_FINE * x) / n);
          break;
        case 'schachbrett':
          v = (Math.floor(x / square) + Math.floor(y / square)) % 2 ? HI : LO;
          break;
        case 'verlauf': {
          const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2);
          v = HI - (HI - LO) * Math.min(1, r / radius);
          break;
        }
        case 'kante':
          v = x < n / 2 ? LO : HI;
          break;
      }
      out[y * n + x] = v;
    }
  }
  return out;
}

/** Grey RGBA pixels (for an ImageData) from a luminance array. */
export function greyRGBA(lum: ArrayLike<number>): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(lum.length * 4);
  for (let i = 0; i < lum.length; i++) {
    const v = Math.round(lum[i]);
    rgba[4 * i] = v;
    rgba[4 * i + 1] = v;
    rgba[4 * i + 2] = v;
    rgba[4 * i + 3] = 255;
  }
  return rgba;
}
