// Demo "Frequenzraum bei Bilddaten" (d09, Folie 13): a draggable line (row or
// column) across an image, the brightness along it as a 1D signal, and that
// signal's spectrum. Images are synthetic patterns, one CC0 photo, or an own
// image that is only processed locally (object URL → canvas, no upload).
// Pixels are read once per image; dragging only slices the luminance array.
import '../../src/lib/page.css';
import {
  button,
  formatNumber,
  fullscreenButton,
  infoTerm,
  qs,
  select,
  slider,
  toggle,
  urlState,
} from '../../src/lib/controls';
import { createPlot, legendElement, roles, type LegendItem } from '../../src/lib/plot';
import {
  BRIGHTNESS_RANGE,
  K_LOW,
  K_MAX,
  extractLine,
  growRange,
  keptEnergyShare,
  lineIndex,
  lineSpectrum,
  lowEnergyShare,
  lowpass,
  luminance,
  maxAcAmplitude,
  normalizeParams,
  ortsfrequenzInfo,
  peakBin,
  posOfIndex,
  type Direction,
  type ImageId,
} from './model';
import { N, PATTERNS, greyRGBA, patternLuminance, type PatternId } from './patterns';

const state = urlState({
  img: 'foto', // streifen-grob | streifen-fein | schachbrett | verlauf | kante | foto
  dir: 'zeile', // zeile | spalte
  pos: 0.5, // line position as a fraction of the image height (zeile) or width (spalte)
  log: true, // logarithmic magnitude axis
  tp: K_MAX, // low-pass cutoff k_c (K_MAX = off)
  hann: false, // Hann window before the FFT
});
state.update(normalizeParams(state.values, state.defaults));

const LABELS: Record<ImageId, string> = {
  'streifen-grob': 'Streifen grob',
  'streifen-fein': 'Streifen fein',
  schachbrett: 'Schachbrett',
  verlauf: 'Verlauf',
  kante: 'Kante',
  foto: 'Foto',
};
const FOTO_URL = new URL('./assets/foto.jpg', import.meta.url).href;
/** Log axis: amplitudes below LOG_MIN are not drawn. */
const LOG_MIN = 0.1;
const LOG_MAX = 300;

// ---------------------------------------------------------------------------
// Pictures: an N × N canvas for display plus its luminance for the analysis

interface Picture {
  canvas: HTMLCanvasElement;
  lum: Float64Array;
  /** Cached maxAcAmplitude per "dir/hann". */
  acMax: Map<string, number>;
}

function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D not supported');
  return [c, ctx];
}

function pictureFromLum(lum: Float64Array): Picture {
  const [canvas, ctx] = newCanvas();
  ctx.putImageData(new ImageData(greyRGBA(lum), N, N), 0, 0);
  return { canvas, lum, acMax: new Map() };
}

/**
 * Draws the square (sx, sy, s) of `src` scaled to size × size. Large factors go
 * through repeated halving (each step a 2 × 2 average), so browsers that ignore
 * imageSmoothingQuality = 'high' don't alias fine detail.
 */
function drawScaled(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sx: number, sy: number, s: number, size: number): void {
  let source = src;
  let x = sx;
  let y = sy;
  let w = s;
  while (w >= 2 * size) {
    const half = Math.ceil(w / 2);
    const c = document.createElement('canvas');
    c.width = c.height = half;
    const cx = c.getContext('2d');
    if (!cx) break;
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(source, x, y, w, w, 0, 0, half, half);
    [source, x, y, w] = [c, 0, 0, half];
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x, y, w, w, 0, 0, size, size);
}

/** Centre square of the image, scaled to N × N (transparent parts become white). */
function pictureFromImage(img: HTMLImageElement): Picture {
  const [canvas, ctx] = newCanvas();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const s = Math.min(w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, N, N);
  drawScaled(ctx, img, (w - s) / 2, (h - s) / 2, s, N);
  const lum = luminance(ctx.getImageData(0, 0, N, N).data);
  return { canvas, lum, acMax: new Map() };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty image');
  return img;
}

