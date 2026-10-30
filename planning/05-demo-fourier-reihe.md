# 05 – Demo `fourier-reihe` (Fourier-Reihe: Annäherung & Spektrum)

## Goal

Show that a periodic signal can be approximated by a sum of harmonics, how the approximation improves with more harmonics, why jumps need high frequencies (Gibbs phenomenon), and what the magnitude and phase spectrum look like. Students can also **draw their own signal** and see its spectrum.

## Depends on

01 (plot, controls, `dsp.fourierSeries`, `dsp.fourierSynthesize`).

## Slide context

**d09, slide 9 "Beispiel: Rechteckfunktion"**. Slide text:
- "Auch die Rechteckfunktion lässt sich durch eine Fourier-Reihe annähern"
- "Unstetige Übergänge (Sprünge) erfordern hohe Frequenzanteile – Annäherung dort schwieriger"
- "Interaktive Demo der Johns Hopkins University"

It replaces the JHU applet "Fourier Series Approximation" (`pages.jh.edu/~signals/fourier2/index.html`, S. Crutchfield, H. C. Lee). There you selected a labeled signal or **sketched one period with the mouse**, chose N harmonics and clicked "Calculate". It showed the approximation in red plus the magnitude spectrum (aₙ vs. n) and phase spectrum (θₙ vs. n), and had a "Table" of coefficients. Form used:

x(t) = a₀ + a₁·cos(ω₀t + θ₁) + … + a_N·cos(Nω₀t + θ_N), with aₙ ≥ 0 and 0 ≤ θₙ < 2π.

The intmath "Fourier graph applet" was a stopgap and is replaced too.

## Lecture view

- **Signal plot (large):** one or two periods of the original (blue) and the approximation with N harmonics (red), updating **live** while N changes (no "Calculate" button).
- **Spectrum:** magnitude bar chart aₙ for n = 0…N (bars beyond N greyed out, so you see what is "missing"). The phase spectrum sits in a second, smaller chart, or a toggle switches between magnitude and phase.
- **Controls:**
  - Signal preset buttons: **Rechteck**, **Dreieck**, **Sägezahn**, **Sinus**, **Zeichnen**.
  - Slider **Anzahl Harmonische N**: 0–50, default 5. An "Animation" button steps N from 1 to 50 for the lecture.
- Readout: "N = 5 → höchste Frequenz 5·f₀".

## Drawing mode

- In "Zeichnen" mode (or by dragging directly on the signal plot in any mode, like the JHU applet), the user sketches one period with mouse or touch. Store the period as an array of e.g. 512 values. Points between pointer events are linearly interpolated. Drawing over an existing curve modifies only the touched x-range.
- Pointer events (`pointerdown/move/up`) with `setPointerCapture`; `touch-action: none` on the canvas.
- The curve is clamped to the visible y-range. "Löschen" resets to zero.
- After each stroke (or live while drawing, if fast enough), recompute the coefficients.

## Self-study section

- **Erklärung:** periodic signal = sum of a DC component and harmonics at n·f₀. Coefficients = how much of each harmonic; magnitude and phase spectrum. The square wave contains only odd harmonics with amplitude 4/(πn). Jumps need many high harmonics, and the overshoot near the jump (~9 % of the jump height) doesn't go away with larger N; it only gets narrower (Gibbs phenomenon). Link to d08 (pointers) and to compression later (dropping high harmonics).
- **Koeffiziententabelle:** n, aₙ, θₙ (degrees), as in the JHU "Table".
- **Aufgaben** (German adaptation of the JHU exercises):
  1. Zeichne ein Signal mit großem Grundschwingungsanteil, aber kleinem Gleichanteil und kleinen Oberschwingungen.
  2. Zeichne ein Signal mit großem Gleichanteil und großer Grundschwingung, aber kleinen Oberschwingungen.
  3. Zeichne ein Signal mit kleinem Gleichanteil und kleiner Grundschwingung, aber großer 2. Harmonischer.
  4. Zeichne ein Signal mit kleiner Grundschwingung, aber großem Gleichanteil und großer 2. Harmonischer.
  5. Wie würdest du ein Signal konstruieren, das vor allem die 2., 3. und 4. Harmonische enthält?
  6. (Extra) Rechteck vs. Dreieck: Welches Signal kommt mit weniger Harmonischen aus – und warum?
- **Quelle / Idee:** credit the JHU applet.

## Controls & URL params

| Param | Type | Default | Meaning |
|-------|------|---------|---------|
| `sig` | string | `rechteck` | `rechteck`, `dreieck`, `saegezahn`, `sinus`, `zeichnen` |
| `n` | number | 5 | number of harmonics |
| `view` | string | `betrag` | `betrag` / `phase` / `beide` |

Drawn curves are not stored in the URL; they're too long. Optionally offer "Link kopieren" with a compressed curve. That is low priority.

## Math

- Represent one period with M = 512 samples (power of two → `fft` from the lib). Coefficients via `dsp.fourierSeries`: a₀ = mean; aₙ = 2·|Xₙ|/M; θₙ = arg(Xₙ) wrapped to [0, 2π). Treat |X| ≈ 0 as phase 0 to avoid noisy phase bars.
- Synthesis per pixel column via `fourierSynthesize`.
- Presets are defined as sampled periods (±1 amplitude), so the same pipeline handles presets and drawings.
- Expected values (checks): square ±1 → aₙ = 4/(πn) for odd n, 0 for even. Triangle → 8/(π²n²) for odd n. Sawtooth → 2/(πn) for all n.

## Files to create/change

