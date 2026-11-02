# 03 – Demo `audio-aliasing` (Aliasing hören)

## Goal

Let students **hear** aliasing: a sine sampled at 8 kHz rises in pitch up to 4 kHz and then falls again, although the input frequency keeps rising. Show the "perceived vs. actual frequency" graph from the slide live next to it.

## Depends on

01 (plot, controls, `audio.ts`, `dsp.aliasFrequency`).

## Slide context

**d07, slide 27 "Aliasing":** too low a sample rate makes a high-frequency component come out as a lower one. Example images are Moiré patterns. "Auch bei Audio: Audio-Demo der UC Berkeley (EECS20, 'Aliasing')".

**d07, slide 28 "Audio-Aliasing: Beispiel bei 8 kHz Samplingrate"**, a graph of *Wahrgenommene Frequenz* vs. *Tatsächliche Frequenz* (0–8 kHz), a triangle peaking at 4 kHz. Slide text:
- "Bis 4 kHz (halbe Abtastrate) wird die Frequenz korrekt wiedergegeben."
- "Darüber fällt die wahrgenommene Frequenz wieder ab – sie überschreitet nie 4 kHz."
- "Gleicher Effekt wie beim scheinbar rückwärts drehenden Rad im Film."

It replaces the Berkeley EECS20 applet (`ptolemy.berkeley.edu/eecs20/week13/aliasing.html`, the applet no longer runs). That applet had a slider for 0–8000 Hz, sampled at 8 kHz, and played the result.

## Lecture view

- Big **slider "Eingangsfrequenz f"**: 0–8000 Hz, step 10, default 1000. Large readouts: "f = 5000 Hz → hörbar: 3000 Hz".
- **Play/Stop** button (large) and a **Sweep** button that ramps f from 0 to 8000 Hz over ~10 s (with an option for a 0 → 8000 → 0 sweep).
- **Graph:** perceived vs. actual frequency, the triangle with its peak at 4 kHz, the dashed diagonal "ohne Aliasing" for comparison, the f_s/2 line labelled, and a **moving marker** at the current f.
- **Small time-domain plot:** a few milliseconds of the "true" sine (faint) and the 8 kHz samples (stems), plus the alias sine through the samples (red). This makes visible *why* the samples look like a lower frequency.
- **Volume** slider (default low, e.g. 0.2) and a one-line hearing note ("Lautstärke vorher niedrig einstellen").

## Self-study section

- **Erklärung:** f_s = 8 kHz, Nyquist frequency 4 kHz, the folding formula, why the samples of 5 kHz and 3 kHz are identical (show it), and the analogy to the wagon wheel in film (24 frames/s). Plus: why CDs use 44.1 kHz.
- **Extra:** an **A/B comparison** button that plays 3000 Hz, then 5000 Hz, then 3000 Hz (each 1 s). A selectable sampling rate (8 / 11.025 / 16 kHz) is optional; if built, the graph and URL follow it.
- **Aufgaben:**
  1. Which input frequency sounds the same as 1 kHz? Find two.
  2. Predict the audible frequency for f = 7000 Hz, then check it.
  3. Why does the perceived frequency never exceed 4 kHz?
  4. Connect to slide 27: where else do you see this effect (Moiré, wheels, helicopter rotors on video)?
- **Quelle / Idee:** credit Berkeley EECS20 (E. A. Lee, P. Varaiya).

## Controls & URL params

| Param | Type | Default | Meaning |
|-------|------|---------|---------|
| `f` | number | 1000 | input frequency in Hz |
| `fs` | number | 8000 | sample rate (only if the optional selector is built) |
| `vol` | number | 0.2 | volume |
| `updown` | bool | false | sweep 0 → f_s → 0 instead of 0 → f_s (added in session 03) |

Audio never autoplays from a URL. The user must press Play.

## Math / DSP & audio approach

