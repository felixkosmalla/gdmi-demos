/**
 * Texts of the big readout in `audio-aliasing` (no DOM). Tested in readout.test.ts.
 */
import { formatNumber } from '../../src/lib/controls';
import { aliasFrequency } from '../../src/lib/dsp';

/** Rounds to the precision the UI shows (0.1 Hz). */
const shown = (f: number): number => Math.round(f * 10) / 10;

/** "3000", "5512,5": whole numbers, or one decimal if needed. */
function num(v: number): string {
  const s = shown(v);
  return formatNumber(s, Number.isInteger(s) ? 0 : 1);
}

export const hz = (f: number): string => `${num(f)} Hz`;

export interface Readout {
  /** Alias frequency of f as shown (for labels elsewhere). */
  aliasF: number;
  f: string;
  alias: string;
  text: string;
  status: 'ok' | 'warn' | 'bad';
}

export function readout(fIn: number, fs: number): Readout {
  // every term from the same rounded f, so "f_s − f = alias" adds up as shown
  const f = shown(fIn);
  const half = fs / 2;
  const a = aliasFrequency(f, fs);
  const r = { aliasF: a, f: `f = ${hz(f)}`, alias: `→ hörbar: ${hz(a)}` };
  if (f < half) {
    return { ...r, status: 'ok', text: `f liegt unter fₛ/2 = ${hz(half)} und wird korrekt wiedergegeben.` };
  }
  if (f === half) {
    return {
      ...r,
      status: 'warn',
      text: 'Grenzfall f = fₛ/2: Die Abtastwerte wechseln nur das Vorzeichen. Wie laut der Ton ist, hängt von der Phase ab – bis hin zu Stille.',
    };
  }
  if (f < fs) {
    return {
      ...r,
      status: 'bad',
      text: `Aliasing: f liegt über fₛ/2 und wird gespiegelt, fₛ − f = ${num(fs)} − ${num(f)} = ${hz(a)}.`,
    };
  }
  return { ...r, status: 'bad', text: 'Aliasing: Bei f = fₛ sind alle Abtastwerte gleich – kein Ton (0 Hz).' };
}