- `demos/fourier-reihe/index.html`, `demos/fourier-reihe/main.ts`.
- If the coefficient form is missing from the lib or needs fixes, extend `src/lib/dsp.ts` and `dsp.test.ts`.
- `src/demos.ts`: set `ready: true`.

## Acceptance criteria

- Square wave: the magnitude spectrum shows only odd harmonics, with a₁ ≈ 1.273, a₃ ≈ 0.424, a₅ ≈ 0.255.
- Square wave at N = 50: the overshoot peak ≈ 1.18 (≈ 9 % of the jump height of 2) next to the jumps. It stays at that height when N grows.
- Triangle converges visibly faster than square (by eye at N = 5).
- A hand-drawn sine-like curve gives a dominant a₁. A drawn constant offset shows up as a₀.
- Drawing works with mouse and touch. N changes update instantly (no lag at N = 50).
- URL `fourier-reihe/?sig=rechteck&n=9` loads in that state.

## Notes / open points

- The slide uses a 2014 screenshot of the JHU applet. A screenshot of this demo (square, N ≈ 9) can replace it. That's the slide maintainers' call.

### Result (session 05, done)

**Files:** `demos/fourier-reihe/index.html`, `main.ts` (UI, plots, drawing, animation, table), `model.ts` (pure: `presetPeriod`, `coefficients`, `paintSegment`, `maxValue`) + `model.test.ts`. `src/demos.ts`: `ready: true`. Root `README.md`: status "online". The shared lib was not changed: `dsp.fourierSeries`/`fourierSynthesize` already use exactly the form above (aₙ ≥ 0, θₙ ∈ [0, 2π), |X| ≈ 0 → amplitude and phase 0; n = 0 holds |a₀| with phase 0 or π).

**Deviation, M = 2048 instead of 512:** a sampled jump gives aₙ = (4/M)·cot(πn/M) instead of 4/(πn). At M = 512 that is 3 % too small at n = 50, so the Gibbs peak read 1,17 at N = 50 and sank slightly from N = 25 to 50 (1,178 → 1,173), against the acceptance criterion. At 2048 the error is 0,2 % and the peak is 1,18 for every N ≥ 9. The cost is negligible (FFT of 2048 values per pointer move).

**Presets:** all odd (start at 0 and rise, like a sine), so phases are exactly 90° or 270°: Rechteck +1/−1 (sample at the jump = 0, the mean, which keeps the sampled period exactly odd → even aₙ are exactly 0), Dreieck peaking at T/4 (phases alternate 270°/90°), Sägezahn as a ramp −1 → +1 over the whole period (jump at the period boundary, all phases 90°), Sinus (a₁ = 1, θ₁ = 270°).

**Layout:** as in `abtastung`, plots on the left (signal over two periods with ticks 0, T/2, T, 3T/2, 2T; spectrum below) and a side panel on the right (signal buttons, "Löschen" only in drawing mode, slider N 0–50, animation button, spectrum view Betrag/Phase/Beide, readout, drawing hint). Row heights 3:2, or 5:3:2,6 with both spectra. Magnitude: bars n ≤ N red, n > N grey and translucent, plus a dashed "N = …" marker at N + ½ (so the split doesn't depend on color alone). Phase: stems in degrees, only for harmonics with aₙ > 0. On short phase plots (both spectra at 1280×720) only 0°/180°/360° are labelled.

**Additions:** the readout has a second line "Größter Wert: Original …, Annäherung …" and for Rechteck/Sägezahn "→ Überschwingen um x % der Sprunghöhe 2" (makes Gibbs readable on the projector: 9 % at N = 50). The coefficient table has a "Frequenz" column (n·f₀) and shows rows 0…N; "–" for θₙ when aₙ = 0; a negative a₀ appears as its magnitude with 180° (explained under the table). Exercises have `<details>` solutions, like `abtastung`.

**Drawing:** pointer events with `setPointerCapture`, `getCoalescedEvents`, `.plot--draw` (`touch-action: none`) on the signal plot. Dragging in any mode copies the current preset into the drawing and switches to `sig=zeichnen`. Both plotted periods paint the same samples (t mod T); strokes are interpolated sample by sample, clamped to ±1,5 (the plot range), and coefficients are recomputed live on every move. The drawing stays in memory while switching presets; "Zurücksetzen" resets only the URL state, not the drawing. On phones the signal plot does not scroll the page (touch-action none).

**Animation:** N = 1 … 50, 700 ms per step below 10, 350 ms below 20, then 150 ms (≈ 13 s). Moving the slider or drawing stops it.

**Verified (headless Chrome via CDP, dev server, 2026-10-30):** `?sig=rechteck&n=9` loads with Rechteck/N = 9, table a₁ = 1,273, a₃ = 0,424, a₅ = 0,255, a₂ = 0 "–", θ = 270°; N = 50 readout 1,18 / 9 %; invalid `?sig=foo&n=999&view=x` → rechteck, n = 50, betrag. Slider steps 30…50 take one frame each (≈ 16 ms). Mouse stroke (sine-like over one period) → a₁ = 0,94 dominant; "Löschen" → all 0; touch stroke (emulated touch events) of a horizontal line → constant (a₀ only). Animation steps and stops; reset → defaults, empty query. Lecture area fits 1280×720 and 1920×1080 without scrolling in all three spectrum views; 390 px (mobile emulation) has no horizontal scroll, plots stack. No console errors (only the site-wide missing `/favicon.ico`). `npm test` (53 tests) and `npm run build` pass. **Not verified:** real touch devices, Safari/Firefox, real fullscreen, a projector.

**Open:** "Link kopieren" with a compressed drawn curve (low priority) is not built. The README link could become `?sig=rechteck&n=9` if the slide screenshot uses N = 9 (maintainers' call).
