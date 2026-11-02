import { describe, expect, it } from 'vitest';
import type { FreqPoint } from './model';
import { createPlayback } from './playback';
import type { Voice } from './voice';

interface FakeVoice {
  voice: Voice;
  ctx: { currentTime: number; state: string; outputLatency: number };
  /** Calls in order: "start", "stop", "f 3000", "program 3000,5000,3000,3000 @0.05". */
  log: string[];
}

function fakeVoice(fs: number): FakeVoice {
  const ctx = { currentTime: 0, state: 'running', outputLatency: 0, addEventListener() {} };
  const log: string[] = [];
  const voice = {
    ctx,
    fs,
    mode: 'worklet',
    setFrequency: (f: number) => log.push(`f ${f}`),
    runProgram: (p: readonly FreqPoint[], t0: number) => log.push(`program ${p.map((x) => x.f).join(',')} @${t0}`),
    start: () => log.push('start'),
    stop: () => log.push('stop'),
    setVolume: () => {},
  };
  return { voice: voice as unknown as Voice, ctx, log };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** The controller with fake voices whose creation (as on first use) waits for `ready(fs)`. */
function setup() {
  const settings = { f: 1000, fs: 8000, vol: 0.2, updown: false };
  const voices = new Map<number, FakeVoice>();
  const pending = new Map<number, { promise: Promise<Voice>; resolve: () => void; reject: (e: Error) => void }>();
  const frames = new Map<number, () => void>();
  let nextFrame = 1;
  let wall = 100;
  const pb = createPlayback({
    getVoice(fs) {
      let d = pending.get(fs);
      if (!d) {
        const fv = fakeVoice(fs);
        voices.set(fs, fv);
        let resolve!: () => void;
        let reject!: (e: Error) => void;
        const promise = new Promise<Voice>((res, rej) => {
          resolve = () => res(fv.voice);
          reject = rej;
        });
        d = { promise, resolve, reject };
        pending.set(fs, d);
      }
      return d.promise;
    },
    settings: () => settings,
    showFrequency: (f) => (settings.f = f),
    onChange: () => {},
    now: () => wall,
    requestFrame(cb) {
      frames.set(nextFrame, cb);
      return nextFrame++;
    },
    cancelFrame: (id) => frames.delete(id),
  });
  return {
    pb,
    settings,
    voice: (fs = 8000) => voices.get(fs)!,
    async ready(fs = 8000) {
      pending.get(fs)!.resolve();
      await flush();
    },
    async fail(fs = 8000) {
      pending.get(fs)!.reject(new Error('kaputt'));
      await flush();
    },
    /** Runs the animation frames once. */
    frame() {
      const cbs = [...frames.values()];
      frames.clear();
      for (const cb of cbs) cb();
    },
    get frames() {
      return frames.size;
    },
    setWall(t: number) {
      wall = t;
    },
  };
}

describe('audio-aliasing playback', () => {
  it('Play starts the sound once the voice is ready', async () => {
    const s = setup();
    void s.pb.start();
    expect(s.pb.playing).toBe(true);
    expect(s.pb.voice).toBe(null);
    await s.ready();
    expect(s.voice().log).toEqual(['f 1000', 'start']);
    expect(s.pb.voice).toBe(s.voice().voice);
  });

  it('a double click on Sweep while the sound is starting starts and stops it (nothing keeps running)', async () => {
    const s = setup();
    void s.pb.toggleProgram('sweep');
    expect(s.pb.program).toBe('sweep');
    void s.pb.toggleProgram('sweep');
    await s.ready();
    expect(s.pb.program).toBe(null);
    expect(s.pb.playing).toBe(false);
    expect(s.voice().log).not.toContain('start');
    expect(s.frames).toBe(0);
  });

  it('Play, then Sweep while starting: the sweep runs with sound and the sound stays on', async () => {
    const s = setup();
    void s.pb.start();
    void s.pb.toggleProgram('sweep');
    await s.ready();
    const v = s.voice();
    expect(v.log).toEqual(['f 0', 'start', 'program 0,8000 @0.05']);
    expect(s.pb.program).toBe('sweep');
    v.ctx.currentTime = 20;
    s.frame();
    expect(s.pb.program).toBe(null);
    expect(s.settings.f).toBe(8000);
    expect(s.pb.playing).toBe(true);
  });

  it('Sweep, then A/B while starting: only A/B runs, and it stops the sound at its end', async () => {
    const s = setup();
    void s.pb.toggleProgram('sweep');
    void s.pb.toggleProgram('ab');
    await s.ready();
    const v = s.voice();
    expect(v.log.filter((l) => l.startsWith('program'))).toEqual(['program 3000,5000,3000,3000 @0.05']);
    expect(s.frames).toBe(1);
    v.ctx.currentTime = 4;
    s.frame();
    expect(s.pb.program).toBe(null);
    expect(s.pb.playing).toBe(false);
    expect(v.log.at(-1)).toBe('stop');
  });

  it('Stop while starting: the sound does not start', async () => {
    const s = setup();
    void s.pb.start();
    s.pb.stop();
    await s.ready();
    expect(s.pb.playing).toBe(false);
    expect(s.voice().log).toEqual([]);
  });

  it('changing f_s during a program that started the sound stops it like the program end', async () => {
    const s = setup();
    void s.pb.toggleProgram('ab');
    await s.ready();
    s.settings.fs = 16000;
    s.pb.sampleRateChanged();
    expect(s.pb.program).toBe(null);
    expect(s.pb.playing).toBe(false);
    expect(s.pb.voice).toBe(null);
    expect(s.voice(8000).log.at(-1)).toBe('stop');
  });

  it('changing f_s while playing restarts the sound at the new rate', async () => {
    const s = setup();
    void s.pb.start();
    void s.pb.toggleProgram('sweep'); // the sound was on before: it keeps playing
    await s.ready();
    s.settings.fs = 16000;
    s.pb.sampleRateChanged();
    expect(s.pb.program).toBe(null);
    expect(s.pb.playing).toBe(true);
    await s.ready(16000);
    expect(s.pb.voice).toBe(s.voice(16000).voice);
    expect(s.voice(16000).log).toContain('start');
  });

  it('changing f_s while the first start is pending drops it', async () => {
    const s = setup();
    void s.pb.start();
    s.settings.fs = 16000;
    s.pb.sampleRateChanged();
    await s.ready(8000);
    expect(s.voice(8000).log).toEqual([]);
    await s.ready(16000);
    expect(s.voice(16000).log).toContain('start');
  });

  it('the UI follows the program as heard (output latency)', async () => {
    const s = setup();
    void s.pb.toggleProgram('ab');
    await s.ready();
    const v = s.voice();
    v.ctx.outputLatency = 0.1;
    v.ctx.currentTime = 0.05 + 1.05; // B starts at 1 s, but is heard only 0.1 s later
    s.frame();
    expect(s.settings.f).toBe(3000);
    v.ctx.currentTime = 0.05 + 1.15;
    s.frame();
    expect(s.settings.f).toBe(5000);
  });

  it('without sound (error) a program still runs visually', async () => {
    const s = setup();
    void s.pb.toggleProgram('ab');
    await s.fail();
    expect(s.pb.error).toBe('kaputt');
    expect(s.pb.playing).toBe(false);
    expect(s.pb.program).toBe('ab');
    s.setWall(101.5);
    s.frame();
    expect(s.settings.f).toBe(5000);
    s.setWall(104);
    s.frame();
    expect(s.pb.program).toBe(null);
  });

  it('moving the slider cancels a program and keeps the sound', async () => {
    const s = setup();
    void s.pb.toggleProgram('sweep');
    await s.ready();
    s.pb.setFrequency(2000);
    expect(s.pb.program).toBe(null);
    expect(s.pb.playing).toBe(true);
    expect(s.voice().log.at(-1)).toBe('f 2000');
  });
});
