# 01 – Setup & shared library

## Goal

Create the project skeleton and the shared building blocks that every demo uses: build setup, landing page, plotting, controls with URL state, DSP math, audio helpers, shared CSS, a demo template, and the Pages workflow file. After this task, a new demo should only need its own `main.ts` and some HTML.

## Depends on

Nothing. The repository currently contains only `slides/` and `planning/` and is not yet a git repo.

## Slide context

None directly. Read the five demo task files (02–06) briefly to see what the shared lib must support.

## Lecture view / Self-study section

Applies to the **landing page** (`index.html`):
- Header "GdMI – Interaktive Demos" plus one sentence explaining what the site is.
- Demos **grouped by deck** (e.g. "d07 – Digitale Codierung, Digitalisierung", "d08 – Signalverarbeitung: Grundbegriffe", "d09 – Frequenzspektren, Fourier-Transformation"), each as a card with title, one-line description, and the slide number(s).
- Generated from `src/demos.ts`, so adding a demo means adding one entry.
- Demos not built yet are not listed. A registry flag `ready: boolean` controls this.

## Files to create

### Project
- `git init` (branch `main`). Do **not** create the GitHub remote or push; that's task 07.
- `.gitignore`: `node_modules/`, `dist/`, `slides/`, `.DS_Store`.
- `package.json` scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`).
- `tsconfig.json`: strict, ES2022, DOM lib, `moduleResolution: bundler`.
- `vite.config.ts`:
  - `base: '/gdmi-demos/'`
  - `build.rollupOptions.input`: `index.html` + every `demos/*/index.html` found by a glob at config time, **excluding `demos/_template`**.
- `.github/workflows/deploy.yml`: on push to `main` and on `workflow_dispatch`, run `npm ci`, `npm test`, `npm run build`, then `actions/configure-pages` → `actions/upload-pages-artifact` (path `dist`) → `actions/deploy-pages`. Permissions: `pages: write`, `id-token: write`, `contents: read`. Use the current major versions of these actions.

### `src/demos.ts`
```ts
export interface DemoInfo {
  slug: string;          // folder name under demos/
  title: string;         // German
  description: string;   // one line, German
  deck: string;          // e.g. 'd07'
  slides: string;        // e.g. 'Folie 27–28'
  replaces: string;      // credit for the original demo
  ready: boolean;
}
export const decks: Record<string, string> = { d07: '…', d08: '…', d09: '…' };
export const demos: DemoInfo[] = [ /* the five demos, ready: false */ ];
```

### `src/lib/plot.ts`
A small plotting helper on top of Canvas 2D. Suggested API (adapt as needed, but keep it generic):
- `createPlot(container, options)` → `Plot` with `xRange`, `yRange`, axis labels (with units), grid, ticks with sensible "nice" steps, and a legend.
- HiDPI: scale the backing store by `devicePixelRatio`. Handle resizes via `ResizeObserver` and redraw through a user-supplied `draw` callback.
- Drawing primitives in data coordinates: `line(xs, ys, style)`, `fn(f, style)` (samples a function across the visible x range at pixel resolution), `stems(xs, ys, style)`, `bars(xs, ys, style)`, `vline(x, style, label?)` (e.g. Nyquist marker), `point(x, y, style)`, `text(x, y, str)`.
- Styles: color, line width, dash pattern, alpha.
- Coordinate transforms exposed (`toPx`, `fromPx`) for interaction (sketching, dragging).
- Font sizes come from CSS variables so the lecture view can be large.

### `src/lib/controls.ts`
- `urlState(defaults)` reads the query string, coerces types from the defaults (number/boolean/string), and returns a state object plus `set(key, value)`. `set` writes back with `history.replaceState` (debounced) and notifies subscribers.
- Control factories that bind to a state key: `slider({key, label, min, max, step, unit, format})`, `toggle(...)`, `select(...)`, `button(...)`. Each renders a label and a live value readout ("f_s = 150 Hz").
- `resetButton()` restores the defaults.
- `fullscreenButton(element)`.

### `src/lib/dsp.ts` (+ `dsp.test.ts`)
- `fft(re, im)`: in-place radix-2 complex FFT. Length must be a power of two; throw otherwise.
- `magnitudeSpectrum(signal, {window?})` → magnitudes for bins 0…N/2.
- `fourierSeries(period: Float64Array, nHarmonics)` → `{a0, amp[], phase[]}` in the form x(t) = a0 + Σ aₙ·cos(nω₀t + θₙ), with aₙ ≥ 0 and θₙ ∈ [0, 2π). This is the form the JHU applet used and the one task 05 displays.
- `fourierSynthesize(coeffs, n, t)`.
- `sincReconstruct(sampleTimes, sampleValues, fs, t)`: ideal Whittaker–Shannon reconstruction.
- `aliasFrequency(f, fs)`: the apparent frequency in [0, fs/2].
- Tests:
  - FFT matches a naive DFT on random input (N = 8, 64, 1024).
  - Square wave (±1, 1024 samples per period): amplitudes ≈ 4/(πk) for odd k and ≈ 0 for even k.
  - `aliasFrequency(5000, 8000) === 3000`, `aliasFrequency(140, 150) === 10`, `aliasFrequency(84, 150) === 66`, `aliasFrequency(3000, 8000) === 3000`.
  - `sincReconstruct` reproduces a 28 Hz sine sampled at 300 Hz within a small tolerance in the middle of a long sample window.

### `src/lib/audio.ts`
- `getAudioContext(sampleRate?)`: create the context lazily and only after a user gesture. Resume it if suspended.
- `playBuffer(ctx, samples: Float32Array, sampleRate, {loop?, gain?})` → handle with `stop()`, using short gain ramps (≈ 20 ms) to avoid clicks.
- A master volume `GainNode` helper.
- Keep this generic. Task 03 adds its own oscillator logic on top.

### `src/lib/page.css`
- CSS variables: colors (`--accent: #0066C0`, signal role colors), font sizes, spacing.
- Layout classes: `.lecture` (the projector area, fills the viewport height), `.plots` (grid; stacks on narrow screens), `.controls`, `.explain` (self-study section, readable line length), fullscreen styles.
- Mobile: no horizontal scroll at 390 px.

