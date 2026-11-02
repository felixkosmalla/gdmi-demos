# 06 – Demo `scanline-spektrum` (Frequenzraum bei Bilddaten)

## Goal

Transfer the frequency idea from audio (time) to images (space): pick a line through an image, see its brightness profile as a 1D signal and that signal's spectrum. Students should see that fine patterns mean high spatial frequencies and that natural images keep most of their energy at low frequencies, which is the basis for image compression later in the course.

## Depends on

01 (plot, controls, `dsp.fft` / `magnitudeSpectrum`).

## Slide context

**d09, slide 13 "Frequenzraum bei Bilddaten"**. Slide text:
- "Prinzipiell gelten die gleichen Zusammenhänge für (ortsabhängige) Bilddaten wie für (zeitabhängige) Audiodaten"
- "Bild = 2D-Signal: Frequenzanalyse für alle Zeilen und alle Spalten (x- und y-Richtung)"
- "Beispiel links: Wertverlauf eines Bildes entlang einer Linie → Frequenzspektrum"
- "Details siehe später: Frequenzen spielen eine wichtige Rolle bei der Bildkompression"

It replaces the Brown University Exploratories applet "1D Fast Fourier Transform" (A. van Dam, D. L. Gould; Java Web Start). There you loaded an image from a drop-down and dragged a scanline over it. The top graph showed the scanline in the spatial domain, the bottom graph its frequency domain. The applet's own description: "load the scanline of a standard test image to note how most of the energy is concentrated at low frequencies".

## Lecture view

Layout: image on the left (or top on narrow screens), two plots on the right (stacked):
1. **Image** with a draggable **scanline** (a horizontal line across the image, with a handle; drag with mouse or touch, arrow keys move it by 1 px). Toggle **Zeile / Spalte** switches to a vertical line, matching the slide's "x- und y-Richtung".
2. **Helligkeitsverlauf:** brightness (0–255) along the line vs. position x (pixels).
3. **Spektrum:** magnitude vs. spatial frequency (cycles per image width, 0 … N/2). DC is shown separately or the first bar is clipped, otherwise it dominates. Toggle **lineare / logarithmische** scale (log is the default for photos).

Image selector (big buttons with thumbnails):
- **Streifen grob**, **Streifen fein** (sine or square stripes at two different frequencies)
- **Schachbrett**
- **Verlauf** (gradient)
- **Kante** (a single hard edge, which links to "Sprünge brauchen hohe Frequenzen" from slide 9)
- **Foto** (one CC0 photo)
- **Eigenes Bild…** (file input or drag & drop; processed **only locally**, never uploaded)

## Self-study section

- **Erklärung:** an image as a 2D signal; one row = 1D signal over position; spatial frequency = how often the brightness repeats per image width. Fine detail and sharp edges mean high frequencies, smooth areas mean low frequencies. Most energy in natural images is at low frequencies, which is why dropping high frequencies (compression, blur) changes images less than one might expect. Preview of the later compression chapter.
- **Extra (optional, only if cheap):** a "Tiefpass" slider that zeroes all frequencies above a cutoff and shows the filtered profile (inverse FFT) on top of the original profile, which makes the compression connection tangible.
- **Aufgaben:**
  1. Compare "Streifen grob" and "Streifen fein": where is the peak in the spectrum, and how does it relate to the number of stripes?
  2. Move the line over the edge image. What does the spectrum of a single jump look like? Compare with the square wave in `fourier-reihe`.
  3. In the photo: move the line over sky vs. over a detailed region. How does the spectrum change?
  4. Load your own image (e.g. a text page vs. a landscape). Which one has more high frequencies?
- **Quelle / Idee:** credit Brown University Exploratories.

## Controls & URL params

| Param | Type | Default | Meaning |
|-------|------|---------|---------|
| `img` | string | `foto` | `streifen-grob`, `streifen-fein`, `schachbrett`, `verlauf`, `kante`, `foto` |
| `dir` | string | `zeile` | `zeile` / `spalte` |
| `pos` | number | 0.5 | line position as a fraction of image height/width |
| `log` | bool | true | log magnitude scale |

## Math / implementation

- Load the image into an offscreen canvas at a **fixed working size of 512×512** (or 512 along the analysed direction). Synthetic patterns are generated directly at that size. Photos are scaled/cropped to it.
- Luminance per pixel: Y = 0.2126·R + 0.7152·G + 0.0722·B (Rec. 709).
- Take the row/column (512 values), optionally subtract the mean or show DC separately, compute the FFT, and take the magnitude for bins 0…256. A window (Hann) is optional as a self-study toggle. Default off, so that clean stripe patterns give clean peaks.
- Read pixels once with `getImageData` after loading; while dragging, only slice the array. This is cheap, so updates can run on every pointer move.

## Assets

- **One CC0 / public-domain photo** with both smooth areas (sky) and detail (foliage, buildings), e.g. from Wikimedia Commons (PD/CC0) or a photo the lecturer provides. Store it under `demos/scanline-spektrum/assets/`, ≤ 300 KB, and note the **source URL, author and license** in `assets/LICENSE.md` and in the "Quelle" section.
- No third-party images from the slides.