const cache = new Map<ImageId, Picture>();
function patternPicture(id: PatternId): Picture {
  let p = cache.get(id);
  if (!p) cache.set(id, (p = pictureFromLum(patternLuminance(id))));
  return p;
}

/** The own image while it is shown (never stored, never in the URL). */
let custom: { picture: Picture; name: string } | null = null;
let picture: Picture | null = null;
let message: { text: string; bad: boolean } | null = null;
let loadToken = 0;

/** Shows the own image if one is active, else the image from the URL state (loading the photo once). */
async function showImage(): Promise<void> {
  const token = ++loadToken;
  message = null;
  if (custom) return setPicture(custom.picture);
  const id = state.values.img as ImageId;
  if (id !== 'foto') return setPicture(patternPicture(id));
  let p = cache.get('foto');
  if (!p) {
    picture = null;
    message = { text: 'Foto wird geladen …', bad: false };
    renderAll();
    try {
      p = pictureFromImage(await loadImage(FOTO_URL));
      cache.set('foto', p);
    } catch {
      if (token === loadToken) {
        message = { text: 'Das Foto konnte nicht geladen werden.', bad: true };
        renderAll();
      }
      return;
    }
    if (token !== loadToken) return;
    message = null;
  }
  setPicture(p);
}

async function loadFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) {
    message = { text: `„${file.name}“ ist kein Bild. Bitte eine JPG- oder PNG-Datei wählen.`, bad: true };
    return renderStatus();
  }
  const url = URL.createObjectURL(file); // blob: URL, stays in the browser
  const token = ++loadToken; // a preset click during the decode supersedes this upload
  try {
    const p = pictureFromImage(await loadImage(url));
    if (token !== loadToken) return;
    custom = { picture: p, name: file.name };
    message = null;
    setPicture(p);
  } catch {
    message = { text: `„${file.name}“ konnte nicht als Bild gelesen werden.`, bad: true };
    renderStatus();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setPicture(p: Picture): void {
  picture = p;
  updateLine();
  renderAll();
}

// ---------------------------------------------------------------------------
// Current line and its spectrum (recomputed on every move; one FFT of 512 values)

let line: Float64Array = new Float64Array(N);
let spec: Float64Array = new Float64Array(K_MAX + 1);
let filtered: Float64Array | null = null;
/** Share of the AC energy kept by the low-pass (NaN while it is off). */
let tpShare = NaN;
let profileY: { picture: Picture | null; dir: Direction; range: [number, number] } = {
  picture: null,
  dir: 'zeile',
  range: [...BRIGHTNESS_RANGE],
};
let mean = 0;
let peak = -1;
let acMax = 0;

const dir = (): Direction => state.values.dir as Direction;
const index = (): number => lineIndex(state.values.pos);

function updateLine(): void {
  if (!picture) return;
  const { hann, tp } = state.values;
  line = extractLine(picture.lum, N, dir(), index());
  spec = lineSpectrum(line, hann);
  filtered = tp < K_MAX ? lowpass(line, tp) : null;
  // The low-pass filters the line itself (no window), so its share comes from the filtered curve.
  tpShare = filtered ? keptEnergyShare(line, filtered) : NaN;
  // y range of the profile: starts at 0 … 255 for each image and direction, then grows with the overshoot
  if (!filtered || profileY.picture !== picture || profileY.dir !== dir()) {
    profileY = { picture, dir: dir(), range: [...BRIGHTNESS_RANGE] };
  }
  if (filtered) profileY.range = growRange(profileY.range, filtered);
  mean = line.reduce((s, v) => s + v, 0) / N;
  peak = peakBin(spec);
  const key = `${dir()}/${hann}`;
  let m = picture.acMax.get(key);
  if (m === undefined) picture.acMax.set(key, (m = maxAcAmplitude(picture.lum, N, dir(), hann)));
  acMax = m;
}

function setIndex(i: number): void {
  const j = Math.min(N - 1, Math.max(0, i));
  // keep the default value (no URL param) when the line is back at its default pixel
  state.set('pos', j === lineIndex(state.defaults.pos) ? state.defaults.pos : posOfIndex(j));
}

// ---------------------------------------------------------------------------
// Image with the draggable line

const imgWrap = qs('#image-wrap');
const imgCanvas = qs<HTMLCanvasElement>('#image');
const imgCtx = imgCanvas.getContext('2d')!;
let imgFrame = 0;

function drawImage(): void {
  imgFrame = 0;
  const size = imgCanvas.clientWidth;
  if (size === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(size * dpr);
  if (imgCanvas.width !== px || imgCanvas.height !== px) {
    imgCanvas.width = px;
    imgCanvas.height = px;
  }
  const ctx = imgCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (!picture) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(picture.canvas, 0, 0, size, size);

  const c = ((index() + 0.5) / N) * size;
  const row = dir() === 'zeile';
  const accent = getComputedStyle(imgCanvas).getPropertyValue('--accent').trim() || '#0066c0';
  ctx.lineCap = 'butt';
  for (const [width, color] of [
    [6, 'rgba(255, 255, 255, 0.9)'],
    [2.5, accent],
  ] as const) {
    ctx.beginPath();
    if (row) {
      ctx.moveTo(0, c);
      ctx.lineTo(size, c);
    } else {
      ctx.moveTo(c, 0);
      ctx.lineTo(c, size);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  // handle with a double arrow at the start of the line
  const r = 13;
  const along = Math.min(size - r - 2, Math.max(r + 2, c)); // keep the handle inside at the image border
  const [hx, hy] = row ? [r + 4, along] : [along, r + 4];
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, 2 * Math.PI);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (row) {
      ctx.moveTo(hx - 5, hy + s * 2);
      ctx.lineTo(hx + 5, hy + s * 2);
      ctx.lineTo(hx, hy + s * 8);
    } else {
      ctx.moveTo(hx + s * 2, hy - 5);
      ctx.lineTo(hx + s * 2, hy + 5);
      ctx.lineTo(hx + s * 8, hy);
    }
    ctx.fill();
  }
}

function scheduleImage(): void {
  if (!imgFrame) imgFrame = requestAnimationFrame(drawImage);
}
new ResizeObserver(scheduleImage).observe(imgWrap);

function pointerIndex(ev: PointerEvent): number {
  const r = imgCanvas.getBoundingClientRect();
  const f = dir() === 'zeile' ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
  return Math.floor(f * N);
}

imgCanvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  ev.preventDefault();
  imgCanvas.setPointerCapture(ev.pointerId);
  // focus for the arrow keys, without the keyboard focus ring after a mouse/touch drag
  imgCanvas.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  setIndex(pointerIndex(ev));
});
imgCanvas.addEventListener('pointermove', (ev) => {
  if (imgCanvas.hasPointerCapture(ev.pointerId)) setIndex(pointerIndex(ev));
});
imgCanvas.addEventListener('keydown', (ev) => {
  const i = index();
  const steps: Record<string, number> = {
    ArrowUp: i - 1,
    ArrowLeft: i - 1,
    ArrowDown: i + 1,
    ArrowRight: i + 1,
    PageUp: i - 16,
    PageDown: i + 16,
    Home: 0,
    End: N - 1,
  };
  if (!(ev.key in steps)) return;
  ev.preventDefault();
  setIndex(steps[ev.key]);
});

