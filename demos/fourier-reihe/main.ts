// Demo "Fourier-Reihe: Annäherung & Spektrum" (d09, Folie 9): a periodic
// signal (preset or drawn by hand) and its approximation with N harmonics,
// updated live while N changes, plus the magnitude spectrum aₙ (bars beyond N
// greyed out) and/or the phase spectrum θₙ. Dragging on the signal plot draws
// one period; presets and drawings share the same sampled-period pipeline.
import '../../src/lib/page.css';
import { fourierSynthesize, type FourierCoefficients } from '../../src/lib/dsp';
import {
  button,
  formatNumber,
  fullscreenButton,
  ideaCredit,
  qs,
  resetButton,
  select,
  slider,
  urlState,
} from '../../src/lib/controls';
import { createPlot, legendElement, roles } from '../../src/lib/plot';
import { M, N_MAX, coefficients, maxValue, paintSegment, presetPeriod, type Preset } from './model';

const state = urlState({
  sig: 'rechteck', // rechteck | dreieck | saegezahn | sinus | zeichnen
  n: 5, // number of harmonics N
  view: 'betrag', // betrag | phase | beide
});

const SIGNALS = [
  { value: 'rechteck', label: 'Rechteck' },
  { value: 'dreieck', label: 'Dreieck' },
  { value: 'saegezahn', label: 'Sägezahn' },
  { value: 'sinus', label: 'Sinus' },
  { value: 'zeichnen', label: 'Zeichnen' },
];
/** Visible value range ±Y of the signal plot; drawings are clamped to it. */
const Y = 1.5;
/** Periods shown in the signal plot. */
const PERIODS = 2;
const BAR_WIDTH = 0.7;

// ---------------------------------------------------------------------------
// Signal data: one sampled period, its coefficients and the line of the original

/** The hand-drawn period. Starting point of a new stroke: a preset is copied here when you draw on it (that overwrites the previous drawing). */
const drawing = new Float64Array(M);
const presetCache = new Map<Preset, Float64Array>();

function currentPeriod(): Float64Array {
  const sig = state.values.sig;
  if (sig === 'zeichnen') return drawing;
  const name = sig as Preset;
  let p = presetCache.get(name);
  if (!p) presetCache.set(name, (p = presetPeriod(name)));
  return p;
}

let coeffs: FourierCoefficients = coefficients(currentPeriod());
const origXs = new Float64Array(PERIODS * M + 1).map((_, k) => k / M);
const origYs = new Float64Array(PERIODS * M + 1);
let origMax = 0;

function updateSignal(): void {
  const p = currentPeriod();
  coeffs = coefficients(p);
  for (let k = 0; k < origYs.length; k++) origYs[k] = p[k % M];
  origMax = p.reduce((m, v) => Math.max(m, v), -Infinity);
}

// ---------------------------------------------------------------------------
// Plots

const tLabels: Record<string, string> = { '0': '0', '0.5': 'T/2', '1': 'T', '1.5': '3T/2', '2': '2T' };

const signalPlot = createPlot(qs('#plot-signal'), {
  xRange: [0, PERIODS],
  yRange: [-Y, Y],
  xTicks: [0, 0.5, 1, 1.5, 2],
  xTickFormat: (t) => tLabels[String(t)] ?? formatNumber(t, 1),
  yTicks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
  xLabel: 'Zeit t (T = Periodendauer = 1/f₀)',
  yLabel: 'x(t)',
  ariaLabel: 'Zwei Perioden des Signals und seine Annäherung durch eine Fourier-Reihe. Zum Zeichnen ziehen.',
  draw(p) {
    p.vline(1, { color: roles.copy, width: 1.5, dash: [2, 4] }); // period boundary
    const n = state.values.n;
    p.fn((t) => fourierSynthesize(coeffs, n, t), { color: roles.reconstruction, width: 3.5 });
    p.line(origXs, origYs, { color: roles.original, width: 2.5, dash: [8, 5] });
  },
});

/** Harmonic numbers with aₙ > 0, split into "in the approximation" (n ≤ N) and the rest. */
function splitHarmonics(): { used: number[]; missing: number[] } {
  const used: number[] = [];
  const missing: number[] = [];
  for (let k = 0; k <= N_MAX; k++) if (coeffs.amp[k] > 0) (k <= state.values.n ? used : missing).push(k);
  return { used, missing };
}

