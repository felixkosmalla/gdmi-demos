// Demo "Schwingungen als Zeiger addieren" (d08, Folie 7): two or three
// rotating pointers attached tip to tail. Left: the phasor diagram with the
// sum pointer and a fading trail of its tip. Right: each pointer's own
// oscillation (its height, as if it started at the origin) and the height of
// the sum tip over the last seconds (now = left edge), at the same pixel
// scale, linked by a dashed connector. A demo clock drives play/pause, step
// and speed.
import '../../src/lib/page.css';
import { getAudioContext, audioSupported, masterGain, rampTo } from '../../src/lib/audio';
import {
  button,
  formatNumber,
  fullscreenButton,
  group,
  infoTerm,
  infoTip,
  qs,
  resetButton,
  select,
  slider,
  urlState,
} from '../../src/lib/controls';
import { createPlot, legendElement, niceStep, roles, type LegendItem } from '../../src/lib/plot';
import { active, beatPeriod, chain, commonPeriod, component, equalFrequencySum, sum, type Pointer } from './model';

// ---------------------------------------------------------------------------
// State & presets

const PRESETS = {
  gleich: {
    label: 'Gleiche Frequenz',
    values: { n: 2, a1: 1, f1: 0.5, p1: 0, a2: 0.8, f2: 0.5, p2: 60, a3: 0.5, f3: 0.5, p3: 150, win: 8 },
  },
  oberschwingung: {
    label: 'Oberschwingung',
    values: { n: 2, a1: 1, f1: 0.5, p1: 0, a2: 0.5, f2: 1, p2: 0, a3: 0.33, f3: 1.5, p3: 0, win: 8 },
  },
  schwebung: {
    label: 'Schwebung',
    values: { n: 2, a1: 1, f1: 1, p1: 0, a2: 1, f2: 1.1, p2: 0, a3: 0.5, f3: 1.2, p3: 0, win: 20 },
  },
};
type PresetName = keyof typeof PRESETS;
type Params = (typeof PRESETS)[PresetName]['values'];
const PARAM_KEYS = Object.keys(PRESETS.oberschwingung.values) as (keyof Params)[];
const isPreset = (s: string): s is PresetName => Object.hasOwn(PRESETS, s);

// `preset` = 'eigene' when no preset is active (at the start, or once a
// parameter was changed by hand); then the URL holds every value that differs
// from the defaults and no preset is applied on load.
// Start: a single pointer; the presets switch to two.
const state = urlState({
  preset: 'eigene',
  ...PRESETS.oberschwingung.values, // n, a1…a3, f1…f3 (Hz), p1…p3 (degrees), win (time window in s)
  n: 1,
  speed: 1, // animation speed (slow motion < 1)
});

// Explicit URL parameters override the preset. If one differs from it, the
// state becomes 'eigene' (otherwise a value equal to the default would be
// dropped from the URL and the preset's value would return on reload).
{
  const name = state.values.preset;
  if (isPreset(name)) {
    const preset: Params = PRESETS[name].values;
    const partial: Partial<Params> & { preset?: string } = {};
    for (const k of PARAM_KEYS) if (!state.fromUrl.has(k)) partial[k] = preset[k];
    if (PARAM_KEYS.some((k) => state.fromUrl.has(k) && state.values[k] !== preset[k])) partial.preset = 'eigene';
    state.update(partial);
  }
}

function pointers(): Pointer[] {
  const v = state.values;
  return [
    { a: v.a1, f: v.f1, p: v.p1 },
    { a: v.a2, f: v.f2, p: v.p2 },
    { a: v.a3, f: v.f3, p: v.p3 },
  ].slice(0, v.n);
}

const COLORS = [roles.series1, roles.series2, roles.series3];
const DASHES = [[], [9, 5], [3, 4]];
const SUM_COLOR = '--text';
/** Duration of the fading trail of the sum tip (demo seconds). */
const TRAIL = 2;
/** Step size of the step buttons (demo seconds). */
const STEP = 0.05;

/** Half height of the visible value range, shared by both panels. */
let yMax = 1;

// ---------------------------------------------------------------------------
// Demo clock

let t = 0;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastFrame = 0;
let frame = 0;

function tick(now: number): void {
  frame = 0;
  if (playing) {
    // clamp dt so a background tab doesn't jump ahead
    if (lastFrame) t += Math.min(0.1, (now - lastFrame) / 1000) * state.values.speed;
    lastFrame = now;
    frame = requestAnimationFrame(tick);
  }
  drawAll();
}