// ---------------------------------------------------------------------------
// Plots

const across = (): string => (dir() === 'zeile' ? 'Bildbreite' : 'Bildhöhe');
const xs = Float64Array.from({ length: N }, (_, i) => i);

const profilePlot = createPlot(qs('#plot-profile'), {
  xRange: [0, N - 1],
  yRange: [...BRIGHTNESS_RANGE],
  yTicks: [-100, -50, 0, 50, 100, 150, 200, 250, 300, 350],
  xLabel: 'Position x in Pixel',
  yLabel: 'Helligkeit Y',
  ariaLabel: 'Helligkeitsverlauf entlang der Linie',
  draw(p) {
    if (!picture) return;
    p.hline(mean, { color: roles.samples, width: 1.5, dash: [6, 5] });
    if (filtered) {
      p.line(xs, line, { color: roles.original, width: 1.5, alpha: 0.6 });
      p.line(xs, filtered, { color: roles.reconstruction, width: 3 });
    } else {
      p.line(xs, line, { color: roles.original, width: 2.5 });
    }
  },
});

const logOf = (v: number): number => Math.log10(Math.max(v, LOG_MIN));

const spectrumPlot = createPlot(qs('#plot-spectrum'), {
  xRange: [-2, K_MAX + 2],
  yRange: [logOf(LOG_MIN), logOf(LOG_MAX)],
  xTicks: [0, 32, 64, 96, 128, 160, 192, 224, 256],
  ariaLabel: 'Betragsspektrum der Linie über der Ortsfrequenz k',
  draw(p) {
    if (!picture) return;
    const { log, tp } = state.values;
    const f = log ? logOf : (v: number): number => v;
    const base = log ? logOf(LOG_MIN) : 0;
    // Bars stay inside their own bin (plot.ts draws at least 1 px), so gaps such as
    // the missing even k of the Kante stay visible. The peak bar gets up to the full
    // bin, the DC bar at least 3 px, growing only to the left into the empty margin.
    const barWidth = 0.8;
    const px3 = (3 * (K_MAX + 4)) / p.area.width; // 3 px in bins
    const peakWidth = Math.min(1, Math.max(barWidth, px3));
    const dcWidth = Math.min(2.4, Math.max(barWidth, px3));
    const dcX = (barWidth - dcWidth) / 2; // right edge stays at k = 0.4
    const vals = (from: number, to: number): [number[], number[]] => {
      const k: number[] = [];
      const v: number[] = [];
      for (let i = from; i <= to; i++) {
        k.push(i);
        v.push(f(spec[i]));
      }
      return [k, v];
    };
    const colorOf = (k: number): string => (tp >= K_MAX ? roles.original : k <= tp ? roles.reconstruction : roles.copy);
    if (tp < K_MAX) {
      p.bars(...vals(tp + 1, K_MAX), { color: roles.copy, alpha: 0.55, barWidth, baseline: base });
      p.bars(...vals(1, tp), { color: roles.reconstruction, barWidth, baseline: base });
      p.vline(tp + 0.5, { color: roles.marker, width: 2, dash: [8, 5] }, `Grenze ${tp}`);
    } else {
      p.bars(...vals(1, K_MAX), { color: roles.original, barWidth, baseline: base });
    }
    if (peak > 0) p.bars([peak], [f(spec[peak])], { color: colorOf(peak), barWidth: peakWidth, baseline: base });
    // DC bar, clipped at the top in the linear scale (its value is written next to it)
    const yTop = p.options.yRange[1];
    p.bars([dcX], [f(spec[0])], { color: roles.samples, barWidth: dcWidth, baseline: base });
    if (f(spec[0]) > yTop) {
      p.text(0, yTop, `k = 0: ${formatNumber(spec[0])} ↑`, { dx: 10, dy: 4, baseline: 'top', background: true });
    }
    if (peak > 0) {
      const labelMax = p.pxToY(p.area.top + p.fontSize + 10);
      p.text(peak, Math.min(f(spec[peak]), labelMax), `k = ${peak}`, {
        align: peak > K_MAX * 0.85 ? 'right' : peak < 12 ? 'left' : 'center',
        dx: peak < 12 ? 8 : 0,
        dy: -6,
        bold: true,
        background: true,
      });
    }
  },
});

