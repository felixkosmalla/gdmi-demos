# 04 – Demo `zeiger` (Schwingungen als Zeiger addieren)

## Goal

Make the phasor ("Zeiger") picture of oscillations tangible: each harmonic oscillation is a rotating pointer, adding oscillations means attaching pointers tip to tail, and the projection of the tip traces the summed wave over time.

## Depends on

01 (controls, URL state, CSS; plotting of the time signal). The phasor drawing itself is custom canvas code in the demo.

## Slide context

**d08, slide 7 "Summieren von Schwingungen"**. Slide text:
- "Die Summation zweier periodischer Schwingungen ergibt wieder eine periodische Schwingung."
- "Beispiel: Überlagerung von Sinus/Cosinusfunktionen"
- "'Phasor'-Darstellung (d.h. drehende Zeiger)"
- "Summation = Anfang/Drehpunkt zweiter Drehzeiger am Ende des ersten Zeigers"

It replaces:
- schulphysikwiki "Überlagerung von harmonischen Schwingungen (Fouriersynthese)", a GeoGebra animation of the superposition with pointers, including beats ("Schwebung") with close frequencies.
- JHU "Harmonic Phasors and Fourier Series" (W. J. Rugh), a Java phasor lecture.

The demo also prepares for d09 (Fourier series = many phasors at integer multiples of a base frequency), but it does not replace task 05.

## Lecture view

Two panels side by side (stacked on mobile):
1. **Zeigerdiagramm (left, square):** a unit-circle-style grid; pointer 1 rotates around the origin, pointer 2 starts at the tip of pointer 1, pointer 3 (optional) at the tip of pointer 2. Each pointer has its own color. The resulting sum pointer (origin → final tip) is drawn thicker. The tip leaves a short fading trail.
2. **Zeitverlauf (right, wide):** the vertical projection (imaginary part) over time, scrolling or fixed window. Individual components are faint in their pointer colors, the sum is bold. A horizontal dashed line connects the tip in the phasor panel to the current point in the time plot, which visually links both panels.

Controls in the lecture area:
- **Play / Pause**, **speed** (slow motion matters for the lecture), **step** buttons when paused.
- **Presets** as large buttons:
  - "Gleiche Frequenz": f₁ = f₂, different phases → the sum is a sine with the same frequency.
  - "Oberschwingung": f₂ = 2·f₁ (and optionally f₃ = 3·f₁) → periodic, non-sinusoidal sum.
  - "Schwebung": f₂ = 1.1·f₁ → the envelope beats with 1/|f₁ − f₂|.
- Per pointer (compact): amplitude, frequency (as a multiple of a base frequency, or absolute in "Umdrehungen pro Sekunde"), phase in degrees.

## Self-study section

- **Erklärung:** a harmonic oscillation A·sin(2πft + φ) as the projection of a rotating pointer (length A, angular speed 2πf, start angle φ). Addition of oscillations = vector addition of pointers. Same frequency → the pointers rotate together, so the sum is again a sine (resulting amplitude and phase readable from the parallelogram). Different frequencies → the shape changes over time; integer ratios → periodic sum (link to the Fourier series in d09); close frequencies → Schwebung.
- **Extra:** toggle a third pointer; show the formula for the equal-frequency case with live numbers: A = √(A₁² + A₂² + 2A₁A₂·cos(φ₁ − φ₂)).
- **Aufgaben:**
  1. Two pointers, same frequency and amplitude: which phase difference makes the sum vanish? Which doubles it?
  2. Build a periodic, non-sinusoidal signal. What must hold for the frequencies?
  3. In the Schwebung preset: measure the beat period in the time plot and compare it with 1/|f₁ − f₂|.
  4. (Preparation for d09) Try 1·f, 3·f, 5·f with amplitudes 1, 1/3, 1/5. Which shape appears?
- **Optional:** "Anhören" for the Schwebung preset, playing two audible tones (e.g. 440 Hz and 444 Hz) to hear the beat. Only if it doesn't complicate the demo much.
- **Quelle / Idee:** credit schulphysikwiki and JHU (Rugh).

## Controls & URL params

| Param | Type | Default | Meaning |
|-------|------|---------|---------|
| `preset` | string | `oberschwingung` | initial preset |
| `n` | number | 2 | number of pointers (2–3) |
| `a1`,`a2`,`a3` | number | preset | amplitudes |
| `f1`,`f2`,`f3` | number | preset | frequencies (rotations per second in demo time) |
| `p1`,`p2`,`p3` | number | preset | phases in degrees |
| `speed` | number | 1 | animation speed |

Explicit parameters override the preset.

## Math

- Pointer k at time t: Aₖ·e^{i(2πfₖt + φₖ)}. Tip of the chain = Σ of those. The time plot shows Im(Σ) (sine convention; state it in Erklärung).
- Use `requestAnimationFrame` with a demo clock (t advanced by dt·speed) so pause, step and speed are trivial. Keep a ring buffer of the last N values for the time plot.
- Frequencies are "demo" frequencies (≈ 0.1–2 rotations per second), not audio frequencies.

## Files to create/change

- `demos/zeiger/index.html`, `demos/zeiger/main.ts` (phasor panel drawn directly on a canvas; time panel may use `plot.ts`).
- `src/demos.ts`: set `ready: true`.

## Acceptance criteria

- Equal frequencies, A₁ = A₂ = 1, φ₂ − φ₁ = 180°: the sum stays at zero. With 0°, the amplitude is 2. With 90°, it's ≈ 1.414 (the readout matches).
- In the Schwebung preset, the envelope period in the time plot matches 1/|f₁ − f₂| (check against the readout).
- The pointer chain and the time plot stay in sync (the connector line hits the current point exactly).
- Animation is smooth (60 fps on a laptop). Pause/step work.
- URL presets load, e.g. `zeiger/?preset=schwebung`.

## Notes / open points

- Choose the default preset together with the lecturer if there is doubt. "Oberschwingung" is chosen because it shows tip-to-tail addition most clearly.
