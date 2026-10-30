import { describe, expect, it } from 'vitest';
import { aliasFrequency } from '../../src/lib/dsp';
import { abProgram, aliasProgram, aliasSine, frequencyAt, programDuration, sweepProgram } from './model';

const sampled = (f: number, fs: number, n: number): number => Math.sin((2 * Math.PI * f * n) / fs);

describe('audio-aliasing model', () => {
  it('the alias sine passes through the samples', () => {
    for (const fs of [8000, 11025, 16000]) {
      for (const f of [0, 1000, 3000, fs / 2 - 10, fs / 2, fs / 2 + 10, 5000, 7000, fs - 10, fs, fs + 1000]) {
        const a = aliasSine(f, fs);
        expect(a.f).toBe(aliasFrequency(f, fs));
        for (let n = 0; n < 50; n++) {
          expect(a.sign * Math.sin((2 * Math.PI * a.f * n) / fs)).toBeCloseTo(sampled(f, fs, n), 9);
        }
      }
    }
  });

  it('slide example: 5000 Hz at 8 kHz sounds like 3000 Hz (inverted)', () => {
    expect(aliasSine(5000, 8000)).toEqual({ f: 3000, sign: -1 });
    expect(aliasSine(3000, 8000)).toEqual({ f: 3000, sign: 1 });
    expect(aliasSine(4000, 8000)).toEqual({ f: 4000, sign: 0 });
  });

  it('frequencyAt follows jumps and ramps', () => {
    const ab = abProgram(8000);
    expect(ab.map((p) => p.f)).toEqual([3000, 5000, 3000, 3000]);
    expect(programDuration(ab)).toBe(3);
    expect(frequencyAt(ab, -1)).toBe(3000);
    expect(frequencyAt(ab, 0.99)).toBe(3000);
    expect(frequencyAt(ab, 1)).toBe(5000);
    expect(frequencyAt(ab, 2.5)).toBe(3000);

    const sweep = sweepProgram(8000, true);
    expect(programDuration(sweep)).toBe(20);
    expect(frequencyAt(sweep, 5)).toBe(4000);
    expect(frequencyAt(sweep, 10)).toBe(8000);
    expect(frequencyAt(sweep, 17.5)).toBe(2000);
    expect(frequencyAt(sweep, 99)).toBe(0);
  });

  it('aliasProgram is the alias of the program at every time', () => {
    for (const fs of [8000, 11025]) {
      for (const prog of [sweepProgram(fs, false), sweepProgram(fs, true), abProgram(fs), [
        { t: 0, f: 500 },
        { t: 3, f: 2.6 * fs, ramp: true },
        { t: 4, f: 100, ramp: true },
      ]]) {
        const al = aliasProgram(prog, fs);
        expect(al.every((p) => p.f >= 0 && p.f <= fs / 2)).toBe(true);
        const end = programDuration(prog);
        for (let i = 0; i <= 400; i++) {
          const t = (end * i) / 400;
          // jumps happen exactly at a point's time; compare just after it
          const tt = t + 1e-9;
          expect(frequencyAt(al, tt)).toBeCloseTo(aliasFrequency(frequencyAt(prog, tt), fs), 3);
        }
      }
    }
  });

  it('a sweep up folds once at f_s/2', () => {
    expect(aliasProgram(sweepProgram(8000, false), 8000)).toEqual([
      { t: 0, f: 0 },
      { t: 5, f: 4000, ramp: true },
      { t: 10, f: 0, ramp: true },
    ]);
  });
});
