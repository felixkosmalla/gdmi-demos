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

Three stacked plots sharing a consistent color scheme (the spectrum is **hidden by default**, see the decision under "Notes / open points"):
1. **Zeitbereich:** original signal (continuous, accent blue) + samples (stems with dots, dark grey). Window ≈ 2–3 periods of the fundamental (period of the sum = 1/28 s ≈ 35.7 ms, so show ~80–100 ms).
2. **Rekonstruktion:** original (thin, faint) vs. reconstruction from the samples (red). The visible mismatch is the point.
3. **Spektrum:** magnitude lines of the original components (blue) and their copies at k·f_s ± f (grey, smaller or dashed) for at least k = −2…2, **f_s/2 marked as a vertical line labelled "f_s/2 (Nyquist)"**, and the shaded band [0, f_s/2] that the reconstruction keeps. Components that land in that band as aliases are highlighted in red and labelled with their frequency.

Controls in the lecture area:
- Slider **Abtastrate f_s**: 20–600 Hz, step 1, default **150**.
- Three toggles **28 Hz / 84 Hz / 140 Hz** (all on by default).
- A status line in plain German, computed live, e.g. "f_s = 150 Hz < 2 · 140 Hz = 280 Hz → Aliasing: 140 Hz erscheint als 10 Hz, 84 Hz erscheint als 66 Hz". When fine: "f_s ≥ 2 · f_max → Rekonstruktion exakt".
- Quick buttons: "150 Hz", "280 Hz", "400 Hz" (plain numbers, no "(Folie)"/"(Grenze)" suffix; changed 2026-10-30).
- Toggle **Spektrum anzeigen** (off by default) shows/hides the spectrum plot.

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
| `spec` | bool | false | show the spectrum plot |

The slide should link to `…/abtastung/?fs=150` (add `&spec=1` to open with the spectrum visible).

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

- On first load the spectrum plot is hidden and the two time plots share the height; "Spektrum anzeigen" brings it back, and `spec` survives reload.
- At `?fs=150`: the reconstruction visibly differs from the original; the spectrum (when shown) has alias lines at **10 Hz (from 140 Hz)** and **66 Hz (from 84 Hz)** inside [0, 75 Hz]; the status line says so.
- At f_s ≥ 281 Hz the reconstruction overlays the original (no visible difference in the middle of the window).
- Toggling 140 Hz off makes f_s = 170 Hz sufficient (2·84 = 168).
- The URL updates while dragging, and reloading restores the state.
- Readable at 1280×720 without scrolling the lecture area. Works at 390 px width.

## Notes / open points

2026-11-02, on request: "Erklärung" (incl. "So liest du das Spektrum") and "Aufgaben" are commented out in index.html (content kept); the extra controls stay under "Weitere Einstellungen". "Quelle / Idee" moved to the `.sources` line under the h1. Info tip on the f_s slider label.

### Decision (2026-10-30): spectrum hidden by default

The spectrum plot starts **hidden**. A toggle "Spektrum anzeigen" in the side panel (group "Ansicht") shows it, stored as URL param `spec` (default `false`, so "Zurücksetzen" hides it again). Requested by the lecturer: the demo opens with the two time-domain plots only, and the spectrum is shown when needed. The Erklärung has a section "So liest du das Spektrum" (colors, the f_s = 150 Hz walk-through, simplifications), and exercise 2 points to the toggle. Shared lib: `page.css` got a global `[hidden] { display: none !important; }`, because `.plot-box` sets `display: flex`, which would otherwise override the `hidden` attribute.

- The slide's screenshot of the old applet can be replaced by a screenshot of this demo at f_s = 150 Hz. That's the slide maintainers' call.

### Result (session 02, done)

**Files:** `demos/abtastung/index.html`, `main.ts` (UI, plots, status), `model.ts` (pure math: signal, `sampleBlock`/`reconstruct`, `spectrumLines`, `analyze`, `spectrumMax`) + `model.test.ts` (vitest picks up tests under `demos/` too). `src/demos.ts`: `ready: true`.

**Layout (deviation: controls beside the plots, not below):** the three plots stay stacked, but essential controls + status sit in a right-hand side panel, so each plot gets the full height share (≈ 180 px at 1280×720, ≈ 290 px at 1920×1080). Below 1000 px width the panel moves under the plots. Legends are HTML in the figcaptions instead of in-canvas boxes (short plots, nothing gets covered).

**Shared-lib additions (generic, no API changes):**
- `plot.ts`: `legendElement(items: LegendItem[])` → HTML legend (inline-SVG swatches, role colors via CSS vars); use with `<figcaption class="caption-row">`.
- `page.css`: `.lecture-split` (plots | `.side-panel`, side width `--side-width`, default `clamp(320px, 25vw, 420px)`, stacks ≤ 1000 px), `.caption-row`/`.legend-inline`, status variants `.status--ok/--warn/--bad` (colored left border + soft background), `.button-row > .control-toggle` keeps natural width on phones, `.source { overflow-wrap: anywhere }` (a long URL made the phone layout 427 px wide).

**Math notes:**
- Reconstruction: `sincReconstructUniform` per CSS-pixel column over 3000 samples on each side of the window (not ±1 s): truncation error converges slowly for components just below f_s/2 (140 Hz at 281 Hz: ±1 s gives ≈ 0.1, i.e. visible). With 3000/side the worst error in the window over all f_s ∈ [281, 600] is 0.012 (at 281), without 140 Hz over [169, 600] 0.009 – sub-pixel. Cached per (f_s, window, components, plot width); a slider step redraws within one frame at 1280×720 DPR 2.
- Spectrum: positive frequencies only (cleaner on a projector; the explanation says so), lines at k·f_s ± f for all k that land in [0, f_max-axis]. Axis fixed 0…450 Hz up to f_s = 290 Hz, then grows in 50-Hz steps (`spectrumMax`) so the copies around f_s stay visible. "Alias" = copy of a component above f_s/2 landing in [0, f_s/2] (inclusive, so f_s = 56 shows 84/140 → 28 Hz in red). Overlapping alias labels are merged ("0, 4, 8 Hz" at f_s = 20). Multiples of f_s are dotted guides, labelled "fₛ", "2fₛ" … while there is room. Canvas labels use the Unicode subscript "ₛ" (renders fine in Chrome/macOS system font).
- Status: strict theorem (f_s > 2·f_max → exact); f_s = 2·f_max → "Grenzfall" (with sin phases the samples hit the zero crossings, the component vanishes); components with amplitude 0 count as off.

**Exercise 4 adapted:** at f_s = 56 Hz *all* samples are 0 (28, 84, 140 Hz are odd multiples of f_s/2 = 28 Hz), so the "almost right" part is asked at 57 Hz (aliases 27/26 Hz → smooth ~27-Hz wave). A 5th exercise uses the amplitude sliders. Exercises have `<details>` solutions.

**Verified (headless Chrome, dev + preview):** `?fs=150` status/alias lines 10 and 66 Hz; 281 Hz and 170 Hz without 140 Hz overlay (+ numeric sweep above); 280/168 Grenzfall; URL follows slider input (`?fs=160…281` while dragging), toggles/window survive reload; presets set aria-pressed; reset; arrow keys on the slider; lecture area fits 1920×1080 and 1280×720; 390 px (mobile emulation) has no horizontal scroll; no console errors (only the site-wide missing `/favicon.ico` 404). Not verified: real fullscreen, Safari/Firefox, a real projector.

**Open:** spectrum always draws a component at exactly f_s/2 at full height although its samples are 0 for our sine phases (status line explains it). Slide screenshot could be replaced by `?fs=150` (maintainers' call).