function requestDraw(): void {
  if (!frame) frame = requestAnimationFrame(tick);
}

function setPlaying(on: boolean): void {
  playing = on;
  lastFrame = 0;
  renderPlay();
  requestDraw();
}

function step(dir: number): void {
  if (playing) setPlaying(false);
  t += dir * STEP;
  requestDraw();
}

// ---------------------------------------------------------------------------
// Time plot (right): x = time before now, so the curve leaves the phasor panel

const timePlot = createPlot(qs('#plot-time'), {
  xRange: [0, 8],
  yRange: [-1.7, 1.7],
  xLabel: 'vergangene Zeit in s (0 = jetzt)',
  yLabel: 'x(t)',
  ariaLabel: 'Zeitverlauf der einzelnen Schwingungen und ihrer Summe',
  draw(p) {
    const ptrs = pointers();
    if (ptrs.length === 1) {
      p.fn((tau) => component(ptrs[0], t - tau), { color: COLORS[0], width: 4 });
      return;
    }
    ptrs.forEach((ptr, i) => {
      p.fn((tau) => component(ptr, t - tau), { color: COLORS[i], width: 2, alpha: 0.6, dash: DASHES[i] });
    });
    p.fn((tau) => sum(ptrs, t - tau), { color: SUM_COLOR, width: 4 });
  },
});

/** Current value: dot at "now" and the connector from the phasor panel (outside the clip area). */
function drawNowMarker(ptrs: Pointer[], linked: boolean): void {
  const ctx = timePlot.ctx;
  const x = timePlot.xToPx(0);
  const y = timePlot.yToPx(sum(ptrs, t));
  const c = timePlot.color(SUM_COLOR);
  ctx.save();
  if (linked) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Phasor panel (left): own canvas, same pixel scale and zero line as the time plot

const plotsEl = qs('#plots');
const phasorBox = qs('#plot-phasor');
const phasorCanvas = document.createElement('canvas');
phasorCanvas.setAttribute('role', 'img');
phasorCanvas.setAttribute('aria-label', 'Zeigerdiagramm: aneinandergehängte drehende Zeiger und ihr Summenzeiger');
phasorBox.append(phasorCanvas);
const pctx = phasorCanvas.getContext('2d') as CanvasRenderingContext2D;
let pw = 0;
let ph = 0;
let pdpr = 1;

function sizePhasorCanvas(): void {
  const r = phasorBox.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width));
  const h = Math.max(1, Math.floor(r.height));
  const d = window.devicePixelRatio || 1;
  if (w !== pw || h !== ph || d !== pdpr) {
    pw = w;
    ph = h;
    pdpr = d;
    phasorCanvas.width = Math.round(w * d);
    phasorCanvas.height = Math.round(h * d);
    phasorCanvas.style.width = `${w}px`;
    phasorCanvas.style.height = `${h}px`;
  }
  pctx.setTransform(d, 0, 0, d, 0, 0);
}

/** Line from a to b with an arrow head at b (CSS px). */
function arrow(a: [number, number], b: [number, number], color: string, width: number): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const head = Math.min(width * 4 + 4, len * 0.45);
  const ux = dx / len;
  const uy = dy / len;
  const bx = b[0] - ux * head * 0.8; // shaft ends inside the head
  const by = b[1] - uy * head * 0.8;
  pctx.strokeStyle = color;
  pctx.fillStyle = color;
  pctx.lineWidth = width;
  pctx.lineCap = 'round';
  pctx.beginPath();
  pctx.moveTo(a[0], a[1]);
  pctx.lineTo(bx, by);
  pctx.stroke();
  pctx.beginPath();
  pctx.moveTo(b[0], b[1]);
  pctx.lineTo(b[0] - ux * head - uy * head * 0.45, b[1] - uy * head + ux * head * 0.45);
  pctx.lineTo(b[0] - ux * head + uy * head * 0.45, b[1] - uy * head - ux * head * 0.45);
  pctx.closePath();
  pctx.fill();
}

/** Side-by-side layout: the phasor panel sits left of the time plot and shares its y scale. */
function isLinked(): boolean {
  return timePlot.canvas.getBoundingClientRect().left >= phasorBox.getBoundingClientRect().right - 1;
}

