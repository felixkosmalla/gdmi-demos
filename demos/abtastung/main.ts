// Demo "Abtastung & Rekonstruktion" (d07, Folie 26): a signal of 28, 84 and
// 140 Hz is sampled at f_s. Three plots: samples in the time domain, the
// sinc reconstruction vs. the original, and the analytic spectrum with its
// copies at k·f_s ± f, the Nyquist band [0, f_s/2] and the alias lines. The
// spectrum is hidden by default and toggled with `spec`.
import '../../src/lib/page.css';
import {
  button,
  formatNumber,
  fullscreenButton,
  group,
  qs,
  resetButton,
  slider,
  symbolFragment,
  toggle,
  urlState,
} from '../../src/lib/controls';
import { createPlot, legendElement, niceTicks, roles, type Plot } from '../../src/lib/plot';
import {
  analyze,
  reconstruct,
  sampleBlock,
  signal,
  spectrumLines,
  spectrumMax,
  type Component,
  type SampleBlock,
} from './model';

const state = urlState({
  fs: 150, // sample rate in Hz
  c28: true,
  c84: true,
  c140: true,
  a28: 1,
  a84: 1,
  a140: 1,
  win: 0.1, // visible time window in s
  spec: false, // show the spectrum plot (hidden by default)
});

const FS_MIN = 20;
const FS_MAX = 600;

function components(): Component[] {
  const v = state.values;
  return [
    { f: 28, a: v.c28 ? v.a28 : 0 },
    { f: 84, a: v.c84 ? v.a84 : 0 },
    { f: 140, a: v.c140 ? v.a140 : 0 },
  ];
}

// ---------------------------------------------------------------------------
// Derived data, recomputed only when the relevant parameters change.

let comps = components();
let block: SampleBlock = sampleBlock(comps, state.values.fs, state.values.win);
let blockKey = '';
let recon: { key: string; xs: Float64Array; ys: Float64Array } | undefined;

function updateBlock(): void {
  const { fs, win } = state.values;
  comps = components();
  const key = JSON.stringify([fs, win, comps]);
  if (key === blockKey) return;
  blockKey = key;
  block = sampleBlock(comps, fs, win);
  recon = undefined;
}

/** Reconstruction at one point per CSS pixel column (cached per block and plot width). */
function reconstruction(p: Plot): { xs: Float64Array; ys: Float64Array } {
  const n = Math.max(2, Math.ceil(p.area.width)) + 1;
  const key = `${blockKey}|${n}`;
  if (recon?.key !== key) {
    const [a, b] = p.options.xRange;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = a + ((b - a) * i) / (n - 1);
      ys[i] = reconstruct(block, xs[i] / 1000);
    }
    recon = { key, xs, ys };
  }
  return recon;
}

/** Visible samples in ms / value. */
function visibleSamples(): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = block.first; i <= block.last; i++) {
    xs.push(((block.t0 + i / block.fs) * 1000));
    ys.push(block.values[i]);
  }
  return { xs, ys };
}

function yLimit(): number {
  const sum = comps.reduce((s, c) => s + c.a, 0);
  return Math.max(0.5, sum) * 1.12;
}

// ---------------------------------------------------------------------------
// Plots (time axis in ms)

const original = (ms: number): number => signal(comps, ms / 1000);

const timePlot = createPlot(qs('#plot-time'), {
  xRange: [0, 100],
  yRange: [-3.4, 3.4],
  xLabel: 'Zeit t in ms',
  yLabel: 'x(t)',
  ariaLabel: 'Originalsignal und Abtastwerte im Zeitbereich',
  draw(p) {
    const s = visibleSamples();
    p.fn(original, { color: roles.original, width: 3 });
    p.stems(s.xs, s.ys, { color: roles.samples, width: 2.5, radius: 5 });
  },
});

const recPlot = createPlot(qs('#plot-rec'), {
  xRange: [0, 100],
  yRange: [-3.4, 3.4],
  xLabel: 'Zeit t in ms',
  yLabel: 'x(t)',
  ariaLabel: 'Rekonstruktion aus den Abtastwerten im Vergleich zum Original',
  draw(p) {
    const r = reconstruction(p);
    p.line(r.xs, r.ys, { color: roles.reconstruction, width: 4 });
    p.fn(original, { color: roles.original, width: 2, dash: [7, 5] });
    const s = visibleSamples();
    p.points(s.xs, s.ys, { color: roles.samples, radius: 4 });
  },
});

const specPlot = createPlot(qs('#plot-spec'), {
  xRange: [0, 450],
  yRange: [0, 1.5],
  xLabel: 'Frequenz f in Hz',
  yLabel: 'Amplitude',
  ariaLabel: 'Spektrum des abgetasteten Signals mit Kopien und Alias-Frequenzen',
  draw: drawSpectrum,
});

