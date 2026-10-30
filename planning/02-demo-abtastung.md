# 02 – Demo `abtastung` (Abtastung & Rekonstruktion)

## Goal

Show what sampling does to a signal in the time domain *and* the frequency domain, and how sampling below the Nyquist rate makes reconstruction fail and creates alias frequencies.

## Depends on

01 (plot, controls, `dsp.sincReconstruct`, `dsp.aliasFrequency`).

## Slide context

**d07, slide 26 "Beispiel zum Abtasttheorem"**. Slide text:
- "Originalsignal besteht aus drei überlagerten Frequenzen: 28 Hz, 84 Hz und 140 Hz."
- "Abtastrate 150 Hz (< 2 · 140 Hz): Rekonstruktion unbrauchbar."
- "Hohe Frequenzanteile fehlen, zusätzliche Störfrequenzen entstehen."

It replaces the Java applet "An Introduction to Sampling Theory" (T. Zawistowski, P. Shah, Univ. of Houston, `www2.egr.uh.edu/~glover/applets/Sampling/Sampling.html`). That applet showed the signal, the samples, the reconstruction, and the spectrum with its copies around ±F, ±2F, …

Teaching points:
1. Sampling = measuring the value at regular time intervals T = 1/f_s.
2. In the spectrum, sampling **repeats** the original spectrum at multiples of f_s.
3. If f_s > 2·f_max, the copies don't overlap and the original can be reconstructed exactly.
4. If f_s < 2·f_max, components above f_s/2 fold back as **alias frequencies**, and the reconstruction is wrong.

## Lecture view

Three stacked plots sharing a consistent color scheme:
1. **Zeitbereich:** original signal (continuous, accent blue) + samples (stems with dots, dark grey). Window ≈ 2–3 periods of the fundamental (period of the sum = 1/28 s ≈ 35.7 ms, so show ~80–100 ms).
2. **Rekonstruktion:** original (thin, faint) vs. reconstruction from the samples (red). The visible mismatch is the point.
3. **Spektrum:** magnitude lines of the original components (blue) and their copies at k·f_s ± f (grey, smaller or dashed) for at least k = −2…2, **f_s/2 marked as a vertical line labelled "f_s/2 (Nyquist)"**, and the shaded band [0, f_s/2] that the reconstruction keeps. Components that land in that band as aliases are highlighted in red and labelled with their frequency.

Controls in the lecture area:
- Slider **Abtastrate f_s**: 20–600 Hz, step 1, default **150**.
- Three toggles **28 Hz / 84 Hz / 140 Hz** (all on by default).
- A status line in plain German, computed live, e.g. "f_s = 150 Hz < 2 · 140 Hz = 280 Hz → Aliasing: 140 Hz erscheint als 10 Hz, 84 Hz erscheint als 66 Hz". When fine: "f_s ≥ 2 · f_max → Rekonstruktion exakt".
- Quick buttons: "150 Hz (Folie)", "280 Hz (Grenze)", "400 Hz".

## Self-study section

- **Erklärung:** sampling, Abtastrate, Nyquist-Frequenz f_s/2, Abtasttheorem (f_s > 2·f_max), spectral copies, alias = folding at f_s/2, with a formula for the alias frequency. Reconstruction = ideal low-pass at f_s/2 (sinc interpolation); mention that real systems use an anti-aliasing filter *before* sampling.
- **Extra controls:** amplitude per component (0–1); "Zeitfenster" (show more periods).
- **Aufgaben** (examples):
  1. Find the lowest f_s at which the reconstruction is exact. Why exactly there?
  2. At f_s = 150 Hz, which frequencies does the reconstruction contain? Check them in the spectrum.
  3. Turn off the 140 Hz component. Which f_s is now enough?
  4. Set f_s = 56 Hz. What happens to the 28 Hz component, and why does the reconstruction look "almost right" for some components?
- **Quelle / Idee:** credit the UH applet.

## Controls & URL params

| Param | Type | Default | Meaning |
|-------|------|---------|---------|
| `fs` | number | 150 | sample rate in Hz |
| `c28`, `c84`, `c140` | bool | true | component on/off |
| `a28`, `a84`, `a140` | number | 1 | amplitudes (self-study) |
| `win` | number | 0.1 | time window in s |

The slide should link to `…/abtastung/?fs=150`.

## Math / DSP

- x(t) = Σ aᵢ·sin(2π fᵢ t) over the enabled components. Choose phases so the plot looks clean (sin is fine).
- Sample times tₙ = n/f_s. For the reconstruction, use samples over a **much longer interval than the visible window** (e.g. ±1 s around it), otherwise the truncated sinc sum shows edge artefacts. Evaluate `sincReconstruct` per pixel column. This is O(pixels × samples), fine for these sizes. If it gets slow at high f_s, limit the sample interval adaptively.
- At exactly f_s = 2f, sampling a sine can hit its zeros. That's correct behaviour; mention it in Erklärung rather than "fixing" it.
- Spectrum: drawn analytically (lines at ±fᵢ and k·f_s ± fᵢ), not via FFT. This is cleaner and exact.
- Alias frequency: `aliasFrequency(fᵢ, fs)`.

## Files to create/change

- `demos/abtastung/index.html`, `demos/abtastung/main.ts` (start from `_template`).
- `src/demos.ts`: set `ready: true` for `abtastung`.

## Acceptance criteria

- At `?fs=150`: the reconstruction visibly differs from the original; the spectrum shows alias lines at **10 Hz (from 140 Hz)** and **66 Hz (from 84 Hz)** inside [0, 75 Hz]; the status line says so.
- At f_s ≥ 281 Hz the reconstruction overlays the original (no visible difference in the middle of the window).
- Toggling 140 Hz off makes f_s = 170 Hz sufficient (2·84 = 168).
- The URL updates while dragging, and reloading restores the state.
- Readable at 1280×720 without scrolling the lecture area. Works at 390 px width.

## Notes / open points

- The slide's screenshot of the old applet can be replaced by a screenshot of this demo at f_s = 150 Hz. That's the slide maintainers' call.