/**
 * Sets the time plot's y range to ±yMax, or wider if the phasor panel is too
 * narrow for that scale (e.g. tablets in portrait). Both panels keep the same
 * pixel scale, so the connector stays straight; the time plot just gets more
 * headroom. Returns true if the range changed.
 */
function fitTimeRange(linked: boolean): boolean {
  let y = yMax;
  if (linked) {
    const w = phasorBox.clientWidth - timePlot.fontSize; // room for the grid labels
    const h = timePlot.area.height;
    if (w > 0 && h > w) y = (yMax * h) / w;
  }
  if (Math.abs(timePlot.options.yRange[1] - y) < 1e-9) return false;
  timePlot.setOptions({ yRange: [-y, y] });
  return true;
}

/** Draws the phasor diagram; with `linked`, at the time plot's scale and zero line (connector drawn). */
function drawPhasor(ptrs: Pointer[], linked: boolean): void {
  sizePhasorCanvas();
  const col = (c: string): string => timePlot.color(c);
  const fs = timePlot.fontSize;

  // scale and origin: in the side-by-side layout identical to the time plot's y axis
  let s: number;
  let cy: number;
  if (linked) {
    s = timePlot.yToPx(0) - timePlot.yToPx(1);
    cy = timePlot.canvas.getBoundingClientRect().top - phasorCanvas.getBoundingClientRect().top + timePlot.yToPx(0);
  } else {
    s = (Math.min(pw, ph) - fs) / (2 * yMax);
    cy = ph / 2;
  }
  const cx = pw / 2;
  const P = (x: number, y: number): [number, number] => [cx + x * s, cy - y * s];

  pctx.clearRect(0, 0, pw, ph);
  pctx.fillStyle = col('--plot-bg');
  pctx.fillRect(0, 0, pw, ph);
  pctx.globalAlpha = 1;
  pctx.setLineDash([]);

  // grid: circles at "nice" radii, axes through the origin
  const stepR = niceStep(yMax, 4);
  pctx.strokeStyle = col('--plot-grid');
  pctx.lineWidth = 1;
  for (let r = stepR; r <= yMax + 1e-9; r += stepR) {
    pctx.beginPath();
    pctx.arc(cx, cy, r * s, 0, 2 * Math.PI);
    pctx.stroke();
  }
  pctx.strokeStyle = col('--plot-axis');
  pctx.lineWidth = 1.5;
  pctx.beginPath();
  pctx.moveTo(0, Math.round(cy) + 0.5);
  pctx.lineTo(pw, Math.round(cy) + 0.5);
  pctx.moveTo(Math.round(cx) + 0.5, cy - yMax * s);
  pctx.lineTo(Math.round(cx) + 0.5, cy + yMax * s);
  pctx.stroke();
  pctx.font = `${fs * 0.85}px ${getComputedStyle(phasorBox).fontFamily}`;
  pctx.fillStyle = col('--text-muted');
  pctx.textAlign = 'left';
  pctx.textBaseline = 'top';
  const dec = stepR < 1 ? 1 : 0;
  for (let r = stepR; r <= yMax + 1e-9; r += stepR) pctx.fillText(formatNumber(r, dec), cx + r * s + 3, cy + 3);
  pctx.textBaseline = 'middle';
  pctx.fillText('Im', cx + 6, cy - yMax * s + fs * 0.4);

  const pts = chain(ptrs, t).map(([x, y]) => P(x, y));
  const tip = pts[pts.length - 1];

  // path circle of every pointer around its pivot
  pctx.lineWidth = 1.5;
  ptrs.forEach((ptr, i) => {
    pctx.strokeStyle = col(COLORS[i]);
    pctx.globalAlpha = 0.35;
    pctx.beginPath();
    pctx.arc(pts[i][0], pts[i][1], ptr.a * s, 0, 2 * Math.PI);
    pctx.stroke();
  });

  // equal frequencies with two pointers: the (rigid) parallelogram
  if (ptrs.length === 2 && equalFrequencySum(ptrs)) {
    const o = pts[0];
    const p2: [number, number] = [o[0] + pts[2][0] - pts[1][0], o[1] + pts[2][1] - pts[1][1]];
    pctx.globalAlpha = 0.55;
    pctx.lineWidth = 2;
    pctx.setLineDash([6, 5]);
    pctx.strokeStyle = col(COLORS[1]);
    pctx.beginPath();
    pctx.moveTo(o[0], o[1]);
    pctx.lineTo(p2[0], p2[1]);
    pctx.stroke();
    pctx.strokeStyle = col(COLORS[0]);
    pctx.beginPath();
    pctx.moveTo(p2[0], p2[1]);
    pctx.lineTo(tip[0], tip[1]);
    pctx.stroke();
    pctx.setLineDash([]);
  }

  // fading trail of the sum tip
  const sumColor = col(SUM_COLOR);
  const N = Math.ceil(TRAIL * Math.max(...ptrs.map((ptr) => ptr.f)) * 90); // ≥ 90 segments per turn
  pctx.strokeStyle = sumColor;
  pctx.lineWidth = 2.5;
  pctx.lineCap = 'round';
  let prev = P(...chain(ptrs, t - TRAIL)[ptrs.length]);
  for (let i = 1; i <= N; i++) {
    const cur = P(...chain(ptrs, t - TRAIL * (1 - i / N))[ptrs.length]);
    pctx.globalAlpha = 0.6 * (i / N);
    pctx.beginPath();
    pctx.moveTo(prev[0], prev[1]);
    pctx.lineTo(cur[0], cur[1]);
    pctx.stroke();
    prev = cur;
  }
  pctx.globalAlpha = 1;

  // connector to the time plot (continues on the time canvas)
  if (linked) {
    pctx.strokeStyle = sumColor;
    pctx.lineWidth = 2;
    pctx.setLineDash([6, 5]);
    pctx.beginPath();
    pctx.moveTo(tip[0], tip[1]);
    pctx.lineTo(pw, tip[1]);
    pctx.stroke();
    pctx.setLineDash([]);
  }

  // sum pointer underneath (thicker), the chain on top
  if (ptrs.length > 1) arrow(pts[0], tip, sumColor, 6);
  ptrs.forEach((_, i) => arrow(pts[i], pts[i + 1], col(COLORS[i]), 3.5));
  pctx.fillStyle = sumColor;
  pctx.beginPath();
  pctx.arc(tip[0], tip[1], 5, 0, 2 * Math.PI);
  pctx.fill();
}

