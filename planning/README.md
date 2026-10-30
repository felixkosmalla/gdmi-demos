# GdMI-Demos – Planning

Interactive web demos for the lecture **Grundlagen der Medieninformatik (GdMI)**. They replace old demos that are linked from the slides and no longer run (Java applets, Java Web Start, GeoGebra files). The site is a static build served via **GitHub Pages**, and every demo has its own stable URL that a slide can link to.

This directory splits the work into tasks that each fit one session. Read this file first, then the task you're working on.

## Status

| # | Task | Depends on | Status |
|---|------|------------|--------|
| 01 | [Setup & shared library](01-setup-shared-lib.md) | – | done |
| 02 | [Demo `abtastung`](02-demo-abtastung.md) | 01 | done |
| 03 | [Demo `audio-aliasing`](03-demo-audio-aliasing.md) | 01 | done |
| 04 | [Demo `zeiger`](04-demo-zeiger.md) | 01 | todo |
| 05 | [Demo `fourier-reihe`](05-demo-fourier-reihe.md) | 01 | todo |
| 06 | [Demo `scanline-spektrum`](06-demo-scanline-spektrum.md) | 01 | todo |
| 07 | [Publish to GitHub Pages](07-publish-github-pages.md) | 01 (can run any time after it; rerun is just a push) | done |

Status values: `todo`, `in progress`, `done`. Update the table when you start or finish a task.

## How to work a task

1. Read this README, then the task file. Each task file is meant to be implementable with only these two documents.
2. Implement it. Reuse `src/lib/*`. If a demo needs a generic helper, add it to the shared lib (with a test if it's math) instead of duplicating it in the demo.
3. Run the task's **acceptance criteria** and fix what fails.
4. Set the status to `done` and write anything the next session needs to know under the task's "Notes / open points".

## Audience & purpose

Every demo is used in two situations:

- **Live in the lecture:** the lecturer drives it on a projector. It must be readable from the back row, start in a meaningful state, and need few clicks.
- **Self-study:** students open it afterwards, read a short explanation, change more parameters, and work through small exercises.

## Decisions (agreed with the lecturer)

- First batch: **five demos** (table below), one per teaching idea. Each slide links to exactly one demo.
- More decks with old demos will follow, so **adding a demo must be cheap**: copy a folder, add one registry entry.
- Public repo **`gdmi-demos`** on the lecturer's **personal GitHub account**, deployed via GitHub Pages.
- **`slides/` is never committed** (it contains third-party images). It is listed in `.gitignore`.
- Technology was left to us, with "keep it simple" as the guideline (see below).
- `abtastung`: the **spectrum plot is hidden by default** and shown with a toggle (URL param `spec`), so the lecture starts in the time domain (2026-10-30, details in [02](02-demo-abtastung.md)).

| Slug | Slide(s) | Replaces |
|------|----------|----------|
| `abtastung` | d07 slide 26 "Beispiel zum Abtasttheorem" | UH Glover applet "An Introduction to Sampling Theory" |
| `audio-aliasing` | d07 slides 27–28 "Aliasing", "Audio-Aliasing: Beispiel bei 8 kHz" | Berkeley EECS20 aliasing applet |
| `zeiger` | d08 slide 7 "Summieren von Schwingungen" | schulphysikwiki GeoGebra animation, JHU phasor lecture |
| `fourier-reihe` | d09 slide 9 "Beispiel: Rechteckfunktion" | JHU "Fourier Series Approximation" applet (+ intmath fallback) |
| `scanline-spektrum` | d09 slide 13 "Frequenzraum bei Bilddaten" | Brown Exploratories "1D Fast Fourier Transform" applet |

## Page design (all demos)

- **Lecture area (above the fold):** title, the main plot(s) large, only the essential controls, large type (body ≥ 18 px, plot labels ≥ 16 px). Must work at 1920×1080 and 1280×720 without scrolling. A fullscreen button puts the lecture area into fullscreen.
- **Below the fold:**
  - **"Erklärung"**: a short German explanation in the slides' terminology (Abtastrate, Nyquist-Frequenz, Zeiger, Oberschwingung …).
  - **"Ausprobieren / Aufgaben"**: extra controls and 3–5 small exercises.
  - A **"Quelle / Idee"** paragraph crediting the original demo (with its old URL).
- **Credit in the lecture area:** `ideaCredit(slug)` appends a short "Idee nach: …" line built from the demo's `replaces` field in `src/demos.ts`, so the source is visible on the projector too. Every demo calls it (see the template).
- **URL state:** all relevant parameters live in the query string (e.g. `abtastung/?fs=150`). Changing a control updates the URL with `history.replaceState`, and loading a URL restores the state, so a slide can link to an exact configuration. A "Zurücksetzen" button restores the defaults.
- **Look:** German UI, light theme by default (projectors), accent color `#0066C0` (from the slide template), neutral greys, a consistent color per signal role across demos (original = accent blue, samples = dark grey, reconstruction/approximation = red/orange). Usable on phones (~390 px): plots stack vertically and controls go full width.
- **Privacy:** no tracking, no cookies, no external CDNs or fonts. Everything is self-hosted.
- **Accessibility basics:** native `<input type="range">` / `<button>` with labels, keyboard operable, visible focus. Color is never the only distinction (use line styles and legends).

## Tech stack

- **Vite + TypeScript**, multi-page build, **no UI framework**.
- **Canvas 2D** for plots (via the shared `plot.ts`), **Web Audio** for sound.
- Dev dependencies only: `vite`, `typescript`, `vitest`. **No runtime dependencies.** Adding one needs a very good reason, since old demos died from rotting dependencies.
- Current Node LTS. `npm` as package manager.

### Repo layout

```
index.html                    landing page: demos grouped by deck, generated from src/demos.ts (at build time, via src/landing.ts)
demos/_template/              copy this to start a new demo
demos/<slug>/index.html       served at /gdmi-demos/<slug>/ (not /demos/<slug>/), see vite.config.ts
demos/<slug>/main.ts
src/demos.ts                  registry: { slug, title, deck, slides, description, replaces, ready }
src/landing.ts                renders the landing page's demo list (pure function, tested)
src/lib/plot.ts               HiDPI canvas plotting
src/lib/controls.ts           labelled controls bound to URL query state, group(), ideaCredit()
src/lib/dsp.ts                FFT, Fourier coefficients, sinc reconstruction, aliasing
src/lib/dsp.test.ts           vitest (also plot.test.ts, landing.test.ts)
src/lib/audio.ts              Web Audio helpers
src/lib/page.css              shared layout and theme
vite.config.ts                base '/gdmi-demos/', inputs auto-discovered from demos/*/index.html
.github/workflows/deploy.yml  build + deploy to Pages on push to main
planning/                     these documents (committed)
slides/                       NOT committed
```

## Out of scope (for now)

- Editing the `.pptx` files. Instead, the root `README.md` contains a table mapping each slide to its new demo URL, so whoever maintains the decks can swap the links.
- Pixel-faithful copies of the old applets. We rebuild the teaching idea, not the old UI.
- Demos for later decks (quantization, compression, …). They will get their own task files when those decks are revised.