const magPlot = createPlot(qs('#plot-mag'), {
  xRange: [-0.8, N_MAX + 0.8],
  yRange: [0, 1.5],
  xLabel: 'Harmonische n (Frequenz n · f₀)',
  yLabel: 'aₙ',
  ariaLabel: 'Betragsspektrum: Amplituden a_n der Harmonischen',
  draw(p) {
    const { used, missing } = splitHarmonics();
    const amp = (ks: number[]): number[] => ks.map((k) => coeffs.amp[k]);
    p.bars(missing, amp(missing), { color: roles.copy, alpha: 0.55, barWidth: BAR_WIDTH });
    p.bars(used, amp(used), { color: roles.reconstruction, barWidth: BAR_WIDTH });
    const n = state.values.n;
    p.vline(n + 0.5, { color: roles.marker, width: 2, dash: [8, 5] }, `N = ${n}`);
  },
});

// Short phase plot (both spectra at 1280×720): label only 0°, 180°, 360° (grid stays at 90°).
let phaseArea: { height: number } = { height: Infinity };
const phasePlot = createPlot(qs('#plot-phase'), {
  xRange: [-0.8, N_MAX + 0.8],
  yRange: [0, 380],
  yTicks: [0, 90, 180, 270, 360],
  yTickFormat: (v) => (v % 180 !== 0 && phaseArea.height < 100 ? '' : `${v}°`),
  xLabel: 'Harmonische n',
  yLabel: 'θₙ',
  ariaLabel: 'Phasenspektrum: Phasen θ_n der Harmonischen in Grad',
  draw(p) {
    const { used, missing } = splitHarmonics();
    const phase = (ks: number[]): number[] => ks.map((k) => (coeffs.phase[k] * 180) / Math.PI);
    p.stems(missing, phase(missing), { color: roles.copy, alpha: 0.55, width: 2, radius: 3.5 });
    p.stems(used, phase(used), { color: roles.reconstruction, width: 3, radius: 4.5 });
    p.vline(state.values.n + 0.5, { color: roles.marker, width: 2, dash: [8, 5] });
  },
});

phaseArea = phasePlot.area;

qs('#cap-signal').append(
  legendElement([
    { label: 'Original x(t)', color: roles.original, dash: [5, 3] },
    { label: 'Annäherung mit N Harmonischen', color: roles.reconstruction, width: 3.5 },
  ]),
);
const specLegend = (): HTMLElement =>
  legendElement([
    { label: 'n ≤ N: in der Annäherung', color: roles.reconstruction, kind: 'bar' },
    { label: 'n > N: fehlt', color: roles.copy, kind: 'bar' },
  ]);
qs('#cap-mag').append(specLegend());
qs('#cap-phase').append(specLegend());

// ---------------------------------------------------------------------------
// Drawing on the signal plot (any mode; a preset becomes the starting curve)

const canvas = signalPlot.canvas;
let last: [number, number] | null = null;

function pointerData(ev: PointerEvent): [number, number] {
  const [t, y] = signalPlot.eventToData(ev);
  return [Math.min(PERIODS, Math.max(0, t)), y];
}

function paint(a: [number, number], b: [number, number]): void {
  paintSegment(drawing, a[0], a[1], b[0], b[1], -Y, Y);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  ev.preventDefault();
  canvas.setPointerCapture(ev.pointerId);
  stopAnimation();
  if (state.values.sig !== 'zeichnen') {
    drawing.set(currentPeriod());
    state.set('sig', 'zeichnen');
  }
  last = pointerData(ev);
  paint(last, last);
  signalChanged();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!last || !canvas.hasPointerCapture(ev.pointerId)) return;
  for (const e of ev.getCoalescedEvents?.() ?? [ev]) {
    const cur = pointerData(e);
    paint(last, cur);
    last = cur;
  }
  signalChanged();
});
const endStroke = (): void => {
  last = null;
};
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('lostpointercapture', endStroke);

// ---------------------------------------------------------------------------
// Animation: N = 1, 2, … 50 (slow at first, where every step changes a lot)

let animTimer = 0;
let animStepping = false;
const animBtn = button({ label: '', variant: 'primary', onClick: () => (animTimer ? stopAnimation() : startAnimation()) });

function setN(n: number): void {
  animStepping = true;
  state.set('n', n);
  animStepping = false;
}

function startAnimation(): void {
  setN(1);
  scheduleStep();
  renderAnimation();
}

function scheduleStep(): void {
  const n = state.values.n;
  animTimer = window.setTimeout(
    () => {
      if (state.values.n >= N_MAX) return stopAnimation();
      setN(state.values.n + 1);
      if (state.values.n >= N_MAX) stopAnimation();
      else scheduleStep();
    },
    n < 10 ? 700 : n < 20 ? 350 : 150,
  );
}