/** Phasor panel about as wide as it is high (side-by-side layout only; phones stack via page.css). */
function fitColumns(): void {
  const w = Math.min(Math.round(phasorBox.clientHeight * 1.05), Math.round(plotsEl.clientWidth * 0.45));
  plotsEl.style.gridTemplateColumns = `minmax(0, ${w}px) minmax(0, 1fr)`;
}

const ro = new ResizeObserver(() => {
  fitColumns();
  requestDraw();
});
ro.observe(plotsEl);
ro.observe(phasorBox);

// A new devicePixelRatio (window moved to a projector) resizes no element, and
// the time plot's own redraw would drop the "now" dot: redraw everything.
let dprQuery: MediaQueryList | undefined;
function watchDpr(): void {
  dprQuery?.removeEventListener('change', onDprChange);
  dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  dprQuery.addEventListener('change', onDprChange);
}
function onDprChange(): void {
  watchDpr();
  requestDraw();
}
watchDpr();

// ---------------------------------------------------------------------------
// Controls

const tReadout = document.createElement('output');
tReadout.className = 't-readout';
let tText = '';

function drawAll(): void {
  const ptrs = pointers();
  const linked = isLinked();
  timePlot.drawNow();
  if (fitTimeRange(linked)) timePlot.drawNow(); // needs the plot area of the current size
  drawPhasor(ptrs, linked);
  drawNowMarker(ptrs, linked);
  const text = `t = ${formatNumber(t, 2)} s`;
  if (text !== tText) tReadout.textContent = tText = text;
}

const playBtn = button({ label: '', variant: 'primary', onClick: () => setPlaying(!playing) });
function renderPlay(): void {
  playBtn.textContent = playing ? '⏸ Pause' : '▶ Abspielen';
  playBtn.setAttribute('aria-pressed', String(playing));
}

const presetNames = Object.keys(PRESETS) as PresetName[];
const presetButtons = presetNames.map((name) =>
  button({
    label: PRESETS[name].label,
    onClick: () => {
      state.update({ preset: name, ...PRESETS[name].values });
      t = 0;
      requestDraw();
    },
  }),
);