## Files to create/change

- `demos/scanline-spektrum/index.html`, `demos/scanline-spektrum/main.ts`, `demos/scanline-spektrum/patterns.ts` (synthetic images), `demos/scanline-spektrum/assets/…`.
- `src/demos.ts`: set `ready: true`.

## Acceptance criteria

- "Streifen fein" shows its spectral peak at a clearly higher frequency than "Streifen grob", and the peak index equals the number of stripe periods across the image.
- "Verlauf" puts nearly all energy at the lowest frequencies. "Kante" shows the slowly decaying 1/k spectrum.
- For the photo, the spectrum (log scale) falls off from low to high frequencies.
- Dragging the line updates both plots smoothly (no visible lag on a laptop). Works with touch.
- "Eigenes Bild" works for JPG/PNG and makes no network request.
- URL `scanline-spektrum/?img=streifen-fein&pos=0.3` loads in that state.

## Notes / open points

- Photo source: „Château Frontenac, Quebec city, Canada“ by Wilfredo Rafael Rodriguez Hernandez (Wilfredor), own work, Wikimedia Commons <https://commons.wikimedia.org/wiki/File:Ch%C3%A2teau_Frontenac,_Quebec_city,_Canada.jpg>, **CC0 1.0** (`{{self|cc-zero}}` on the description page, also checked via the Commons API `extmetadata`: LicenseShortName CC0; Commons Quality and formerly Featured image). Downloaded the 960 px thumbnail from upload.wikimedia.org, center-cropped to 960 × 960, scaled to 512 × 512, JPEG quality 88 with `sips` → `assets/foto.jpg`, 139 KB. Credited in `assets/LICENSE.md` and in the page's "Quelle / Idee". (A first candidate, an Unsplash import, was dropped because Commons flags it "Images from Unsplash (review needed)".)

### Result (session 06, done)

**Files:** `demos/scanline-spektrum/index.html`, `main.ts` (UI: image canvas with line, plots, picker, upload, drag & drop), `patterns.ts` (synthetic images as float luminance + `greyRGBA`) + `patterns.test.ts`, `model.ts` (pure: `luminance`, `extractLine`, `lineIndex`/`posOfIndex`, `lineSpectrum`, `peakBin`, `lowEnergyShare`, `lowpass`, `maxAcAmplitude`, `normalizeParams`) + `model.test.ts`, `assets/foto.jpg`, `assets/LICENSE.md`. `src/demos.ts`: `ready: true`. Root `README.md`: status "online". The shared lib was not changed (`dsp.magnitudeSpectrum`, `fft`/`ifft`, `hannWindow` were enough).

**Layout (deviation: three columns):** image (square, `min(36vw, 100dvh − 230px)`) | the two stacked plots | a narrow side panel (`clamp(200px, 14vw, 260px)`) with the image picker (7 buttons with thumbnails), Linie Zeile/Spalte, Skala linear/log and a short hint. The readout sits under the image. ≤ 1000 px: everything stacks (image ≤ 560 px, plots 260 px each), the lecture area gets `height: auto`.

**Patterns (all exact at N = 512):** Streifen grob/fein = vertical cosine stripes with 8/32 periods (peak exactly at k = 8/32, nothing else; in a column only DC). Schachbrett = 8 × 8 squares → square wave with 4 periods, odd multiples of 4. Kante = dark left half, bright right half → as the FFT sees it periodically, exactly one period of the fourier-reihe square wave: odd k only, aₖ = (2·195/N)/sin(πk/N) ≈ 124/k. **Deviation, Verlauf is radial** (bright centre, linear falloff with the distance): a left-to-right ramp would have a jump between its end and start in the periodic FFT view, i.e. a sawtooth with a 1/k spectrum just like the Kante, which contradicts "smooth → low frequencies". The radial gradient starts and ends every row/column at the same value: > 97 % of the AC energy at k ≤ 2, > 99,9 % at k ≤ 16, in every row and column (tested). Patterns are generated as float luminance (no 8-bit rounding), so their spectra have no quantisation noise.

