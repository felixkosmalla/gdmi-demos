/**
 * Small Web Audio helpers. Generic on purpose: demos build their own
 * oscillators/worklets on top. Browsers only allow audio after a user
 * gesture, so call `getAudioContext()` from a click/tap handler.
 *
 *   playBtn.onclick = async () => {
 *     const ctx = await getAudioContext();
 *     setVolume(ctx, 0.2);
 *     handle = playBuffer(ctx, samples, 8000, { loop: true });
 *   };
 *   stopBtn.onclick = () => handle?.stop();
 */

/** Default fade time for gain ramps (avoids clicks). */
export const FADE_SECONDS = 0.02;

const contexts = new Map<string, AudioContext>();
const masters = new WeakMap<BaseAudioContext, GainNode>();

/** True if the browser supports the Web Audio API. */
export function audioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
}

/**
 * Returns a shared AudioContext (one per requested sample rate), creating it on
 * first use, and resumes it if suspended. Call from a user gesture handler:
 * `resume()` is invoked synchronously, before the returned promise settles.
 *
 * Throws if Web Audio is missing or the browser rejects the sample rate
 * (catch that to fall back to the default rate, e.g. with an 8 kHz AudioBuffer).
 */
export async function getAudioContext(sampleRate?: number): Promise<AudioContext> {
  if (!audioSupported()) throw new Error('Web Audio wird von diesem Browser nicht unterstützt.');
  const key = sampleRate === undefined ? 'default' : String(sampleRate);
  let ctx = contexts.get(key);
  if (!ctx || ctx.state === 'closed') {
    ctx = sampleRate === undefined ? new AudioContext() : new AudioContext({ sampleRate });
    contexts.set(key, ctx);
  }
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
}

/**
 * Master volume node of a context (created on first use, connected to the
 * destination, initial gain 1). Connect your sources here instead of to
 * `ctx.destination` so one volume control affects everything.
 */
export function masterGain(ctx: BaseAudioContext): GainNode {
  let g = masters.get(ctx);
  if (!g) {
    g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    masters.set(ctx, g);
  }
  return g;
}

/** Sets the master volume (0…1) with a short ramp. */
export function setVolume(ctx: BaseAudioContext, volume: number, seconds = FADE_SECONDS): void {
  rampTo(masterGain(ctx).gain, Math.max(0, volume), ctx, seconds);
}

/** Linear ramp of an AudioParam from its current value to `value` within `seconds`. */
export function rampTo(param: AudioParam, value: number, ctx: BaseAudioContext, seconds = FADE_SECONDS): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + seconds);
}

export interface PlayOptions {
  /** Loop the buffer until `stop()`. Default false. */
  loop?: boolean;
  /** Gain of this sound (0…1, before the master volume). Default 1. */
  gain?: number;
  /** Fade-in/out time in seconds. Default {@link FADE_SECONDS}. */
  fade?: number;
  /** Where to connect. Default: the context's master gain. */
  destination?: AudioNode;
}

export interface PlayHandle {
  readonly source: AudioBufferSourceNode;
  /** Per-sound gain node (ramp it for fades/crossfades). */
  readonly gainNode: GainNode;
  /** Fades out and stops. Safe to call more than once. */
  stop(): void;
  /** Changes this sound's gain with a short ramp. */
  setGain(gain: number): void;
  /** Resolves when playback has ended (naturally or via stop()). */
  readonly ended: Promise<void>;
}

/**
 * Plays mono samples (−1…1) recorded at `sampleRate` (≥ 3000 Hz, an
 * AudioBuffer limit) through the context, with short fade-in/out ramps to avoid
 * clicks. The browser resamples to the context rate.
 */
export function playBuffer(
  ctx: AudioContext,
  samples: Float32Array,
  sampleRate: number,
  options: PlayOptions = {},
): PlayHandle {
  const fade = options.fade ?? FADE_SECONDS;
  const target = options.gain ?? 1;
  const buffer = ctx.createBuffer(1, Math.max(1, samples.length), sampleRate);
  buffer.getChannelData(0).set(samples);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = options.loop ?? false;
  const gainNode = ctx.createGain();
  source.connect(gainNode);
  gainNode.connect(options.destination ?? masterGain(ctx));

  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(target, now + fade);
  if (!source.loop) {
    // fade out at the end of the buffer as well
    const end = now + buffer.duration;
    if (buffer.duration > 2 * fade) {
      gainNode.gain.setValueAtTime(target, end - fade);
      gainNode.gain.linearRampToValueAtTime(0, end);
    }
  }

  const ended = new Promise<void>((resolve) => {
    source.addEventListener('ended', () => {
      source.disconnect();
      gainNode.disconnect();
      resolve();
    });
  });
  source.start(now);

  let stopped = false;
  return {
    source,
    gainNode,
    ended,
    stop() {
      if (stopped) return;
      stopped = true;
      rampTo(gainNode.gain, 0, ctx, fade);
      try {
        source.stop(ctx.currentTime + fade + 0.005);
      } catch {
        // already stopped
      }
    },
    setGain(gain: number) {
      if (!stopped) rampTo(gainNode.gain, gain, ctx, fade);
    },
  };
}