### `demos/_template/`
`index.html` (header with back link to the landing page, `.lecture` with one plot and one slider, `.explain` with placeholder headings "Erklärung", "Ausprobieren / Aufgaben", "Quelle / Idee") plus `main.ts` that wires `urlState` → slider → plot. It must actually work when copied to a new folder.

## Acceptance criteria

- `npm test` passes all `dsp` tests.
- `npm run build` succeeds, and `dist/` contains `index.html` and no `_template` page.
- `npm run dev` shows the landing page. Temporarily copying the template into `demos/test/` gives a working page with a slider that updates the plot and the URL, and reloading the URL restores the slider. Remove `demos/test/` afterwards.
- Plots are crisp on a HiDPI display and resize correctly.
- `git status` shows no files from `slides/`.

## Notes / open points

- Keep `plot.ts` modest and don't grow it into a charting library. If a demo needs something very special (e.g. phasor drawing in task 04), the demo draws it itself on a plain canvas.

### Result (session 01, done)

**Versions:** Node 24 LTS, vite 8.3, typescript 7.0 (the native `tsc`), vitest 5.0. No runtime dependencies. Actions in `deploy.yml`: checkout@v7, setup-node@v7 (node `lts/*`), configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5.

**URLs / build (deviation from a literal reading of the layout):** demos live in `demos/<slug>/`, but are served at **`/gdmi-demos/<slug>/`** (what task 07's table and the slides expect). The `gdmi-pages` plugin in `vite.config.ts` does this: in the build it moves `demos/<slug>/index.html` → `dist/<slug>/index.html` (safe because asset URLs are absolute under `base`); in dev it rewrites `/gdmi-demos/<slug>/…` → `/gdmi-demos/demos/<slug>/…` (and redirects the missing trailing slash). Folders starting with `_` are skipped; slugs `assets`, `src`, `demos`, `node_modules`, `public` are reserved. New demo folders are picked up by `npm run dev` without restart (build inputs need a restart). `appType: 'mpa'` → unknown URLs give 404 in dev.
- Back link in a demo: `href="../"`. Landing page links: `./<slug>/`.
- The landing page's list is rendered **at build/dev time** (static HTML, no JS) from `src/demos.ts` by `renderDemoList` in `src/landing.ts`, replacing `<!-- demo-list -->` in `index.html`. With no ready demo it shows "Die Demos sind in Arbeit …".
- `vite.config.ts` is not type-checked by `tsc` (excluded; would need `@types/node`, which we don't add). Imports of TS files used by the config must carry the `.ts` extension (`allowImportingTsExtensions` is on).

**New demo:** `cp -R demos/_template demos/<slug>`, set `ready: true` in `src/demos.ts`, adapt title/texts. Import shared code relatively (`../../src/lib/…`), and import `page.css` from `main.ts`.

**Page structure / CSS (`src/lib/page.css`):** `main.lecture#lecture` (100dvh flex column; on ≤ 720 px height auto) › `header.lecture-head` (`a.back`, `h1`, `div.head-actions`) + `.plots` (stacked rows sharing the free height; `.plots--row` = side by side; stacks on phones, plots then 260 px high) › `figure.plot-box` › `figcaption` + `div.plot` (canvas container; `.plot--draw` sets `touch-action: none` for drawing) + `.controls` + `p.status`. Below: `section.explain` (h2 "Erklärung", "Ausprobieren / Aufgaben" with `.controls#extra-controls`, "Quelle / Idee" with `p.source`); `.formula` for centred formulas. Role colors as CSS vars `--c-original` (#0066C0), `--c-samples`, `--c-reconstruction` (red), `--c-alias` (red), `--c-copy` (grey), `--c-marker` (purple), `--c-band` (translucent blue), `--c-series-1…4`. Plot font size `--plot-font-size` (16–19 px).

**`src/lib/plot.ts`**
- `createPlot(container, { xRange, yRange, xLabel?, yLabel?, grid? = true, xTicks?, yTicks?, xTickFormat?, yTickFormat?, legend?: LegendItem[], legendPosition?, ariaLabel?, draw?(p) }) → Plot`. The container's CSS size defines the plot; `ResizeObserver` + DPR change → redraw; backing store × devicePixelRatio.
- `Plot`: `redraw()` (rAF-coalesced), `drawNow()`, `setOptions(partial)` (new ranges/legend/draw), `destroy()`; `canvas`, `ctx` (CSS-px transform, for custom shapes in `draw`), `area` {left, top, width, height}, `width`, `height`, `fontSize`; transforms `xToPx`, `yToPx`, `pxToX`, `pxToY`, `toPx(x,y)`, `fromPx(px,py)`, `eventToData(mouseOrPointerEvent)`; `color(c)` resolves `'--var'` names.
- Primitives (data coords, call inside `draw`; clipped to the plot area): `line(xs, ys, style)`, `fn(f, style)` (per device pixel), `stems(xs, ys, {…style, baseline?, dot?})`, `bars(xs, ys, {…style, barWidth? (data units), baseline?})`, `vline(x, style, label?)` (label at the top, flips left near the right edge), `hline(y, style, label?)`, `point(x, y, style)`, `points(xs, ys, style)`, `text(x, y, str, {color, align, baseline, dx, dy, scale, bold, background})`, `rect(x0, y0, x1, y1, style)`, `band(x0, x1, style)` (full height).
- `Style = { color?, width? = 2, dash?, alpha?, fill?, radius? }`; `color` is any CSS color or a CSS var name; use the `roles` constant (`roles.original`, `.samples`, `.reconstruction`, `.alias`, `.copy`, `.marker`, `.band`, `.series1…4`).
- `LegendItem = { label, color, dash?, width?, kind?: 'line'|'stem'|'bar'|'point'|'band' }`.
- Helpers: `niceTicks(min, max, maxTicks)`, `niceStep`, `tickDecimals`. Tick labels use German decimal commas.
- No log axis: for task 06 compute dB/log values in the demo and label the axis accordingly.

**`src/lib/controls.ts`**
- `urlState(defaults, { debounceMs? = 150 }) → UrlState`: `values` (read-only live object), `defaults`, `fromUrl` (Set of keys given in the URL at load – use for "explicit params override preset" in task 04), `get(k)`, `set(k, v)`, `update(partial)` (one notification), `reset()`, `subscribe((values, changedKeys) => …)` → unsubscribe (not called initially – call your render once), `flush()`. Types are coerced from the defaults; booleans are written as `1`/`0` (also accepts true/false/on/off/ja/nein, and a bare `?c140`); only non-default values appear in the URL; unrelated params are kept; invalid values fall back to the default. Notification is synchronous, `history.replaceState` is debounced.
- Factories (return an element to append; all bind both ways to the state): `slider(state, { key, label, symbol?, min, max, step? = 1, unit?, format? })` (readout like "f<sub>s</sub> = 150 Hz"; `symbol: 'f_s'` or `'f_{max}'` gives a subscript; decimals from `step`; clamps URL values into range), `toggle(state, { key, label, swatch? })`, `select(state, { key, label, options: [{value, label}], variant?: 'buttons' (default, aria-pressed button group) | 'dropdown' })` (string or number keys; invalid URL value → default), `button({ label, onClick, variant?: 'primary'|'secondary', title? })`, `resetButton(state, label?)`, `fullscreenButton(element)` (hidden without Fullscreen API, e.g. iPhone).
- Helpers: `formatNumber(v, decimals)` (de-DE, no grouping, no "-0"), `decimalsOf(step)`, `qs(selector, root?)` (throws if missing), `symbolFragment('f_s')`, `parseValue`, `serializeValue`.

**`src/lib/dsp.ts`** (tests in `dsp.test.ts`)
- `fft(re, im)` / `ifft(re, im)` in place (ifft normalised 1/N), throw unless power-of-two length. `isPowerOfTwo`, `nextPowerOfTwo`, `linspace`, `hannWindow(n)`.
- `magnitudeSpectrum(signal, { window?: 'none'|'hann', scale?: 'amplitude'|'raw' })` → bins 0…N/2. Default `'amplitude'` scaling: a sine of amplitude A on bin k gives A, DC c gives |c| (with Hann: divided by the window sum).
- `fourierSeries(period, nHarmonics, { eps? })` → `{ a0, amp, phase }`, arrays of length N+1 **indexed by harmonic number**; x(t) = a0 + Σ amp[n]·cos(n·ω0·t + phase[n]), amp ≥ 0, phase ∈ [0, 2π). Index 0 holds DC in the same form (amp[0] = |a0|, phase[0] = 0 or π), so bar charts can use amp[0…N] directly. Near-zero amplitudes (< eps·max(1, max|x|), eps = 1e-9) → amp 0, phase 0. FFT for power-of-two lengths, direct DFT otherwise. Note: with M samples of a square wave starting at the jump, phases carry a half-sample offset (θ₁ = 3π/2 + π/M).
- `fourierSynthesize(coeffs, n, t)` with **t in periods** (one period = 1).
- `sinc(x)`, `sincReconstruct(times, values, fs, t)` (general), `sincReconstructUniform(t0, values, fs, t)` (samples at t0 + i/fs; one sin per call – use this per pixel column in task 02).
- `aliasFrequency(f, fs)` ∈ [0, fs/2]. `wrapPhase(phi)`.

**`src/lib/audio.ts`**
- `getAudioContext(sampleRate?) → Promise<AudioContext>`: one shared context per sample rate, created lazily, `resume()` called synchronously (call from a click handler). Throws if Web Audio is missing or the rate is rejected → catch for the task-03 fallback.
- `masterGain(ctx)` (shared GainNode → destination; connect sources here), `setVolume(ctx, v, seconds?)`, `rampTo(param, value, ctx, seconds? = 0.02)`, `FADE_SECONDS`, `audioSupported()`.
- `playBuffer(ctx, samples, sampleRate, { loop?, gain?, fade?, destination? }) → { source, gainNode, stop(), setGain(g), ended }` with 20 ms fade-in/out (also at the natural end of non-looping buffers).

**Verified:** `npm test` (20 tests: dsp 15, plot 3, landing 2), `npm run build` (dist has only `index.html` + assets, no `_template`), dev and preview servers with a temporary copy of the template at `demos/test/` checked in headless Chrome (slider → plot + URL, reload restores, reset, URL clamping, DPR 2/3 backing store, live resize, 390 px without horizontal scroll, lecture area fits 1280×720), plus a screenshot of all plot primitives. `demos/test/` was removed afterwards. Not verified: real fullscreen toggling, Safari/Firefox, and audio playback (no demo uses `audio.ts` yet).

**Open:** the git repo is initialised (branch `main`) but nothing is committed yet; task 07 commits. No dark theme (light only, as agreed).
