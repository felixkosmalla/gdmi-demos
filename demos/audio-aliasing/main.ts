// Demo "Aliasing hören" (d07, Folien 27–28): a sine of input frequency f is
// sampled at f_s = 8 kHz and played back, so above f_s/2 the pitch falls again.
// Plots: perceived vs. actual frequency (triangle with a marker at f) and a few
// milliseconds of the samples with the alias sine through them. Sound, sweep
// and A/B comparison: playback.ts and voice.ts. Nothing plays before a click
// on a button.
import '../../src/lib/page.css';
import {
  button,
  formatNumber,
  fullscreenButton,
  group,
  qs,
  resetButton,
  select,
  slider,
  toggle,
  urlState,
} from '../../src/lib/controls';
import { createPlot, legendElement, roles } from '../../src/lib/plot';
import { abProgram, aliasSine, programDisplayFrequency, SAMPLE_RATES } from './model';
import { createPlayback } from './playback';
import { hz, readout } from './readout';
import { getVoice } from './voice';

const state = urlState({
  f: 1000, // input frequency in Hz
  fs: 8000, // sample rate in Hz
  vol: 0.2, // master volume 0…1
  updown: false, // sweep 0 → f_s → 0 instead of 0 → f_s
});

/** Samples shown in the time-domain plot. */
const N_SAMPLES = 20;
/**
 * Phase of the input in the time plot: a cosine. Its samples at f = f_s/2 are
 * ±1 (a sine's would all be 0), and the plot changes continuously there.
 */
const PLOT_PHASE = Math.PI / 2;

const stepFor = (fs: number): number => SAMPLE_RATES.find((r) => r.fs === fs)?.step ?? 10;

// ---------------------------------------------------------------------------
// Controls (the f_s selector first, so the f slider is clamped to a valid f_s)

const fsSelect = select(state, {
  key: 'fs',
  label: 'Abtastrate fₛ',
  options: SAMPLE_RATES.map(({ fs }) => ({ value: fs, label: `${formatNumber(fs / 1000, fs % 1000 ? 3 : 0)} kHz` })),
});

const fSlider = slider(state, {
  key: 'f',
  label: 'Eingangsfrequenz',
  symbol: 'f',
  min: 0,
  max: state.values.fs,
  step: stepFor(state.values.fs),
  format: hz,
});
const fInput = qs<HTMLInputElement>('input', fSlider);

const playBtn = button({
  label: '',
  variant: 'primary',
  onClick: () => (playback.playing ? playback.stop() : void playback.start()),
});
playBtn.classList.add('btn-large');
const sweepBtn = button({ label: '', onClick: () => void playback.toggleProgram('sweep') });
const abBtn = button({ label: '', onClick: () => void playback.toggleProgram('ab') });

const hint = document.createElement('p');
hint.className = 'hint';
hint.textContent = 'Lautstärke vorher niedrig einstellen – hohe Töne sind unangenehm laut.';

const SWEEP_INFO =
  'Nahe fₛ/2 wird der Ton leiser: Der Rekonstruktionstiefpass des Browsers schneidet nicht senkrecht ab und dämpft schon unterhalb von fₛ/2. Darum ist der Sweep gerade dort leise, wo die Tonhöhe umkehrt.';

qs('#f-control').append(fSlider);
qs('#controls').append(
  playBtn,
  group({ label: 'Sweep', info: SWEEP_INFO }, sweepBtn, toggle(state, { key: 'updown', label: 'hin und zurück' })),
  group('Vergleich', abBtn),
  slider(state, { key: 'vol', label: 'Lautstärke', min: 0, max: 1, step: 0.05, format: (v) => `${formatNumber(v * 100)} %` }),
  hint,
);
qs('#extra-controls').append(fsSelect);
qs('#head-actions').append(fullscreenButton(qs('#lecture')), resetButton(state));

// ---------------------------------------------------------------------------
// Plots

