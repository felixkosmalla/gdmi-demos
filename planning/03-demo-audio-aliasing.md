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

- Browser test results: _(fill in)_.