function updatePlotOptions(): void {
  const { log } = state.values;
  const linMax = Math.max(acMax, 5) * 1.2;
  profilePlot.setOptions({ xLabel: `Position ${dir() === 'zeile' ? 'x' : 'y'} in Pixel`, yRange: profileY.range });
  spectrumPlot.setOptions({
    xLabel: `Ortsfrequenz k in Perioden pro ${across()}`,
    yLabel: log ? 'Amplitude (log)' : 'Amplitude',
    yRange: log ? [logOf(LOG_MIN), logOf(LOG_MAX)] : [0, linMax],
    yTicks: log ? [-1, 0, 1, 2] : undefined,
    yTickFormat: log ? (v) => formatNumber(10 ** v, v < 0 ? 1 : 0) : undefined,
  });
}

function setLegend(id: string, items: LegendItem[]): void {
  const cap = qs(id);
  cap.querySelector('.legend-inline')?.remove();
  cap.append(legendElement(items));
}

function renderLegends(): void {
  const tp = state.values.tp < K_MAX;
  setLegend('#cap-profile', [
    { label: 'Helligkeit', color: roles.original },
    ...(tp ? [{ label: 'nach Tiefpass', color: roles.reconstruction, width: 3 }] : []),
    { label: 'Mittelwert', color: roles.samples, dash: [6, 5] },
  ]);
  setLegend('#cap-spectrum', [
    { label: 'k = 0: Mittelwert', color: roles.samples, kind: 'bar' },
    ...(tp
      ? [
          { label: 'bis zur Grenze: bleibt', color: roles.reconstruction, kind: 'bar' as const },
          { label: 'darüber: entfernt', color: roles.copy, kind: 'bar' as const },
        ]
      : [{ label: 'k ≥ 1', color: roles.original, kind: 'bar' as const }]),
  ]);
}