const PRESET_TIPS: Partial<Record<PresetName, string>> = {
  oberschwingung:
    'Oberschwingung: Schwingung mit einem ganzzahligen Vielfachen (2·, 3·, …) der Grundfrequenz. Im Beispiel: f₁ = 0,5 Hz, f₂ = 1 Hz = 2·f₁, Zeiger 2 dreht doppelt so schnell.',
  schwebung:
    'Schwebung: Zwei Schwingungen mit fast gleicher Frequenz (hier 1 Hz und 1,1 Hz). Der Ausschlag der Summe schwillt mit |f₁ − f₂| = 0,1 Hz an und ab, also alle 10 s.',
};
const AMP_TIP = 'Amplitude A: Länge des Zeigers, also der größte Ausschlag der Schwingung.';
const FREQ_TIP = 'Frequenz f: Umdrehungen des Zeigers pro Sekunde (in Hz). Die Periode ist T = 1/f.';
const PHASE_TIP =
  'Phase φ: Startwinkel des Zeigers bei t = 0. Ein größeres φ lässt die Schwingung früher ablaufen; im Zeitverlauf hier (rechts = früher) rückt die Kurve dadurch nach rechts.';

qs('#controls').append(
  group(
    'Beispiel',
    ...presetNames.flatMap((name, i) => {
      const tip = PRESET_TIPS[name];
      return tip ? [presetButtons[i], infoTip(PRESETS[name].label, tip)] : [presetButtons[i]];
    }),
  ),
  group(
    'Animation',
    playBtn,
    button({ label: '◀', title: `${formatNumber(STEP, 2)} s zurück`, onClick: () => step(-1) }),
    button({ label: '▶', title: `${formatNumber(STEP, 2)} s vor`, onClick: () => step(1) }),
    tReadout,
  ),
  slider(state, { key: 'speed', label: 'Tempo', min: 0.1, max: 2, step: 0.05, format: (v) => `${formatNumber(v, 2)} ×` }),
  select(state, {
    key: 'n',
    label: 'Zeiger',
    options: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
    ],
  }),
);

const KEYS = [
  ['a1', 'f1', 'p1'],
  ['a2', 'f2', 'p2'],
  ['a3', 'f3', 'p3'],
] as const;
const pointerRows = KEYS.map(([a, f, p], i) => {
  const row = document.createElement('div');
  row.className = 'pointer-row';
  const name = document.createElement('span');
  name.className = 'pointer-name';
  const sw = document.createElement('span');
  sw.className = 'swatch';
  sw.style.background = `var(${COLORS[i]})`;
  name.append(sw, `Zeiger ${i + 1}`);
  row.append(
    name,
    slider(state, { key: a, label: 'Amplitude', symbol: `A_${i + 1}`, min: 0, max: 1.5, step: 0.01, info: i === 0 ? AMP_TIP : undefined }),
    slider(state, { key: f, label: 'Frequenz', symbol: `f_${i + 1}`, min: 0.05, max: 2, step: 0.05, unit: 'Hz', info: i === 0 ? FREQ_TIP : undefined }),
    slider(state, {
      key: p,
      label: 'Phase',
      info: i === 0 ? PHASE_TIP : undefined,
      symbol: `φ_${i + 1}`,
      min: -180,
      max: 180,
      step: 5,
      format: (v) => `${formatNumber(v)}°`,
    }),
  );
  return row;
});
qs('#pointers').append(...pointerRows);

qs('#extra-controls').append(slider(state, { key: 'win', label: 'Zeitfenster', min: 2, max: 30, step: 1, unit: 's' }));
qs('#head-actions').append(fullscreenButton(qs('#lecture')), resetButton(state));

