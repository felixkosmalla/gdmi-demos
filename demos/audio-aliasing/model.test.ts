import { describe, expect, it } from 'vitest';
import { aliasFrequency } from '../../src/lib/dsp';
import {
  AB_FREQUENCY,
  SAMPLE_RATES,
  abProgram,
  aliasProgram,
  aliasSine,
  frequencyAt,
  programDisplayFrequency,
  programDuration,
  sweepProgram,
} from './model';

const sampled = (f: number, fs: number, n: number, phase = 0): number => Math.sin((2 * Math.PI * f * n) / fs + phase);

describe('audio-aliasing model', () => {
  it('the alias sine passes through the samples', () => {
    for (const fs of SAMPLE_RATES.map((r) => r.fs)) {
      for (const f of [0, 1000, 3000, fs / 2 - 10, fs / 2, fs / 2 + 10, 5000, 7000, fs - 10, fs, fs + 1000, 1.5 * fs]) {
        for (const phase of [0, 0.7, Math.PI / 2, 2, -1]) {
          const a = aliasSine(f, fs, phase);
          expect(a.f).toBe(aliasFrequency(f, fs));
          for (let n = 0; n < 50; n++) {
            expect(a.amplitude * Math.sin((2 * Math.PI * a.f * n) / fs + a.phase)).toBeCloseTo(sampled(f, fs, n, phase), 9);
          }
        }
      }
    }
  });

  it('slide example: 5000 Hz at 8 kHz sounds like 3000 Hz (inverted sine)', () => {
    expect(aliasSine(3000, 8000)).toEqual({ f: 3000, amplitude: 1, phase: 0 });
    expect(aliasSine(5000, 8000)).toEqual({ f: 3000, amplitude: 1, phase: Math.PI });
  });

  it('at f_s/2 the volume depends on the phase', () => {
    expect(aliasSine(4000, 8000).amplitude).toBe(0);
    expect(aliasSine(4000, 8000, Math.PI / 2)).toEqual({ f: 4000, amplitude: 1, phase: Math.PI / 2 });
    for (const phase of [0.3, 1, 2.5, 4, -0.5]) {
      expect(aliasSine(5512.5, 11025, phase).amplitude).toBeCloseTo(Math.abs(Math.sin(phase)), 12);
    }
  });

  it('a cosine (phase π/2) changes continuously across f_s/2', () => {
    for (const fs of [8000, 11025]) {
      const at = aliasSine(fs / 2, fs, Math.PI / 2);
      for (const f of [fs / 2 - 1e-6, fs / 2 + 1e-6]) {
        const a = aliasSine(f, fs, Math.PI / 2);
        expect(a.f).toBeCloseTo(at.f, 4);
        expect(a.amplitude).toBe(at.amplitude);
        expect(a.phase).toBeCloseTo(at.phase, 12);
      }
    }
  });

  it('the f slider reaches f_s/2, f_s and the A/B frequencies at every sample rate', () => {
    for (const { fs, step } of SAMPLE_RATES) {
      for (const f of [fs / 2, fs, AB_FREQUENCY, fs - AB_FREQUENCY, 1000]) {
        expect(Number.isInteger(f / step)).toBe(true);
      }
    }
  });

  it('a running program never shows exactly f_s/2', () => {
    expect(programDisplayFrequency(3999.6, 8000)).toBe(3999);
    expect(programDisplayFrequency(4000, 8000)).toBe(4001);
    expect(programDisplayFrequency(4000.4, 8000)).toBe(4001);
    expect(programDisplayFrequency(4001.2, 8000)).toBe(4001);
    expect(programDisplayFrequency(1234.4, 8000)).toBe(1234);
    expect(programDisplayFrequency(8000, 8000)).toBe(8000);
    expect(programDisplayFrequency(5512.4, 11025)).toBe(5512);
    for (const fs of [8000, 16000]) {
      for (let t = 0; t <= 20; t += 1 / 60) {
        const f = programDisplayFrequency(frequencyAt(sweepProgram(fs, true), t), fs);
        expect(f).not.toBe(fs / 2);
      }
    }
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