const graph = createPlot(qs('#plot-graph'), {
  xRange: [0, 8000],
  yRange: [0, 5000],
  xLabel: 'Tatsächliche Frequenz f in kHz',
  yLabel: 'Wahrgenommen in kHz',
  xTickFormat: (v) => formatNumber(v / 1000, v % 1000 ? 1 : 0),
  yTickFormat: (v) => formatNumber(v / 1000, v % 1000 ? 1 : 0),
  ariaLabel: 'Wahrgenommene Frequenz über der tatsächlichen Frequenz: steigt bis fₛ/2 und fällt danach wieder',
  draw(p) {
    const { f, fs } = state.values;
    const half = fs / 2;
    const a = aliasSine(f, fs);
    p.band(0, half, { color: roles.band });
    p.line([0, fs], [0, fs], { color: roles.copy, width: 2.5, dash: [8, 6] });
    p.hline(half, { color: roles.marker, width: 1.5, dash: [3, 4] });
    p.vline(half, { color: roles.marker, width: 2.5, dash: [9, 5] }, 'fₛ/2 (Nyquist)');
    p.line([0, half], [0, half], { color: roles.original, width: 4.5 });
    p.line([half, fs], [half, 0], { color: roles.alias, width: 4.5 });
    // region labels in the free space above the middle of each segment (fits narrow plots too)
    const label = { align: 'center', baseline: 'middle', bold: true, background: true } as const;
    p.text(half / 2, half * 0.85, 'korrekt', { ...label, color: roles.original });
    p.text(half * 1.5, half * 0.85, 'gespiegelt', { ...label, color: roles.alias });

    // marker at the current setting, with reading lines to both axes
    const guide = { color: roles.samples, width: 1.5, dash: [2, 4] };
    p.line([f, f], [0, a.f], guide);
    p.line([0, f], [a.f, a.f], guide);
    p.point(f, a.f, { color: roles.samples, fill: '#fff', width: 3, radius: 9 });
    p.text(f, a.f, hz(readout(f, fs).aliasF), {
      align: f > fs * 0.8 ? 'right' : 'left',
      dx: f > fs * 0.8 ? -16 : 16,
      dy: -12,
      bold: true,
      background: true,
    });
  },
});

const timePlot = createPlot(qs('#plot-time'), {
  xRange: [0, 2.5],
  yRange: [-1.3, 1.3],
  yTicks: [-1, 0, 1],
  xLabel: 'Zeit t in ms',
  yLabel: 'x(t)',
  ariaLabel: 'Eingangssinus, Abtastwerte und der Sinus mit der hörbaren Frequenz durch die Abtastwerte',
  draw(p) {
    const { f, fs } = state.values;
    const a = aliasSine(f, fs, PLOT_PHASE);
    p.fn((ms) => Math.sin((2 * Math.PI * f * ms) / 1000 + PLOT_PHASE), { color: roles.original, width: 1.5, alpha: 0.5 });
    p.fn((ms) => a.amplitude * Math.sin((2 * Math.PI * a.f * ms) / 1000 + a.phase), { color: roles.alias, width: 3.5 });
    const xs: number[] = [];
    const ys: number[] = [];
    for (let n = 0; n <= N_SAMPLES; n++) {
      xs.push((n * 1000) / fs);
      ys.push(Math.sin((2 * Math.PI * f * n) / fs + PLOT_PHASE));
    }
    p.stems(xs, ys, { color: roles.samples, width: 2.5, radius: 5 });
  },
});

qs('#cap-graph').append(
  legendElement([
    { label: 'hörbar (korrekt)', color: roles.original, width: 4 },
    { label: 'hörbar (gespiegelt)', color: roles.alias, width: 4 },
    { label: 'ohne Aliasing', color: roles.copy, dash: [5, 3] },
    { label: 'Einstellung', color: roles.samples, kind: 'point' },
  ]),
);
const timeLegend = document.createElement('span');
qs('#cap-time').append(timeLegend);

// ---------------------------------------------------------------------------
// Sound

let mirroring = false;

