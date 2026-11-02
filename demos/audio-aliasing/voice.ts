// Sound for `audio-aliasing`: a sine sampled at f_s.
//
// Preferred ('worklet'): an AudioContext running at f_s plus an AudioWorklet
// that computes the samples (aliasing-worklet.ts). The browser's output
// resampler then acts as the reconstruction low-pass at f_s/2.
//
// Fallback ('fallback', if the browser rejects the f_s context or has no
// AudioWorklet): a normal context and an OscillatorNode at the alias frequency,
// i.e. the ideal reconstruction computed directly. (Playing an f_s AudioBuffer
// instead would not work: Chrome and Safari resample buffers with linear
// interpolation, which lets the original frequency leak through at about −9 dB.)
//
// Chain: source → high-pass 20 Hz (removes the DC a 0-Hz alias leaves) → voice
// gain (start/stop fades) → master gain (volume) → destination.
import { getAudioContext, masterGain, rampTo, setVolume } from '../../src/lib/audio';
import { aliasFrequency } from '../../src/lib/dsp';
import workletUrl from './aliasing-worklet.ts?worker&url';
import { aliasProgram, aliasSine, type FreqPoint } from './model';

export interface Voice {
  readonly ctx: AudioContext;
  readonly fs: number;
  readonly mode: 'worklet' | 'fallback';
  /** Sets the input frequency immediately; cancels a running program. */
  setFrequency(f: number): void;
  /** Schedules a frequency program starting at context time `t0`. */
  runProgram(p: readonly FreqPoint[], t0: number): void;
  /** Fades in. */
  start(): void;
  /** Fades out (the source keeps running silently, so start() can follow at any time). */
  stop(): void;
  setVolume(volume: number): void;
}

const voices = new Map<number, Promise<Voice>>();
const worklets = new WeakMap<BaseAudioContext, Promise<void>>();

/**
 * The voice for sample rate `fs`, created on first use. Call it first thing in
 * a click/tap handler: creating and resuming the context needs a user gesture.
 */
export function getVoice(fs: number): Promise<Voice> {
  let v = voices.get(fs);
  if (!v) {
    v = createVoice(fs);
    voices.set(fs, v);
    v.catch(() => voices.delete(fs));
  }
  return v;
}

async function createVoice(fs: number): Promise<Voice> {
  try {
    return await workletVoice(fs);
  } catch (err) {
    console.warn(`audio-aliasing: no ${fs}-Hz AudioContext with AudioWorklet, using the fallback`, err);
    return fallbackVoice(fs, await getAudioContext());
  }
}

async function workletVoice(fs: number): Promise<Voice> {
  const ctx = await getAudioContext(fs);
  // some browsers might ignore the requested rate instead of throwing
  if (ctx.sampleRate !== fs) {
    void ctx.close();
    throw new Error(`AudioContext runs at ${ctx.sampleRate} Hz instead of ${fs} Hz`);
  }
  if (!ctx.audioWorklet) throw new Error('AudioWorklet not available');
  let ready = worklets.get(ctx);
  if (!ready) {
    ready = ctx.audioWorklet.addModule(workletUrl);
    worklets.set(ctx, ready);
  }
  await ready;
  const node = new AudioWorkletNode(ctx, 'sampled-sine', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const freq = node.parameters.get('frequency');
  if (!freq) throw new Error('AudioWorkletNode has no frequency parameter');
  return voice(ctx, fs, 'worklet', node, freq, (f) => f, (p) => p);
}

function fallbackVoice(fs: number, ctx: AudioContext): Voice {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // At exactly f_s/2 the samples are (−1)ⁿ · sin φ, so the volume is |sin φ|. The
  // phase φ at that moment is arbitrary (in the worklet too): pick it at random.
  const edge = ctx.createGain();
  osc.connect(edge);
  osc.start();
  const v = voice(ctx, fs, 'fallback', edge, osc.frequency, (f) => aliasFrequency(f, fs), (p) => aliasProgram(p, fs));
  let last = NaN;
  return {
    ...v,
    setFrequency(f) {
      v.setFrequency(f);
      if (f !== last) rampTo(edge.gain, aliasSine(f, fs, 2 * Math.PI * Math.random()).amplitude, ctx);
      last = f;
    },
    runProgram(p, t0) {
      v.runProgram(p, t0);
      last = NaN;
      rampTo(edge.gain, 1, ctx);
    },
  };
}

function voice(
  ctx: AudioContext,
  fs: number,
  mode: Voice['mode'],
  source: AudioNode,
  freq: AudioParam,
  map: (f: number) => number,
  mapProgram: (p: readonly FreqPoint[]) => readonly FreqPoint[],
): Voice {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 20;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(hp).connect(gain).connect(masterGain(ctx));

  return {
    ctx,
    fs,
    mode,
    setFrequency(f) {
      const now = ctx.currentTime;
      freq.cancelScheduledValues(now);
      freq.setValueAtTime(map(f), now);
    },
    runProgram(p, t0) {
      freq.cancelScheduledValues(ctx.currentTime);
      for (const [i, pt] of mapProgram(p).entries()) {
        if (i > 0 && pt.ramp) freq.linearRampToValueAtTime(pt.f, t0 + pt.t);
        else freq.setValueAtTime(pt.f, t0 + pt.t);
      }
    },
    start: () => rampTo(gain.gain, 1, ctx),
    stop: () => rampTo(gain.gain, 0, ctx),
    setVolume: (v) => setVolume(ctx, v),
  };
}
