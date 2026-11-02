/**
 * Sound state of `audio-aliasing` (no DOM, tested in playback.test.ts):
 * Play/Stop and the frequency programs (sweep, A/B). The audio runs a program
 * as AudioParam automation; the UI mirrors f from the same clock on every
 * animation frame.
 *
 * Starting the sound is asynchronous on first use (context, worklet module).
 * Clicks during that time share one pending start, and a program is set up
 * at once, so the buttons always describe the current state.
 */
import { abProgram, frequencyAt, programDuration, sweepProgram, type FreqPoint } from './model';
import type { Voice } from './voice';

export type ProgramKind = 'sweep' | 'ab';

export interface PlaybackOptions {
  getVoice(fs: number): Promise<Voice>;
  settings(): { readonly f: number; readonly fs: number; readonly vol: number; readonly updown: boolean };
  /** Shows a program's frequency (not a user change, so it must not call setFrequency). */
  showFrequency(f: number): void;
  /** Called after every change of the state below. */
  onChange(): void;
  /** Clock in s for programs without sound. */
  now(): number;
  requestFrame(cb: () => void): number;
  cancelFrame(id: number): void;
}

export interface Playback {
  /** Sound on (or starting). */
  readonly playing: boolean;
  /** The voice for the current f_s, once started. */
  readonly voice: Voice | null;
  readonly error: string | null;
  readonly program: ProgramKind | null;
  start(): Promise<Voice | null>;
  stop(): void;
  /** Starts a program, or ends it if it is running (the button doubles as "stop"). */
  toggleProgram(kind: ProgramKind): Promise<void>;
  /** A user change of f: cancels a program, the sound stays as it is. */
  setFrequency(f: number): void;
  /** Call after f_s changed: restarts the sound on the new context if it should keep playing. */
  sampleRateChanged(): void;
  setVolume(v: number): void;
}

interface Program {
  kind: ProgramKind;
  points: FreqPoint[];
  /** Was the sound on before the program started? If not, it stops at the end. */
  wasPlaying: boolean;
  clock: () => number;
  t0: number;
  frame: number;
}

/** Lead time for scheduling a program on the audio clock, in s. */
const LEAD = 0.05;

/** Time from the audio clock to the speaker, in s (the UI shows what is heard). */
export function outputLatency(ctx: BaseAudioContext): number {
  const c = ctx as BaseAudioContext & { outputLatency?: number; baseLatency?: number };
  return c.outputLatency || c.baseLatency || 0;
}

export function createPlayback(o: PlaybackOptions): Playback {
  let playing = false;
  let voice: Voice | null = null;
  let error: string | null = null;
  let starting: Promise<Voice | null> | null = null;
  /** Increased by stop and f_s changes: a pending start with an older token is dropped. */
  let token = 0;
  let program: Program | null = null;
  const watched = new WeakSet<BaseAudioContext>();

  function start(): Promise<Voice | null> {
    starting ??= startVoice(++token);
    return starting;
  }

  async function startVoice(t: number): Promise<Voice | null> {
    playing = true;
    error = null;
    // iOS: play even when the ring/silent switch is set to silent (Safari 16.4+)
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    o.onChange();
    try {
      const v = await o.getVoice(o.settings().fs);
      if (t !== token) return null;
      voice = v;
      if (!watched.has(v.ctx)) {
        watched.add(v.ctx);
        v.ctx.addEventListener('statechange', () => o.onChange());
      }
      const { f, vol } = o.settings();
      v.setVolume(vol);
      v.setFrequency(f);
      v.start();
      return v;
    } catch (err) {
      if (t !== token) return null;
      playing = false;
      error = err instanceof Error ? err.message : String(err);
      return null;
    } finally {
      if (t === token) {
        starting = null;
        o.onChange();
      }
    }
  }

  function stop(): void {
    token++;
    starting = null;
    playing = false;
    cancelProgram();
    voice?.stop();
    o.onChange();
  }

  async function toggleProgram(kind: ProgramKind): Promise<void> {
    if (program?.kind === kind) {
      endProgram();
      return;
    }
    const wasPlaying = program ? program.wasPlaying : playing;
    cancelProgram();
    const { fs, updown } = o.settings();
    const points = kind === 'sweep' ? sweepProgram(fs, updown) : abProgram(fs);
    const p: Program = { kind, points, wasPlaying, clock: o.now, t0: 0, frame: 0 };
    program = p;
    o.showFrequency(points[0].f);
    voice?.setFrequency(points[0].f);
    o.onChange();
    const v = playing && !starting ? voice : await start();
    if (program !== p) return; // stopped, replaced or f_s changed while the sound was starting
    if (v) {
      p.clock = () => v.ctx.currentTime - outputLatency(v.ctx);
      p.t0 = v.ctx.currentTime + LEAD;
      v.runProgram(points, p.t0);
    } else {
      p.t0 = o.now(); // no sound (error): the program still runs visually
    }
    p.frame = o.requestFrame(tick);
  }

  function tick(): void {
    const p = program;
    if (!p) return;
    const t = p.clock() - p.t0;
    o.showFrequency(frequencyAt(p.points, t));
    if (t >= programDuration(p.points)) endProgram();
    else p.frame = o.requestFrame(tick);
  }

  /** Stops following the program (the audio automation is replaced by the next setFrequency). */
  function cancelProgram(): void {
    if (!program) return;
    o.cancelFrame(program.frame);
    program = null;
    o.onChange();
  }

  /** Ends the program where it is; the sound stops if the program started it. */
  function endProgram(): void {
    const p = program;
    if (!p) return;
    cancelProgram();
    voice?.setFrequency(o.settings().f);
    if (!p.wasPlaying) stop();
  }

  return {
    get playing() {
      return playing;
    },
    get voice() {
      return voice;
    },
    get error() {
      return error;
    },
    get program() {
      return program?.kind ?? null;
    },
    start,
    stop,
    toggleProgram,
    setFrequency(f) {
      cancelProgram();
      voice?.setFrequency(f);
    },
    sampleRateChanged() {
      // a program that started the sound ends as usual: the sound stops
      const keep = playing && (!program || program.wasPlaying);
      cancelProgram();
      voice?.stop();
      voice = null;
      if (keep) {
        token++;
        starting = null;
        void start();
      } else if (playing) {
        stop();
      } else {
        o.onChange();
      }
    },
    setVolume(v) {
      voice?.setVolume(v);
    },
  };
}