/** Shows a program's frequency without cancelling the program. */
function setMirrored(f: number): void {
  mirroring = true;
  try {
    state.set('f', programDisplayFrequency(f, state.values.fs));
  } finally {
    mirroring = false;
  }
}

const playback = createPlayback({
  getVoice,
  settings: () => state.values,
  showFrequency: setMirrored,
  onChange() {
    renderButtons();
    renderStatus();
  },
  now: () => performance.now() / 1000,
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
});

const status = qs('#status');

function renderStatus(): void {
  const v = playback.voice;
  if (playback.error) {
    status.textContent = `Kein Ton: ${playback.error}`;
  } else if (!playback.playing) {
    status.textContent = 'Der Ton startet erst mit „Abspielen“, „Sweep“ oder „A/B“.';
  } else if (!v) {
    status.textContent = 'Ton wird gestartet …';
  } else if (v.ctx.state !== 'running') {
    status.textContent = 'Ton blockiert: bitte noch einmal auf „Abspielen“ tippen.';
  } else if (v.mode === 'worklet') {
    status.textContent = `Wiedergabe der Abtastwerte mit ${hz(v.fs)}, rekonstruiert vom Browser.`;
  } else {
    status.textContent = `Ersatzverfahren: Der Browser spielt nicht mit ${hz(v.fs)} ab. Zu hören ist direkt die rekonstruierte Frequenz.`;
  }
}

// ---------------------------------------------------------------------------
// Rendering

const readoutBox = qs('#readout');
const readoutF = qs('#readout-f');
const readoutAlias = qs('#readout-alias');
const readoutText = qs('#readout-text');

function renderButtons(): void {
  const { fs, updown } = state.values;
  const program = playback.program;
  playBtn.textContent = playback.playing ? '■ Stopp' : '▶ Abspielen';
  sweepBtn.textContent = program === 'sweep' ? 'Sweep stoppen' : `Sweep 0 → ${hz(fs)}${updown ? ' → 0' : ''}`;
  sweepBtn.setAttribute('aria-pressed', String(program === 'sweep'));
  const ab = abProgram(fs);
  abBtn.textContent = program === 'ab' ? 'Vergleich stoppen' : `A/B: ${ab.slice(0, 3).map((p) => formatNumber(p.f)).join(' · ')} Hz`;
  abBtn.title = 'Je 1 s nacheinander abspielen';
  abBtn.setAttribute('aria-pressed', String(program === 'ab'));
}

function render(): void {
  const { f, fs } = state.values;
  const r = readout(f, fs);
  readoutF.textContent = r.f;
  readoutAlias.textContent = r.alias;
  readoutText.textContent = r.text;
  readoutBox.className = `readout-box status--${r.status}`;
  graph.setOptions({ xRange: [0, fs], yRange: [0, (fs / 2) * 1.25] });
  timePlot.setOptions({ xRange: [0, (N_SAMPLES * 1000) / fs] });
  qs('#cap-time-title').textContent = `Zeitbereich: Abtastung alle T = 1/fₛ = ${formatNumber(1000 / fs, 3)} ms`;
  timeLegend.replaceChildren(
    legendElement([
      { label: `Eingang ${hz(f)}`, color: roles.original, width: 1.5 },
      { label: 'Abtastwerte', color: roles.samples, kind: 'stem' },
      { label: `durch die Abtastwerte: ${hz(r.aliasF)}`, color: roles.alias, width: 3.5 },
    ]),
  );
  renderButtons();
}

state.subscribe((v, changed) => {
  if (changed.includes('fs')) {
    // before clamping f: a clamp would cancel the program, and with it the "stop at the end"
    playback.sampleRateChanged();
    fInput.max = String(v.fs);
    fInput.step = String(stepFor(v.fs));
    if (v.f > v.fs) state.set('f', v.fs);
  }
  if (changed.includes('f') && !mirroring) playback.setFrequency(v.f);
  if (changed.includes('vol')) playback.setVolume(v.vol);
  render();
});
render();
renderStatus();