**Spectrum:** amplitude scale (a cosine of amplitude A at k periods → A at bin k; bin 0 = mean). Bars 1 bin wide (min 1 px, so the Kante's empty even bins stay visible); the peak bar and the DC bar get ≥ 3 px. DC is a dark-grey bar; in linear scale the axis is fixed per image and direction (1,2 × the largest AC amplitude over all lines, `maxAcAmplitude`, cached), so the DC bar is clipped and labelled "k = 0: 128 ↑", and the axis doesn't jump while dragging. Log scale is fixed 0,1 … 300 (ticks 0,1/1/10/100). The peak k ≥ 1 is labelled "k = …". Readout under the image: "Stärkste Frequenz: k = … (… Perioden pro Bildbreite/-höhe)" and "Energie bei k ≤ 16: … % (ohne Mittelwert)" (Parseval: A²/2 per bin, the bin N/2 with A²). Profile plot also shows the mean as a dashed line.

**Extras (both cheap, below the fold):** Tiefpass slider (URL `tp`, 1…256, 256 = aus): ideal low-pass via `fft`/`ifft`, filtered profile red over the original, bars above the limit grey with a dashed "Grenze …" marker, readout "Tiefpass behält k ≤ …: … % der Energie". Hann window toggle (URL `hann`, default off). "Grenze" instead of k_c, because there is no Unicode subscript c for the canvas labels.

**URL:** `img`, `dir`, `pos`, `log` as specified, plus `tp`, `hann`. Invalid values are fixed by `normalizeParams` (unknown img/dir → default, pos clamped 0…1, tp rounded/clamped). `pos` is written with 4 decimals (`posOfIndex`, round-trips to the pixel index; tested for all 512); back on the default pixel it is dropped from the URL. Line index = round(pos · 511).

**Interaction:** pointer events with `setPointerCapture` on the image canvas (`touch-action: none`); click/drag jumps the line to the pointer. The canvas is `role="slider"` with tabindex: arrow keys ±1 px, PageUp/Down ±16, Home/End. Focus on pointerdown uses `focusVisible: false`, so no focus ring after a mouse drag. Own image: `<input type=file accept=image/*>` or drop anywhere on the lecture area → `URL.createObjectURL` → `Image.decode()` → centre square cropped onto the 512 canvas (transparent → white) → `getImageData` once → revoke. It's a local override, not in the URL; any picker button or "Zurücksetzen" leaves it. Non-image files and undecodable images give a red status message.

**Verified (headless Chrome via CDP, dev server + `vite preview`, 2026-10-30):** `?img=streifen-fein&pos=0.3` → Streifen fein pressed, "Zeile y = 153", peak k = 32. Mouse drag over the photo: caption, URL (`?pos=0.8004`) and both plot canvases change; 41 moves in 0,68 s with no long tasks (> 50 ms). ArrowDown/Up ±1 px, PageDown +16, Home 0, ArrowRight in Spalte mode. Spalte/linear/log toggles update caption, axis labels, URL (`dir=spalte`, `log=0`). Emulated touch drag moves the line. Upload via file input of a JPG and a PNG (960 × 300, centre-cropped) and drag & drop (`Input.dispatchDragEvent`) of a JPG works; during the uploads the only "request" Chrome logs is the local `blob:` object URL, no HTTP request. A `.txt` gives the error message. Preset after own image, reset → defaults, empty query. Photo statistics over all 512 rows/columns (log mean per band k 1–8 / 9–32 / 33–96 / 97–256): rows 0,88/0,45/0,18/−0,09, columns 1,07/0,60/0,28/0,03, falling in 503/512 rows and 512/512 columns; sky row (y = 10) 99 % energy at k ≤ 16, detail rows 32–50 %. Layout: `.lecture` scrollHeight = viewport at 1280×720, 1366×768, 1920×1080 (also with the Tiefpass readout); 390 px (mobile emulation) scrollWidth 390. No console errors except the site-wide missing `/favicon.ico`. `npm test` (74 tests) and `npm run build` pass; the build emits `assets/foto-<hash>.jpg` and the landing page links the demo. **Not verified:** real touch devices, Safari/Firefox, real fullscreen, a projector, very large own images (only decode + one downscale, should be fine).

**Open:** default `pos = 0.5` on the photo is a busy row (foliage, 49 % energy at k ≤ 16); the falloff is clearer near the sky (try `?pos=0.02`) – maintainers could link that. At 1280 px each bin is ≈ 1,7 px wide, so dense spectra look like a filled area on a DPR-1 projector.

2026-11-02, on request: "Erklärung" and "Aufgaben" commented out in index.html (content kept); "Quelle / Idee" and photo credit moved to the `.sources` line under the h1 (`ideaCredit()` removed); extra controls now under "Weitere Einstellungen". Info tips added for Periode, Energie (status readout), Ortsfrequenz (spectrum caption) and Tiefpass (slider).

2026-11-02, review fixes: `dsp.magnitudeSpectrum` with Hann (amplitude scale) removes the mean before windowing and reports it at bin 0 (it leaked into k = 1: peak k = 1 for stripes, constant columns showed k = 1). "Tiefpass behält …" is computed from the red curve itself (`keptEnergyShare`, no window), shown with Hann even at Grenze 16. Info tips for the Hann toggle and a periodic-continuation explanation in the Kante tip. Profile y axis grows in steps of 10 with the low-pass overshoot (`growRange`, per image and direction, never shrinks while dragging). Peak bar ≤ 1 bin, DC bar ≥ 3 px but only growing to the left, so neighbouring bins stay visible. Thumbnails at device resolution, stripe thumbnails show a quarter of the image (2 / 8 periods, no moiré). Large images are downscaled by repeated halving. Kept `touch-action: none` on the image: in Zeile mode the drag is vertical, so it can't share vertical swipes with page scrolling.