// ---------------------------------------------------------------------------
// Image picker (buttons with thumbnails), controls, file input, drag & drop

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.hidden = true;
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void loadFile(file);
});

function thumb(id: ImageId): HTMLElement {
  if (id === 'foto') {
    const img = document.createElement('img');
    img.src = FOTO_URL;
    img.alt = '';
    img.className = 'thumb';
    return img;
  }
  // At device resolution (32 CSS px, as `.pick .thumb` in index.html). The stripes show a
  // quarter of the image (2 and 8 periods): all 32 fine periods would be about 1 px each,
  // which turns into moiré or grey.
  const px = Math.round(32 * (window.devicePixelRatio || 1));
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  c.className = 'thumb';
  const src = id === 'streifen-grob' || id === 'streifen-fein' ? N / 4 : N;
  drawScaled(c.getContext('2d')!, patternPicture(id).canvas, 0, 0, src, px);
  return c;
}

function pickButton(content: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.append(content, label);
  b.addEventListener('click', onClick);
  return b;
}

const pickers = new Map<ImageId | 'eigenes', HTMLButtonElement>();
for (const id of [...PATTERNS, 'foto'] as ImageId[]) {
  pickers.set(
    id,
    pickButton(thumb(id), LABELS[id], () => {
      custom = null;
      if (state.values.img === id) void showImage();
      else state.set('img', id);
    }),
  );
}
const addIcon = document.createElement('span');
addIcon.className = 'thumb thumb--add';
addIcon.textContent = '+';
addIcon.setAttribute('aria-hidden', 'true');
const ownBtn = pickButton(addIcon, 'Eigenes Bild…', () => fileInput.click());
ownBtn.title = 'JPG oder PNG wählen (oder auf das Bild ziehen). Das Bild bleibt auf deinem Gerät.';
pickers.set('eigenes', ownBtn);
qs('#picker').append(...pickers.values(), fileInput);