function stopAnimation(): void {
  clearTimeout(animTimer);
  animTimer = 0;
  renderAnimation();
}

function renderAnimation(): void {
  animBtn.textContent = animTimer ? '⏸ Animation anhalten' : `▶ Animation N = 1 … ${N_MAX}`;
  animBtn.setAttribute('aria-pressed', String(animTimer !== 0));
}

// ---------------------------------------------------------------------------
// Controls

const clearBtn = button({
  label: 'Löschen',
  title: 'Zeichnung auf 0 zurücksetzen',
  onClick: () => {
    drawing.fill(0);
    signalChanged();
  },
});

qs('#controls').append(
  select(state, { key: 'sig', label: 'Signal', options: SIGNALS }),
  clearBtn,
  slider(state, { key: 'n', label: 'Anzahl Harmonische', symbol: 'N', min: 0, max: N_MAX, step: 1 }),
  animBtn,
  select(state, {
    key: 'view',
    label: 'Spektrum',
    options: [
      { value: 'betrag', label: 'Betrag' },
      { value: 'phase', label: 'Phase' },
      { value: 'beide', label: 'Beide' },
    ],
  }),
);
clearBtn.style.alignSelf = 'flex-start';
qs('#head-actions').append(fullscreenButton(qs('#lecture')), resetButton(state));
qs('#lecture').append(ideaCredit('fourier-reihe'));

// ---------------------------------------------------------------------------
// Readout, coefficient table, rendering

const status = qs('#status');
const tableCaption = qs('#table-caption');
const rows = qs('#coeff-rows');

const num = (v: number): string => formatNumber(v, 2);

function renderStatus(): void {
  const { n, sig } = state.values;
  const head =
    n === 0
      ? 'N = 0 → nur der Gleichanteil a₀'
      : `N = ${n} → höchste Frequenz ${n}·f₀${n === 1 ? ' (nur die Grundschwingung)' : ''}`;
  const peak = maxValue(coeffs, n);
  const lines = [head, `Größter Wert: Original ${num(origMax)}, Annäherung ${num(peak)}`];
  // the rectangle and sawtooth presets jump by 2 (from +1 to −1)
  if ((sig === 'rechteck' || sig === 'saegezahn') && peak - 1 >= 0.01) {
    lines.push(`→ Überschwingen um ${formatNumber(((peak - 1) / 2) * 100)} % der Sprunghöhe 2`);
  }
  status.replaceChildren(...lines.flatMap((l, i) => (i ? [document.createElement('br'), l] : [l])));
}

function renderTable(): void {
  const { n, sig } = state.values;
  const label = SIGNALS.find((s) => s.value === sig)?.label ?? sig;
  tableCaption.textContent = `Koeffizienten des Signals „${label}“ für n = 0 … N = ${n}:`;
  const trs: HTMLTableRowElement[] = [];
  for (let k = 0; k <= n; k++) {
    const tr = document.createElement('tr');
    const a = coeffs.amp[k];
    const cells = [
      String(k),
      k === 0 ? '0' : k === 1 ? 'f₀' : `${k} f₀`,
      formatNumber(a, 3),
      a === 0 ? '–' : `${formatNumber((coeffs.phase[k] * 180) / Math.PI, 1)}°`,
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.append(td);
    }
    trs.push(tr);
  }
  rows.replaceChildren(...trs);
}

function redrawAll(): void {
  signalPlot.redraw();
  magPlot.redraw();
  phasePlot.redraw();
}

/** Recomputes everything that depends on the sampled period. */
function signalChanged(): void {
  updateSignal();
  const aMax = coeffs.amp.reduce((m, v) => Math.max(m, v), 0);
  magPlot.setOptions({ yRange: [0, Math.max(0.5, aMax) * 1.15] });
  renderStatus();
  renderTable();
  redrawAll();
}

function render(changed: ReadonlyArray<string>): void {
  const { sig, view } = state.values;
  qs('#plots').dataset.view = view;
  qs('#box-mag').hidden = view === 'phase';
  qs('#box-phase').hidden = view === 'betrag';
  clearBtn.hidden = sig !== 'zeichnen';
  if (changed.includes('sig')) {
    signalChanged();
  } else {
    renderStatus();
    renderTable();
    redrawAll();
  }
}

state.subscribe((_, changed) => {
  if (changed.includes('n') && !animStepping) stopAnimation();
  render(changed as string[]);
});
renderAnimation();
render(['sig']);
