/**
 * Small DSP toolbox for the demos: FFT, spectra, Fourier series, sinc
 * reconstruction and alias frequencies. Pure functions, no DOM access.
 */

/** Any array-like of numbers (plain arrays and typed arrays). */
export type NumArray = ArrayLike<number>;

/** True if n is a positive integer power of two (1, 2, 4, …). */
export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/** Smallest power of two ≥ n. */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** n evenly spaced values from a to b (inclusive). */
export function linspace(a: number, b: number, n: number): Float64Array {
  const out = new Float64Array(n);
  if (n === 1) {
    out[0] = a;
    return out;
  }
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + i * step;
  return out;
}

/**
 * In-place iterative radix-2 complex FFT (forward, no normalisation):
 * X[k] = Σ x[n]·e^(−2πi·kn/N).
 * `re` and `im` must have the same length N, a power of two; throws otherwise.
 */
export function fft(re: Float64Array | number[], im: Float64Array | number[]): void {
  transform(re, im, false);
}

/**
 * In-place inverse FFT, normalised by 1/N, so `ifft(fft(x)) === x`.
 * Same length rules as {@link fft}.
 */
export function ifft(re: Float64Array | number[], im: Float64Array | number[]): void {
  transform(re, im, true);
}

function transform(re: Float64Array | number[], im: Float64Array | number[], inverse: boolean): void {
  const n = re.length;
  if (im.length !== n) throw new Error(`fft: re and im differ in length (${n} vs. ${im.length})`);
  if (!isPowerOfTwo(n)) throw new Error(`fft: length must be a power of two, got ${n}`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const tRe = re[b] * curRe - im[b] * curIm;
        const tIm = re[b] * curIm + im[b] * curRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/** Hann window of length n (periodic form, suited for spectral analysis). */
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

export interface SpectrumOptions {
  /** Window applied before the FFT. Default `'none'` (rectangular). */
  window?: 'none' | 'hann';
  /**
   * `'amplitude'` (default): scaled so a sine of amplitude A that falls exactly on bin k
   * gives A at k, and a constant c gives |c| at bin 0 (with a window too: the mean is
   * removed before windowing and reported at bin 0, so it doesn't leak into bin 1).
   * `'raw'`: plain |X[k]| of the (windowed) signal.
   */
  scale?: 'amplitude' | 'raw';
}

/**
 * Magnitude spectrum of a real signal for bins 0…N/2 (length N/2 + 1).
 * Bin k corresponds to k cycles per signal length, i.e. frequency k·fs/N.
 * The signal length must be a power of two.
 */
export function magnitudeSpectrum(signal: NumArray, options: SpectrumOptions = {}): Float64Array {
  const n = signal.length;
  if (!isPowerOfTwo(n)) throw new Error(`magnitudeSpectrum: length must be a power of two, got ${n}`);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const raw = options.scale === 'raw';
  let gain = n;
  let mean = 0;
  if (options.window === 'hann') {
    if (!raw) {
      for (let i = 0; i < n; i++) mean += signal[i];
      mean /= n;
    }
    const w = hannWindow(n);
    gain = 0;
    for (let i = 0; i < n; i++) {
      re[i] = (signal[i] - mean) * w[i];
      gain += w[i];
    }
  } else {
    for (let i = 0; i < n; i++) re[i] = signal[i];
  }
  fft(re, im);
  const half = n >> 1;
  const out = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    const mag = Math.hypot(re[k], im[k]);
    if (raw) out[k] = mag;
    else out[k] = (k === 0 || k === half ? 1 : 2) * mag / gain;
  }
  if (options.window === 'hann' && !raw) out[0] = Math.abs(mean);
  return out;
}

/**
 * Fourier series coefficients in amplitude/phase form:
 *
 *   x(t) = a0 + Σ_{n=1..N} amp[n]·cos(n·ω0·t + phase[n])
 *
 * with amp[n] ≥ 0 and phase[n] ∈ [0, 2π). Arrays have length N + 1 and are
 * indexed by harmonic number n. Index 0 holds the DC term in the same form:
 * amp[0] = |a0|, phase[0] = 0 (a0 ≥ 0) or π (a0 < 0), so the n = 0 term of the
 * sum also equals a0.
 */
export interface FourierCoefficients {
  a0: number;
  amp: Float64Array;
  phase: Float64Array;
}

export interface FourierSeriesOptions {
  /**
   * Amplitudes below eps · max(1, max|x|) are set to exactly 0 with phase 0,
   * so numerically-zero harmonics don't produce noisy phase values. Default 1e-9.
   */
  eps?: number;
}

/**
 * Fourier series of one period sampled at M equally spaced points
 * (`period[m]` = x(m·T/M), m = 0…M−1). Returns harmonics 0…nHarmonics
 * (harmonics above M/2 cannot be resolved and come out as aliases).
 * Uses the FFT when M is a power of two, a direct DFT otherwise.
 */
export function fourierSeries(
  period: NumArray,
  nHarmonics: number,
  options: FourierSeriesOptions = {},
): FourierCoefficients {
  const m = period.length;
  if (m === 0) throw new Error('fourierSeries: empty period');
  const nh = Math.max(0, Math.floor(nHarmonics));
  const amp = new Float64Array(nh + 1);
  const phase = new Float64Array(nh + 1);

  let peak = 1;
  for (let i = 0; i < m; i++) peak = Math.max(peak, Math.abs(period[i]));
  const threshold = (options.eps ?? 1e-9) * peak;

  // X[n] for n = 0…nh
  const xr = new Float64Array(nh + 1);
  const xi = new Float64Array(nh + 1);
  if (isPowerOfTwo(m)) {
    const re = Float64Array.from(period as ArrayLike<number>);
    const im = new Float64Array(m);
    fft(re, im);
    for (let n = 0; n <= nh; n++) {
      xr[n] = re[n % m];
      xi[n] = im[n % m];
    }
  } else {
    for (let n = 0; n <= nh; n++) {
      let sr = 0;
      let si = 0;
      for (let k = 0; k < m; k++) {
        const ang = (-2 * Math.PI * n * k) / m;
        sr += period[k] * Math.cos(ang);
        si += period[k] * Math.sin(ang);
      }
      xr[n] = sr;
      xi[n] = si;
    }
  }

  const a0 = xr[0] / m;
  amp[0] = Math.abs(a0);
  phase[0] = a0 < 0 ? Math.PI : 0;
  if (amp[0] < threshold) {
    amp[0] = 0;
    phase[0] = 0;
  }
  for (let n = 1; n <= nh; n++) {
    const a = (2 * Math.hypot(xr[n], xi[n])) / m;
    if (a < threshold) continue;
    amp[n] = a;
    phase[n] = wrapPhase(Math.atan2(xi[n], xr[n]));
  }
  return { a0: amp[0] === 0 ? 0 : a0, amp, phase };
}

/** Wraps an angle in radians to [0, 2π). */
export function wrapPhase(phi: number): number {
  const twoPi = 2 * Math.PI;
  let r = phi % twoPi;
  if (r < 0) r += twoPi;
  return r >= twoPi ? 0 : r;
}

/**
 * Evaluates the Fourier series using harmonics 0…n at time t, where t is
 * measured in **periods** (one period = 1, i.e. ω0 = 2π):
 * a0 + Σ_{k=1..n} amp[k]·cos(2π·k·t + phase[k]). n is capped at the number of
 * available harmonics.
 */
export function fourierSynthesize(coeffs: FourierCoefficients, n: number, t: number): number {
  const nMax = Math.min(Math.floor(n), coeffs.amp.length - 1);
  let sum = coeffs.a0;
  const w = 2 * Math.PI * t;
  for (let k = 1; k <= nMax; k++) {
    const a = coeffs.amp[k];
    if (a !== 0) sum += a * Math.cos(k * w + coeffs.phase[k]);
  }
  return sum;
}

/** Normalised sinc: sin(πx)/(πx), sinc(0) = 1. */
export function sinc(x: number): number {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

/**
 * Ideal (Whittaker–Shannon) reconstruction at time t from samples
 * (sampleTimes[i], sampleValues[i]) taken at rate fs:
 * x(t) = Σ x_i · sinc(fs·(t − t_i)).
 * Works for arbitrary sample times; O(number of samples) per call.
 * For uniformly spaced samples prefer {@link sincReconstructUniform} (faster).
 */
export function sincReconstruct(sampleTimes: NumArray, sampleValues: NumArray, fs: number, t: number): number {
  let sum = 0;
  for (let i = 0; i < sampleValues.length; i++) sum += sampleValues[i] * sinc(fs * (t - sampleTimes[i]));
  return sum;
}

/**
 * Same as {@link sincReconstruct} for uniformly spaced samples at times
 * t0 + i/fs, but with only one sin() per call (uses
 * sin(π(v − i)) = (−1)^i·sin(πv)), so it is cheap enough to evaluate per pixel
 * column with thousands of samples.
 */
export function sincReconstructUniform(t0: number, sampleValues: NumArray, fs: number, t: number): number {
  const v = fs * (t - t0);
  const nearest = Math.round(v);
  if (Math.abs(v - nearest) < 1e-12) {
    return nearest >= 0 && nearest < sampleValues.length ? sampleValues[nearest] : 0;
  }
  let sum = 0;
  for (let i = 0; i < sampleValues.length; i++) {
    const term = sampleValues[i] / (v - i);
    sum += i & 1 ? -term : term;
  }
  return (Math.sin(Math.PI * v) / Math.PI) * sum;
}

/**
 * The frequency at which a sine of frequency f appears after sampling at fs,
 * folded into [0, fs/2]. Example: aliasFrequency(5000, 8000) === 3000.
 */
export function aliasFrequency(f: number, fs: number): number {
  if (!(fs > 0)) throw new Error('aliasFrequency: fs must be > 0');
  const r = Math.abs(f) % fs;
  return r > fs / 2 ? fs - r : r;
}