function renderPicker(): void {
  const active = custom ? 'eigenes' : state.values.img;
  for (const [id, b] of pickers) b.setAttribute('aria-pressed', String(id === active));
}

const lecture = qs('#lecture');
// Page-wide, so a file dropped next to the image loads instead of navigating away
document.addEventListener('dragover', (ev) => {
  if (!ev.dataTransfer?.types.includes('Files')) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'copy';
  imgWrap.classList.add('dragover');
});
document.addEventListener('dragleave', (ev) => {
  if (!document.contains(ev.relatedTarget as Node | null)) imgWrap.classList.remove('dragover');
});
document.addEventListener('drop', (ev) => {
  imgWrap.classList.remove('dragover');
  const file = ev.dataTransfer?.files[0];
  if (!file) return;
  ev.preventDefault();
  void loadFile(file);
});

qs('#controls').append(
  select(state, {
    key: 'dir',
    label: 'Linie',
    options: [
      { value: 'zeile', label: 'Zeile' },
      { value: 'spalte', label: 'Spalte' },
    ],
  }),
  select(state, {
    key: 'log',
    label: 'Skala',
    options: [
      { value: false, label: 'linear' },
      { value: true, label: 'log' },
    ],
  }),
);
qs('#extra-controls').append(
  slider(state, {
    key: 'tp',
    label: 'Tiefpass: behält nur k ≤ Grenze',
    info: 'Ein Tiefpass behält nur die Frequenzen bis zur Grenze und entfernt die höheren. Der rote Verlauf verliert dadurch die feinen Zacken; ein ganzes so gefiltertes Bild würde unscharf. Ähnlich spart verlustbehaftete Kompression (z. B. JPEG) Speicher.',
    min: 1,
    max: K_MAX,
    step: 1,
    format: (v) => (v >= K_MAX ? 'aus' : `Grenze ${v}`),
  }),
  toggle(state, {
    key: 'hann',
    label: 'Hann-Fenster vor der FFT',
    info: 'Das Hann-Fenster blendet die Linie zu beiden Enden hin weich aus. Passt ein Muster nicht ganzzahlig oft in die Linie, verschmiert seine Energie sonst über viele k (Leck-Effekt); mit Fenster bleibt sie nah am Gipfel, dafür wird jeder Gipfel breiter. Der Tiefpass filtert weiter die Linie ohne Fenster.',
  }),
);

const reset = button({
  label: 'Zurücksetzen',
  title: 'Alle Einstellungen auf Standardwerte zurücksetzen',
  onClick: () => {
    custom = null;
    state.reset();
    void showImage();
  },
});
qs('#head-actions').append(fullscreenButton(lecture), reset);

// ---------------------------------------------------------------------------
// Caption, readout, rendering

const status = qs('#status');
const stMsg = qs('#st-msg');
const stLines = qs('#st-lines');
const stFlat = qs('#st-flat');
const stPeak = qs('#st-peak');
const stEnergy = qs('#st-energy');
const stTp = qs('#st-tp');
const stK = qs('#st-k');
const stN = qs('#st-n');
const stPer = qs('#st-per');
const stAcross = qs('#st-across');
const stKlow = qs('#st-klow');
const stShare = qs('#st-share');

