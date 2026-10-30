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

- Photo source: _(fill in once chosen)_.
