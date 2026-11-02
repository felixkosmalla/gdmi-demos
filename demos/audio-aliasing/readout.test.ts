import { describe, expect, it } from 'vitest';
import { hz, readout } from './readout';

describe('audio-aliasing readout', () => {
  it('formats frequencies in whole Hz or to 0.1 Hz', () => {
    expect(hz(3000)).toBe('3000 Hz');
    expect(hz(5512.5)).toBe('5512,5 Hz');
    expect(hz(2999.3999999999996)).toBe('2999,4 Hz');
    expect(hz(4000.00000001)).toBe('4000 Hz');
  });

  it('the readout cases', () => {
    expect(readout(1000, 8000)).toMatchObject({ f: 'f = 1000 Hz', alias: '→ hörbar: 1000 Hz', status: 'ok' });
    expect(readout(5000, 8000)).toMatchObject({ alias: '→ hörbar: 3000 Hz', status: 'bad' });
    expect(readout(5000, 8000).text).toContain('8000 − 5000 = 3000 Hz');
    expect(readout(8000, 8000).text).toContain('kein Ton');
    const edge = readout(4000, 8000);
    expect(edge).toMatchObject({ alias: '→ hörbar: 4000 Hz', status: 'warn' });
    expect(edge.text).toContain('Phase');
    expect(readout(5512.5, 11025).status).toBe('warn');
    expect(readout(6012.5, 11025).text).toContain('11025 − 6012,5 = 5012,5 Hz');
  });

  it('all terms use the same rounding (off-step f from the URL)', () => {
    expect(readout(5000.5, 8000).text).toContain('8000 − 5000,5 = 2999,5 Hz');
    expect(readout(5000.5, 8000).f).toBe('f = 5000,5 Hz');
    const r = readout(5000.55, 8000);
    expect(r.f).toBe('f = 5000,6 Hz');
    expect(r.alias).toBe('→ hörbar: 2999,4 Hz');
    expect(r.text).toContain('8000 − 5000,6 = 2999,4 Hz');
    expect(readout(3999.96, 8000).status).toBe('warn'); // shown as 4000 Hz, so it is the edge case
  });
});