/** Puts a persistent element (keeps its identity) into an infoTerm at its current place. */
function wrapTerm(el: HTMLElement, make: (el: HTMLElement) => HTMLElement): void {
  const holder = document.createElement('span');
  el.replaceWith(holder);
  holder.replaceWith(make(el));
}
// The readout structure is built once, so the tip buttons stay attached while the text changes.
wrapTerm(stPer, (el) =>
  infoTerm(
    el,
    'Eine Periode ist eine volle Wiederholung des Musters, z. B. ein Paar aus hellem und dunklem Streifen. Der Gipfel bei k heißt: k Perioden passen in die Bildbreite (Spalte: Bildhöhe), die Periodenlänge ist 512/k Pixel.',
    'Periode',
  ),
);
const energyTerm = qs('#st-energy-term');
energyTerm.textContent = 'Energie';
wrapTerm(energyTerm, (el) =>
  infoTerm(
    el,
    'Energie = Summe der quadrierten Amplituden. Der Wert gibt an, welcher Anteil davon in den tiefsten Frequenzen k = 1 bis 16 steckt (der Mittelwert bei k = 0 zählt nicht mit).',
  ),
);
// Ortsfrequenz tip in the spectrum caption: the text depends on the image and the direction
wrapTerm(qs('#ortsfreq-term'), (el) => infoTerm(el, ortsfrequenzInfo('foto', 'zeile'), 'Ortsfrequenz'));
const ortsButton = qs('#cap-spectrum .info-tip');
stKlow.textContent = String(K_LOW);

/** Rounded percentage that never claims 100 % or 0 % for a share that isn't exactly that. */
function pct(v: number): string {
  if (v > 1 - 1e-9) return '100 %';
  if (v >= 0.995) return '> 99 %';
  if (v < 1e-9) return '0 %';
  return v < 0.005 ? '< 1 %' : `${formatNumber(v * 100)} %`;
}

function renderStatus(): void {
  status.className = message?.bad ? 'status status--bad' : 'status';
  const showMsg = Boolean(message) || !picture;
  stMsg.hidden = !showMsg;
  stLines.hidden = showMsg;
  if (showMsg) {
    stMsg.textContent = message?.text ?? '';
    return;
  }
  stFlat.hidden = peak >= 0;
  stPeak.hidden = stEnergy.hidden = peak < 0;
  const { tp, hann } = state.values;
  // Without a window, "Tiefpass behält k ≤ 16" would repeat the energy line; with Hann the two differ.
  const showTp = peak >= 0 && tp < K_MAX && (tp !== K_LOW || hann);
  stTp.hidden = !showTp;
  if (peak < 0) return;
  stK.textContent = String(peak);
  stN.textContent = String(peak);
  stPer.textContent = peak === 1 ? 'Periode' : 'Perioden';
  stAcross.textContent = across();
  stShare.textContent = pct(lowEnergyShare(spec, K_LOW));
  if (showTp) stTp.textContent = `Tiefpass behält k ≤ ${tp}: ${pct(tpShare)} der Energie`;
}

function renderCaption(): void {
  const i = index();
  const where = dir() === 'zeile' ? `Zeile y = ${i}` : `Spalte x = ${i}`;
  const name = custom ? `Eigenes Bild (${custom.name})` : LABELS[state.values.img as ImageId];
  qs('#cap-image').textContent = `${name} · ${where}`;
  ortsButton.dataset.info = ortsfrequenzInfo(custom ? 'eigenes' : (state.values.img as ImageId), dir());
  imgWrap.dataset.dir = dir();
  imgCanvas.setAttribute('aria-orientation', dir() === 'zeile' ? 'vertical' : 'horizontal');
  imgCanvas.setAttribute('aria-valuemin', '0');
  imgCanvas.setAttribute('aria-valuemax', String(N - 1));
  imgCanvas.setAttribute('aria-valuenow', String(i));
  imgCanvas.setAttribute('aria-valuetext', `${where} (Pfeiltasten verschieben um 1 Pixel)`);
}

function renderAll(): void {
  renderPicker();
  renderCaption();
  renderLegends();
  renderStatus();
  updatePlotOptions();
  profilePlot.redraw();
  spectrumPlot.redraw();
  scheduleImage();
}

state.subscribe((_, changed) => {
  if (changed.includes('img')) {
    custom = null;
    void showImage();
    return;
  }
  if (picture) message = null; // an upload error disappears with the next change
  updateLine();
  renderAll();
});
void showImage();