- Samples: x[n] = sin(φₙ), with a **phase accumulator** φₙ₊₁ = φₙ + 2π f / f_s so frequency changes and sweeps are click-free.
- The audible result is exactly the alias at `aliasFrequency(f, fs)`, provided playback reconstructs with a low-pass at f_s/2.
- **Recommended implementation:** `new AudioContext({ sampleRate: 8000 })` plus an `AudioWorkletNode` running the phase accumulator, with `f` as an `AudioParam` or message. Because the context runs at 8 kHz, the browser's output resampler acts as the reconstruction filter. Do **not** use `OscillatorNode`: it is band-limited and won't alias the way we want.
- **Fallback** if a browser rejects an 8 kHz context: a normal context and an 8 kHz `AudioBuffer` (min. supported buffer rate is 3000 Hz) generated in JS, looped, and regenerated with crossfade when f changes. `audio.ts` from task 01 already plays buffers.
- Test in **Chrome, Firefox and Safari**. Note the results under "Notes" below.
- Gain ramps on start/stop/volume changes (≈ 20–30 ms) to avoid clicks.

## Files to create/change

- `demos/audio-aliasing/index.html`, `demos/audio-aliasing/main.ts`, `demos/audio-aliasing/aliasing-worklet.ts` (or `.js`, whichever Vite bundles cleanly as a worklet module via `new URL(..., import.meta.url)`).
- `src/demos.ts`: set `ready: true`.

## Acceptance criteria

- With Play on, moving the slider from 0 to 8000 Hz audibly raises the pitch up to 4 kHz and then lowers it.
- 5000 Hz and 3000 Hz sound identical (A/B button), and the readout and graph marker both show 3000 Hz.
- No clicks when starting, stopping or dragging.
- The marker position always equals `aliasFrequency(f, 8000)`.
- Works in Chrome, Firefox and Safari (desktop), or the fallback kicks in. Nothing plays before a user click.
- The lecture area is readable at 1280×720. Works on a phone, including audio after a tap.

## Notes / open points

### Result (session 03, done)

**Files:** `demos/audio-aliasing/index.html`, `main.ts` (UI, plots, sweep/A/B), `voice.ts` (Web Audio), `aliasing-worklet.ts` (phase accumulator), `model.ts` (pure: `aliasSine`, frequency programs, `aliasProgram`) + `model.test.ts`. `src/demos.ts`: `ready: true`.

**Audio:**
- Primary: `getAudioContext(fs)` (context at f_s) + `AudioWorkletNode` 'sampled-sine' with an a-rate `frequency` AudioParam. The worklet is loaded via `import url from './aliasing-worklet.ts?worker&url'`. Vite bundles it as a standalone IIFE asset, which `addModule` accepts, in dev and in the build. No extra config was needed.
- **Deviation, fallback:** if the f_s context throws, runs at another rate, or has no AudioWorklet, a normal context plays an `OscillatorNode` at `aliasFrequency(f, fs)`. That is the ideal reconstruction of a sampled sine, computed directly. The status line says so. The 8-kHz-`AudioBuffer` fallback from the plan was not built: Chrome and Safari resample buffers with linear interpolation (gain sinc²), so at f = 5000 Hz the 5 kHz image would leak through at about −9 dB next to the 3 kHz alias.
- Chain: source → high-pass 20 Hz (removes the DC a 0-Hz alias leaves, e.g. f = f_s) → voice gain (20 ms fades on start/stop) → `masterGain` (volume). Sources run continuously after the first Play. Stop only fades the gain to 0.
- Sweep and A/B are "frequency programs" (`FreqPoint[]`): the audio runs them as AudioParam automation (`linearRampToValueAtTime` / `setValueAtTime`), sample-accurate and independent of the main thread. The UI mirrors f from `ctx.currentTime` on every animation frame. In the fallback, ramps are split at multiples of f_s/2 (`aliasProgram`) so the oscillator follows the zigzag. Without sound (error), a program still runs visually on `performance.now()`.
- Slider and preset changes set f immediately (no glide). With the phase accumulator that is click-free and avoids a chirp through 4 kHz on A/B jumps.
- Sweep/A/B start the sound if it was off and stop it again at the end. Moving the slider during a program cancels the program and keeps the sound on. The program buttons double as "stop".
- iOS: `navigator.audioSession.type = 'playback'` (Safari 16.4+) so the silent switch doesn't mute the demo.