function drawSpectrum(p: Plot): void {
  const { fs } = state.values;
  const fMax = p.options.xRange[1];
  const lines = spectrumLines(comps, fs, fMax);
  const fsz = p.fontSize;

  // band [0, f_s/2] that the reconstruction keeps
  p.band(0, fs / 2, { color: roles.band });

  // multiples of f_s: thin dotted guides, labelled while there is room
  const spacing = p.xToPx(fs) - p.xToPx(0);
  for (let k = 1; k * fs <= fMax && spacing >= 12; k++) {
    p.vline(k * fs, { color: roles.copy, width: 1.5, dash: [2, 4] });
    const px = p.xToPx(k * fs);
    if (spacing < fsz * 3.2 || px + fsz * 1.5 > p.area.left + p.area.width) continue;
    p.text(k * fs, p.options.yRange[0], k === 1 ? 'fₛ' : `${k}fₛ`, {
      color: roles.copy, align: 'center', baseline: 'bottom', dy: -4, bold: true, background: true,
    });
  }

  const pick = (kind: string): { xs: number[]; ys: number[] } => {
    const sel = lines.filter((l) => l.kind === kind);
    return { xs: sel.map((l) => l.f), ys: sel.map((l) => l.a) };
  };
  const copies = pick('copy');
  const originals = pick('original');
  const aliases = pick('alias');
  p.stems(copies.xs, copies.ys, { color: roles.copy, width: 2.5, dash: [6, 4], radius: 4.5 });
  p.stems(originals.xs, originals.ys, { color: roles.original, width: 4, radius: 6 });
  p.stems(aliases.xs, aliases.ys, { color: roles.alias, width: 4, radius: 6 });

  // Nyquist marker on top of everything
  p.vline(fs / 2, { color: roles.marker, width: 2.5, dash: [9, 5] }, 'fₛ/2 (Nyquist)');

  // alias labels; neighbours that would overlap share one label ("0, 4, 8 Hz")
  const order = lines.filter((l) => l.kind === 'alias').sort((a, b) => a.f - b.f);
  const ctx = p.ctx;
  ctx.save();
  ctx.font = `600 ${fsz}px ${getComputedStyle(p.container).fontFamily}`;
  const clusters: { fs: number[]; a: number }[] = [];
  for (const l of order) {
    const last = clusters[clusters.length - 1];
    const lastLabel = last ? aliasLabel(last.fs) : '';
    if (last && p.xToPx(l.f) - p.xToPx(last.fs[last.fs.length - 1]) < ctx.measureText(lastLabel).width / 2 + fsz * 2) {
      if (!last.fs.includes(l.f)) last.fs.push(l.f);
      last.a = Math.max(last.a, l.a);
    } else {
      clusters.push({ fs: [l.f], a: l.a });
    }
  }
  for (const c of clusters) {
    const label = aliasLabel(c.fs);
    const w = ctx.measureText(label).width;
    const mid = (p.xToPx(c.fs[0]) + p.xToPx(c.fs[c.fs.length - 1])) / 2;
    const left = Math.min(Math.max(p.area.left + 4, mid - w / 2), p.area.left + p.area.width - w - 4);
    p.text(p.pxToX(left + w / 2), c.a, label, {
      color: roles.alias, align: 'center', baseline: 'bottom', dy: -10, bold: true, background: true,
    });
  }
  ctx.restore();
}

function aliasLabel(fs: number[]): string {
  return `${fs.map((f) => formatNumber(f, f % 1 ? 1 : 0)).join(', ')}\u00a0Hz`;
}

// Legends in the captions (keeps the short plots free of legend boxes)
qs('#cap-time').append(
  legendElement([
    { label: 'Original x(t)', color: roles.original, width: 3 },
    { label: 'Abtastwerte x(n·T)', color: roles.samples, kind: 'stem' },
  ]),
);
qs('#cap-rec').append(
  legendElement([
    { label: 'Rekonstruktion', color: roles.reconstruction, width: 4 },
    { label: 'Original', color: roles.original, dash: [5, 3] },
    { label: 'Abtastwerte', color: roles.samples, kind: 'point' },
  ]),
);
qs('#cap-spec').append(
  legendElement([
    { label: 'Original', color: roles.original, kind: 'stem', width: 3 },
    { label: 'Kopien bei k·fₛ ± f', color: roles.copy, kind: 'stem', dash: [3, 2] },
    { label: 'Alias', color: roles.alias, kind: 'stem', width: 3 },
    { label: 'Bereich 0 … fₛ/2', color: roles.band, kind: 'band' },
  ]),
);

// ---------------------------------------------------------------------------
// Controls

const presets = [
  { fs: 150, label: '150 Hz' },
  { fs: 280, label: '280 Hz' },
  { fs: 400, label: '400 Hz' },
];
const presetButtons = presets.map((pr) =>
  button({ label: pr.label, onClick: () => state.set('fs', pr.fs), title: `Abtastrate auf ${pr.fs} Hz setzen` }),
);

