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
| `preset` | string | `eigene` (none) | initial preset |
| `n` | number | 1 | number of pointers (1–3) |
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

Implementation notes (2026-10-30, done):

- **Time axis runs backwards from "now":** the time plot's x axis is "vergangene Zeit in s (0 = jetzt)". The current value sits at the left edge, right next to the phasor panel, so the connector is short and the curve "flows out" of the phasor diagram. Ticks don't scroll, which makes measuring the beat period easy when paused. The time plot is computed analytically from the current parameters (no ring buffer), so changing a slider redraws the whole history.
- **Alignment:** the phasor panel is its own canvas but uses the time plot's y scale and zero line (offset via `getBoundingClientRect`), so the connector meets the current point exactly. `fitColumns()` makes the phasor column about as wide as it is high. On phones (stacked), the phasor panel uses its own scale and the connector is hidden.
- **Presets and URL:** defaults = the "Oberschwingung" preset. `?preset=x` applies the preset to all keys not in the URL. Changing a parameter by hand (or an explicit URL value that differs from the preset) sets `preset=eigene`. Otherwise a value equal to the default would be dropped from the URL, and the preset's value would come back on reload. Loading `?preset=schwebung` rewrites the URL to the explicit values; that's expected (urlState writes the differences from the defaults).
- Preset values: Gleiche Frequenz (0,5 Hz, A₂ = 0,8, φ₂ = 60°), Oberschwingung (0,5 + 1 Hz, A₂ = 0,5; f₃ = 1,5 Hz, A₃ = 0,33 for the third pointer), Schwebung (1 + 1,1 Hz, window 20 s → beat period 10 s).
- Extra: `win` (time window, s) in the URL; Space toggles play/pause; it starts paused if `prefers-reduced-motion` is set; "Schwebung hören" plays 440 + 444 Hz.
- The time-axis direction and the default preset could be checked with the lecturer.
- 2026-10-30, on request: the "Erklärung" and "Aufgaben" parts were removed from the page. Below the fold, only "Weitere Einstellungen" (time window, live amplitude formula, Schwebung hören) and "Quelle / Idee" remain. `n` also allows a single pointer (1–3).
- 2026-10-30, on request: the demo **starts with a single pointer** (`n=1`, no preset active; the other values are the "Oberschwingung" values, so choosing 2 pointers gives f₂ = 2·f₁). The presets switch to two pointers. "Zurücksetzen" goes back to one pointer.

2026-11-02, on request: Info tips (?) added for Oberschwingung, Schwebung (next to the preset buttons) and Amplitude, Frequenz, Phase (on the first pointer's sliders only). "Quelle / Idee" moved into the `.sources` line under the h1; bottom section and `ideaCredit()` removed.

2026-11-02, review fixes: "Schwebung" only for |f₁ − f₂| ≤ ⅛ of the larger frequency (was ¼). `commonPeriod()` works from exact frequency ratios (also off-grid URL values). With only one pointer of A > 0, the status says so (no "Gleiche Frequenz", no parallelogram). If the phasor column is too narrow for the shared scale (portrait tablets), the time plot's y range grows instead, so both panels keep the same pixel scale and the connector stays straight. The time-plot caption has an info tip on what is plotted and on the reversed time axis; the φ tip says a larger φ moves the curve to the right here.