// Space toggles play/pause (unless a control has the focus).
addEventListener('keydown', (ev) => {
  if (ev.key !== ' ' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if ((ev.target as Element).closest?.('button, input, select, textarea, a, summary')) return;
  ev.preventDefault();
  setPlaying(!playing);
});

// ---------------------------------------------------------------------------
// "Schwebung hören": 440 Hz + 444 Hz

const audioBtn = button({ label: '', onClick: () => void toggleBeat() });
const audioNote = document.createElement('p');
audioNote.className = 'status';
audioNote.setAttribute('aria-live', 'polite');
qs('#audio-controls').append(audioBtn, audioNote);

let beat: { ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[] } | null = null;
let beatToken = 0;

async function toggleBeat(): Promise<void> {
  const token = ++beatToken;
  if (beat) {
    const { ctx, gain, oscs } = beat;
    beat = null;
    rampTo(gain.gain, 0, ctx, 0.05);
    for (const o of oscs) o.stop(ctx.currentTime + 0.06);
    renderAudio();
    return;
  }
  try {
    const ctx = await getAudioContext();
    if (token !== beatToken) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(masterGain(ctx));
    const oscs = [440, 444].map((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    });
    rampTo(gain.gain, 0.15, ctx, 0.05);
    beat = { ctx, gain, oscs };
    audioNote.textContent = '';
  } catch (err) {
    audioNote.textContent = `Kein Ton: ${err instanceof Error ? err.message : String(err)}`;
  }
  renderAudio();
}

function renderAudio(): void {
  audioBtn.textContent = beat ? '■ Stopp' : '▶ 440 Hz + 444 Hz anhören';
  audioBtn.setAttribute('aria-pressed', String(beat !== null));
}
if (!audioSupported()) {
  audioBtn.disabled = true;
  audioNote.textContent = 'Dieser Browser unterstützt keine Tonausgabe (Web Audio).';
}
addEventListener('pagehide', () => {
  if (beat) void toggleBeat();
});
renderAudio();

// ---------------------------------------------------------------------------
// Status line, legend, live formula

const status = qs('#status');
const capTime = qs('#cap-time');
const formula = qs('#formula');
const formulaNote = qs('#formula-note');

const hz = (f: number): string => `${formatNumber(f, 2).replace(/,?0+$/, '')} Hz`;
const num = (v: number): string => formatNumber(v, 2);
const SUB = ['₁', '₂', '₃'];
const sine = (ptr: Pointer): string => `A = ${num(ptr.a)}, f = ${hz(ptr.f)}, φ = ${formatNumber(ptr.p)}°`;

function renderStatus(ptrs: Pointer[]): void {
  const eq = equalFrequencySum(ptrs);
  const act = active(ptrs);
  let text: string;
  if (act.length === 0) {
    text = ptrs.length === 1 ? 'A = 0: Der Zeiger hat die Länge 0, es gibt keine Schwingung.' : 'Alle Amplituden sind 0: Die Summe ist 0.';
  } else if (ptrs.length === 1) {
    text = `Ein Zeiger: Sinus mit ${sine(ptrs[0])} (Periode ${formatNumber(1 / ptrs[0].f, 2)} s).`;
  } else if (act.length === 1) {
    // pointers of length 0 add nothing, whatever their frequency
    const zeros = ptrs.flatMap((ptr, i) => (ptr.a > 0 ? [] : [`A${SUB[i]}`])).join(' = ');
    text = `Nur Zeiger ${ptrs.indexOf(act[0]) + 1} trägt bei (${zeros} = 0): Die Summe ist sein Sinus mit ${sine(act[0])}.`;
  } else if (eq && eq.a < 0.005) {
    text = 'Gleiche Frequenz, die Zeiger heben sich auf: Die Summe ist 0.';
  } else if (eq) {
    text = `Gleiche Frequenz (${hz(act[0].f)}): Die Summe ist wieder ein Sinus mit A = ${num(eq.a)} und φ = ${formatNumber(eq.p)}°.`;
  } else {
    const ts = beatPeriod(ptrs);
    const T = commonPeriod(ptrs);
    if (ts) {
      text = `Schwebung: Die Hüllkurve wiederholt sich alle 1/|${hz(act[0].f)} − ${hz(act[1].f)}| = ${formatNumber(ts, 1)} s.`;
    } else if (T) {
      text = `Verschiedene Frequenzen: kein Sinus, aber periodisch mit T = 1/ggT der Frequenzen = ${formatNumber(T, Math.abs(T - Math.round(T)) < 1e-6 ? 0 : 2)} s.`;
    } else {
      text = 'Verschiedene Frequenzen ohne gemeinsames Vielfaches: Die Summe ist nicht periodisch.';
    }
  }
  status.textContent = text;
}

// caption of the time plot: "Zeitverlauf (?)" + what is plotted (depends on n) + legend
const TIME_AXIS_TIP =
  'Ganz links (0) ist jetzt, rechts liegt die Vergangenheit; gegenüber der üblichen t-Achse erscheinen die Kurven daher gespiegelt.';
const capTerm = infoTerm('Zeitverlauf', '');
const capTip = capTerm.querySelector('button') as HTMLButtonElement;
const capWhat = document.createTextNode('');
const capTitle = document.createElement('span');
capTitle.append(capTerm, capWhat);
capTime.replaceChildren(capTitle);

function renderLegend(ptrs: Pointer[]): void {
  const one = ptrs.length === 1;
  capWhat.data = one ? ' (Höhe der Zeigerspitze)' : ' (Höhe jedes Zeigers und der Summe)';
  capTip.dataset.info = one
    ? `Die Höhe der Zeigerspitze, A·sin(2πft + φ). ${TIME_AXIS_TIP}`
    : `Dünn: jeder Zeiger für sich, A·sin(2πft + φ), als hinge er am Ursprung; dick: die Höhe der Summenspitze. ${TIME_AXIS_TIP}`;
  const items: LegendItem[] = one
    ? [{ label: 'Zeiger 1', color: COLORS[0], width: 4 }]
    : [
        ...ptrs.map((_, i) => ({ label: `Zeiger ${i + 1}`, color: COLORS[i], dash: DASHES[i], width: 2 })),
        { label: 'Summe', color: SUM_COLOR, width: 4 },
      ];
  capTime.querySelector('.legend-inline')?.remove();
  capTime.append(legendElement(items));
}

function renderFormula(ptrs: Pointer[]): void {
  const { a1, a2, p1, p2, f1, f2, n } = state.values;
  const a = Math.sqrt(Math.max(0, a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos((p1 - p2) * (Math.PI / 180))));
  // φ₁ − φ₂ with a real minus sign; a negative φ₂ becomes "+ |φ₂|"
  const d1 = formatNumber(p1).replace('-', '−');
  const d2 = formatNumber(p2);
  const diff = d2.startsWith('-') ? `${d1}° + ${d2.slice(1)}°` : `${d1}° − ${d2}°`;
  formula.textContent = `A = √(${num(a1)}² + ${num(a2)}² + 2 · ${num(a1)} · ${num(a2)} · cos(${diff})) = ${num(a)}`;
  let note: string;
  if (n === 1) {
    note = 'Die Formel braucht zwei Zeiger. Für die Summe „Zeiger: 2“ wählen.';
  } else if (a1 === 0 || a2 === 0) {
    note =
      a1 === a2
        ? 'A₁ = A₂ = 0: Die Formel ergibt A = 0.'
        : `A${a1 === 0 ? '₁' : '₂'} = 0: Die Formel ergibt A = A${a1 === 0 ? '₂' : '₁'}, bei jeder Frequenz (ein Zeiger der Länge 0 ändert nichts).`;
  } else if (f1 !== f2) {
    note = 'Achtung: Die Formel gilt nur für f₁ = f₂. Bei verschiedenen Frequenzen ändert der Summenzeiger ständig seine Länge.';
  } else if (n === 2) {
    note = 'f₁ = f₂: Das ist die Amplitude der Summe (Länge des Summenzeigers).';
  } else if (equalFrequencySum(ptrs)) {
    note = 'Die Formel berücksichtigt nur Zeiger 1 und 2. Die Statuszeile oben zeigt die Amplitude aller drei Zeiger.';
  } else {
    note = 'Die Formel berücksichtigt nur Zeiger 1 und 2. Zeiger 3 hat eine andere Frequenz, die Summe aller drei ist daher kein Sinus.';
  }
  formulaNote.textContent = note;
}

let legendN = 0;
function render(): void {
  const ptrs = pointers();
  const { n, win } = state.values;
  yMax = Math.max(0.5, active(ptrs).reduce((s, ptr) => s + ptr.a, 0)) * 1.12;
  timePlot.setOptions({ xRange: [0, win] }); // y range: fitTimeRange() in drawAll()
  pointerRows[1].hidden = n < 2;
  pointerRows[2].hidden = n < 3;
  if (n !== legendN) {
    renderLegend(ptrs);
    legendN = n;
  }
  presetButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(Object.keys(PRESETS)[i] === state.values.preset)));
  renderStatus(ptrs);
  renderFormula(ptrs);
  requestDraw();
}

state.subscribe((v, changed) => {
  // a parameter changed by hand: no preset any more (see the comment at `state`)
  if (!changed.includes('preset') && v.preset !== 'eigene' && changed.some((k) => (PARAM_KEYS as string[]).includes(k))) {
    state.set('preset', 'eigene');
    return;
  }
  if (changed.includes('preset') && v.preset !== 'eigene') t = 0; // preset chosen or reset
  render();
});
renderPlay();
render();