qs('#controls').append(
  slider(state, { key: 'fs', label: 'Abtastrate', symbol: 'f_s', min: FS_MIN, max: FS_MAX, step: 1, unit: 'Hz',
    info: 'Abtastrate fₛ: Anzahl der Abtastwerte pro Sekunde (Abstand T = 1/fₛ). Exakte Rekonstruktion nur, wenn fₛ größer als das Doppelte der höchsten Signalfrequenz ist; fₛ/2 heißt Nyquist-Frequenz.' }),
  group('Schnellwahl', ...presetButtons),
  group(
    'Frequenzanteile',
    toggle(state, { key: 'c28', label: '28 Hz' }),
    toggle(state, { key: 'c84', label: '84 Hz' }),
    toggle(state, { key: 'c140', label: '140 Hz' }),
  ),
  group('Ansicht', toggle(state, { key: 'spec', label: 'Spektrum anzeigen' })),
);

qs('#extra-controls').append(
  slider(state, { key: 'a28', label: 'Amplitude 28 Hz', min: 0, max: 1, step: 0.05 }),
  slider(state, { key: 'a84', label: 'Amplitude 84 Hz', min: 0, max: 1, step: 0.05 }),
  slider(state, { key: 'a140', label: 'Amplitude 140 Hz', min: 0, max: 1, step: 0.05 }),
  slider(state, {
    key: 'win',
    label: 'Zeitfenster',
    min: 0.03,
    max: 0.4,
    step: 0.01,
    format: (v) => `${formatNumber(v * 1000, 0)} ms`,
  }),
);
qs('#head-actions').append(fullscreenButton(qs('#lecture')), resetButton(state));

// ---------------------------------------------------------------------------
// Status line and caption

const status = qs('#status');
const capTime = qs('#cap-time-title');

const hz = (f: number): string => `${formatNumber(f, f % 1 ? 1 : 0)}\u00a0Hz`;

function renderStatus(): void {
  const { fs } = state.values;
  const a = analyze(comps, fs);
  const parts: (string | Node)[] = [];
  const fsSym = (): Node => symbolFragment('f_s');
  const strong = (...c: (string | Node)[]): HTMLElement => {
    const s = document.createElement('strong');
    s.append(...c);
    return s;
  };
  status.className = 'status';
  switch (a.verdict) {
    case 'none':
      parts.push('Kein Frequenzanteil aktiv – mindestens einen einschalten.');
      break;
    case 'ok':
      status.classList.add('status--ok');
      parts.push(fsSym(), `\u00a0=\u00a0${hz(fs)} > 2\u00a0·\u00a0${hz(a.fMax)} =\u00a0${hz(2 * a.fMax)}`, document.createElement('br'));
      parts.push(strong('→ kein Aliasing, Rekonstruktion exakt'));
      break;
    case 'limit':
      status.classList.add('status--warn');
      parts.push(fsSym(), `\u00a0=\u00a0${hz(fs)} = 2\u00a0·\u00a0${hz(a.fMax)}`, document.createElement('br'));
      parts.push(strong('→ Grenzfall: '), `${hz(a.fMax)} liegt genau auf `, fsSym(), '/2. Die Abtastwerte treffen seine Nulldurchgänge, er fehlt in der Rekonstruktion.');
      break;
    case 'aliasing': {
      status.classList.add('status--bad');
      parts.push(fsSym(), `\u00a0=\u00a0${hz(fs)} < 2\u00a0·\u00a0${hz(a.fMax)} =\u00a0${hz(2 * a.fMax)}`, document.createElement('br'));
      const items = a.aliases.map((x) => `${hz(x.f)} erscheint als ${hz(x.alias)}`);
      parts.push(strong('→ Aliasing: '), items.join(', '));
      const nyq = a.atNyquist.filter((f) => f < a.fMax);
      if (nyq.length) parts.push('; ', `${nyq.map(hz).join(', ')} liegt genau auf `, fsSym(), '/2');
      break;
    }
  }
  status.replaceChildren(...parts);

  capTime.replaceChildren('Zeitbereich: Abtastung alle T = 1/', fsSym(), ` = ${formatNumber(1000 / fs, 2)} ms`);
  presetButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(presets[i].fs === fs)));
}

function render(): void {
  updateBlock();
  const { fs, win, spec } = state.values;
  qs('#box-spec').hidden = !spec;
  const y = yLimit();
  const xRange: [number, number] = [0, win * 1000];
  const yTicks = niceTicks(-y, y, 4);
  timePlot.setOptions({ xRange, yRange: [-y, y], yTicks });
  recPlot.setOptions({ xRange, yRange: [-y, y], yTicks });
  const aMax = Math.max(0.2, ...comps.map((c) => c.a));
  const fMax = spectrumMax(fs);
  specPlot.setOptions({ xRange: [-fMax * 0.012, fMax], yRange: [0, aMax * 1.8] });
  renderStatus();
}

state.subscribe(render);
render();