**UI (deviations / additions):**
- Layout as in `abtastung`: plots left (graph 3 : time plot 2), side panel right with the big readout ("f = 5000 Hz / → hörbar: 3000 Hz" plus a status-colored sentence), Play/Stop, Sweep, A/B, volume, hint. The f slider spans the plot column under the plots (800 steps need the width).
- **A/B button is in the lecture panel**, not only in the self-study part (it's the key moment of slide 28). It plays A = 3000 Hz and B = f_s − 3000 (5000 at 8 kHz, 8025 at 11.025 kHz, 13000 at 16 kHz).
- The optional f_s selector (8 / 11.025 / 16 kHz, URL `fs`) is built, under "Weitere Einstellungen". Changing it clamps f to f_s, sets the slider max to f_s, and restarts the sound on the new context if playing.
- Extra URL param `updown` (bool, default false): sweep 0 → f_s → 0 (10 s per direction).
- Graph axes in kHz (like the slide). Rising segment blue "korrekt", falling segment red "gespiegelt", dashed grey diagonal "ohne Aliasing", band [0, f_s/2], marker with reading lines and an "x Hz" label. Time plot: 20 samples, input sine faint blue, alias sine (with sign, `aliasSine`) red through the samples.
- Shared lib: `group(label, ...children)` moved from `abtastung/main.ts` to `controls.ts` (both demos use it).

**Browser tests (2026-10-30):**
- Chrome (headless, CDP; dev server and `vite preview`): worklet mode, `ctx.sampleRate === 8000`. An `AnalyserNode` on the master gain peaks at 1000/3000/3000/1000 Hz for f = 1000/3000/5000/7000. The A/B sequence shows f 3000 → 5000 → 3000 with the readout at 3000 Hz throughout, and the sound stops after 3 s. The sweep follows the automation through the fold. f_s = 16 kHz: 5000 → 5000 Hz, 13000 → 3000 Hz. The forced fallback (constructor with `sampleRate` throws) gives 3000 Hz for f = 5000 and a folded sweep. URL `?f=20000&fs=123` → fs 8000, f clamped to 8000. Layout: 1280×720 and 1920×1080 without scrolling, 390 px with no horizontal scroll. No console errors (only the site-wide missing favicon).
- Firefox 153 (headless, WebDriver BiDi): worklet mode at 8000 Hz, f = 5000 → peak at 3000 Hz.
- **Safari: not tested** (WebDriver needs "Allow remote automation" in Safari's developer settings). Also not tested: real speakers or headphones, i.e. how the browsers' output resamplers sound near 4 kHz (expect the tone to get quieter there; the Erklärung mentions it), and phones (including the iOS silent switch).

- 2026-11-02, on request: "Erklärung" and "Aufgaben" are commented out in index.html (content kept); the f_s selector stays under "Weitere Einstellungen". "Quelle / Idee" moved into the p.sources line under the h1; ideaCredit() removed. No info tips requested.

- 2026-11-02, review fixes:
  - Sound state moved from main.ts to `playback.ts` (no DOM, `playback.test.ts`). Clicks while the sound is starting share one pending start, and a program exists from the click on, so a double click on Sweep starts and stops it (as after the first use) instead of running a silent visual-only sweep. Changing f_s during a program that started the sound stops it like the program end. The status line is re-rendered on every state change. The UI follows the program at `currentTime − outputLatency` (else `baseLatency`), i.e. as heard.
  - Worklet: where f changes sides of f_s/2 (jump or sweep), φ → π − φ, so the samples stay those of the alias sine with continuous phase. A/B 3000 ↔ 5000 Hz is one seamless 3-kHz sine (tested on `process()` in `aliasing-worklet.test.ts`).
  - Time plot uses a cosine (`aliasSine(f, fs, phase)` now returns amplitude and phase): at f_s/2 the samples are ±1 and the red curve goes through them; the plot is continuous across f_s/2. A running program never shows exactly f_s/2 (`programDisplayFrequency`), so the edge-case text doesn't flash up during a sweep. Readout texts in `readout.ts` (tested): all terms from f rounded to 0.1 Hz.
  - Fallback at exactly f_s/2: volume |sin φ| with a random φ (the phase in the worklet is just as arbitrary).
  - f slider step per f_s (`SAMPLE_RATES`): 12.5 Hz at 11 025 Hz, so f_s/2 = 5512.5 and f_s are reachable.
  - Info tip on "Sweep": the tone gets quieter near f_s/2 (the browser's reconstruction low-pass).
