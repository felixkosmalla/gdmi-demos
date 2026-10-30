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
