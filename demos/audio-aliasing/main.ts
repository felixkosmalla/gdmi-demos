// Demo "Aliasing hören" (d07, Folien 27–28): a sine of input frequency f is
// sampled at f_s = 8 kHz and played back, so above f_s/2 the pitch falls again.
// Plots: perceived vs. actual frequency (triangle with a marker at f) and a few
// milliseconds of the samples with the alias sine through them. Sweep and A/B
// comparison are frequency programs that the sound (voice.ts) and the UI
// follow on the audio clock. Nothing plays before a click on a button.
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
import { aliasSine, abProgram, frequencyAt, programDuration, sweepProgram, type FreqPoint } from './model';
import { getVoice, type Voice } from './voice';

const state = urlState({
  f: 1000, // input frequency in Hz
  fs: 8000, // sample rate in Hz
  vol: 0.2, // master volume 0…1
  updown: false, // sweep 0 → f_s → 0 instead of 0 → f_s
});

const FS_OPTIONS = [8000, 11025, 16000];
/** Samples shown in the time-domain plot. */
const N_SAMPLES = 20;

const hz = (f: number): string => `${formatNumber(f, f % 1 ? 1 : 0)} Hz`;

// ---------------------------------------------------------------------------
// Controls (the f_s selector first, so the f slider is clamped to a valid f_s)

const fsSelect = select(state, {
  key: 'fs',
  label: 'Abtastrate fₛ',
  options: FS_OPTIONS.map((fs) => ({ value: fs, label: `${formatNumber(fs / 1000, fs % 1000 ? 3 : 0)} kHz` })),
});

const fSlider = slider(state, {
  key: 'f',
  label: 'Eingangsfrequenz',
  symbol: 'f',
  min: 0,
  max: Math.max(...FS_OPTIONS),
  step: 10,
  unit: 'Hz',
});
const fInput = qs<HTMLInputElement>('input', fSlider);
fInput.max = String(state.values.fs);
if (state.values.f > state.values.fs) state.set('f', state.values.fs);

const playBtn = button({ label: '', variant: 'primary', onClick: () => (playing ? stopPlayback() : void startPlayback()) });
playBtn.classList.add('btn-large');
const sweepBtn = button({ label: '', onClick: () => void runProgram('sweep') });
const abBtn = button({ label: '', onClick: () => void runProgram('ab') });

const hint = document.createElement('p');
hint.className = 'hint';
hint.textContent = 'Lautstärke vorher niedrig einstellen – hohe Töne sind unangenehm laut.';

qs('#f-control').append(fSlider);
qs('#controls').append(
  playBtn,
  group('Sweep', sweepBtn, toggle(state, { key: 'updown', label: 'hin und zurück' })),
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
    p.text(f, a.f, hz(a.f), {
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
    const a = aliasSine(f, fs);
    p.fn((ms) => Math.sin((2 * Math.PI * f * ms) / 1000), { color: roles.original, width: 1.5, alpha: 0.5 });
    p.fn((ms) => a.sign * Math.sin((2 * Math.PI * a.f * ms) / 1000), { color: roles.alias, width: 3.5 });
    const xs: number[] = [];
    const ys: number[] = [];
    for (let n = 0; n <= N_SAMPLES; n++) {
      xs.push((n * 1000) / fs);
      ys.push(Math.sin((2 * Math.PI * f * n) / fs));
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

let playing = false;
let voice: Voice | null = null;
let startToken = 0;
let audioError: string | null = null;
const status = qs('#status');

/** Starts the sound for the current f_s. Call from a click handler (audio needs a user gesture). */
async function startPlayback(): Promise<Voice | null> {
  const token = ++startToken;
  playing = true;
  audioError = null;
  // iOS: play even when the ring/silent switch is set to silent (Safari 16.4+)
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = 'playback';
  renderButtons();
  try {
    const v = await getVoice(state.values.fs);
    if (token !== startToken || !playing) return null;
    voice = v;
    v.setVolume(state.values.vol);
    v.setFrequency(state.values.f);
    v.start();
    renderStatus();
    return v;
  } catch (err) {
    if (token === startToken) {
      playing = false;
      audioError = err instanceof Error ? err.message : String(err);
      renderButtons();
      renderStatus();
    }
    return null;
  }
}

function stopPlayback(): void {
  playing = false;
  cancelProgram();
  voice?.stop();
  renderButtons();
}

function renderStatus(): void {
  if (audioError) {
    status.textContent = `Kein Ton: ${audioError}`;
  } else if (!voice) {
    status.textContent = 'Der Ton startet erst mit „Abspielen“, „Sweep“ oder „A/B“.';
  } else if (voice.ctx.state !== 'running') {
    status.textContent = 'Ton blockiert: bitte noch einmal auf „Abspielen“ tippen.';
  } else if (voice.mode === 'worklet') {
    status.textContent = `Wiedergabe der Abtastwerte mit ${hz(voice.fs)}, rekonstruiert vom Browser.`;
  } else {
    status.textContent = `Ersatzverfahren: Der Browser spielt nicht mit ${hz(voice.fs)} ab. Zu hören ist direkt die rekonstruierte Frequenz.`;
  }
}

// ---------------------------------------------------------------------------
// Frequency programs (sweep, A/B): the audio runs them as AudioParam
// automation, the UI mirrors f from the same clock on every animation frame.

interface Running {
  kind: 'sweep' | 'ab';
  points: FreqPoint[];
  t0: number;
  clock: () => number;
  /** Was the sound on before the program started? If not, it stops at the end. */
  wasPlaying: boolean;
  frame: number;
}

let running: Running | null = null;
let mirroring = false;

function setMirrored(f: number): void {
  mirroring = true;
  try {
    state.set('f', Math.round(f));
  } finally {
    mirroring = false;
  }
}

async function runProgram(kind: Running['kind']): Promise<void> {
  if (running?.kind === kind) {
    endProgram(); // the button doubles as "stop"
    return;
  }
  const wasPlaying = running ? running.wasPlaying : playing;
  cancelProgram();
  const { fs, updown } = state.values;
  const points = kind === 'sweep' ? sweepProgram(fs, updown) : abProgram(fs);
  state.set('f', points[0].f);
  const v = playing ? voice : await startPlayback();
  if (!v && !audioError && !playing) return; // stopped while the audio was starting
  if (running) return; // another program was started meanwhile
  // without sound (error) the program still runs visually
  const clock = v ? () => v.ctx.currentTime : () => performance.now() / 1000;
  const t0 = clock() + (v ? 0.05 : 0);
  v?.runProgram(points, t0);
  running = { kind, points, t0, clock, wasPlaying, frame: requestAnimationFrame(tick) };
  renderButtons();
}

function tick(): void {
  const r = running;
  if (!r) return;
  const t = r.clock() - r.t0;
  setMirrored(frequencyAt(r.points, t));
  if (t >= programDuration(r.points)) endProgram();
  else r.frame = requestAnimationFrame(tick);
}

/** Stops following the program (the audio automation is replaced by the next setFrequency). */
function cancelProgram(): void {
  if (!running) return;
  cancelAnimationFrame(running.frame);
  running = null;
  renderButtons();
}

/** Ends the program where it is; the sound stops if the program started it. */
function endProgram(): void {
  const r = running;
  if (!r) return;
  cancelProgram();
  voice?.setFrequency(state.values.f);
  if (!r.wasPlaying) stopPlayback();
}

// ---------------------------------------------------------------------------
// Rendering

const readoutBox = qs('#readout');
const readoutF = qs('#readout-f');
const readoutAlias = qs('#readout-alias');
const readoutText = qs('#readout-text');

function renderButtons(): void {
  const { fs, updown } = state.values;
  playBtn.textContent = playing ? '■ Stopp' : '▶ Abspielen';
  sweepBtn.textContent = running?.kind === 'sweep' ? 'Sweep stoppen' : `Sweep 0 → ${hz(fs)}${updown ? ' → 0' : ''}`;
  sweepBtn.setAttribute('aria-pressed', String(running?.kind === 'sweep'));
  const ab = abProgram(fs);
  abBtn.textContent = running?.kind === 'ab' ? 'Vergleich stoppen' : `A/B: ${ab.slice(0, 3).map((p) => formatNumber(p.f)).join(' · ')} Hz`;
  abBtn.title = 'Je 1 s nacheinander abspielen';
  abBtn.setAttribute('aria-pressed', String(running?.kind === 'ab'));
}

function renderReadout(): void {
  const { f, fs } = state.values;
  const half = fs / 2;
  const a = aliasSine(f, fs);
  readoutF.textContent = `f = ${hz(f)}`;
  readoutAlias.textContent = `→ hörbar: ${hz(a.f)}`;
  readoutBox.className = 'readout-box';
  if (f < half) {
    readoutBox.classList.add('status--ok');
    readoutText.textContent = `f liegt unter fₛ/2 = ${hz(half)} und wird korrekt wiedergegeben.`;
  } else if (f === half) {
    readoutBox.classList.add('status--warn');
    readoutText.textContent = `Grenzfall f = fₛ/2: Die Abtastwerte wechseln nur das Vorzeichen. Ob man etwas hört, hängt von der Phase ab.`;
  } else if (f < fs) {
    readoutBox.classList.add('status--bad');
    readoutText.textContent = `Aliasing: f liegt über fₛ/2 und wird gespiegelt, fₛ − f = ${formatNumber(fs)} − ${formatNumber(f)} = ${hz(a.f)}.`;
  } else {
    readoutBox.classList.add('status--bad');
    readoutText.textContent = `Aliasing: Bei f = fₛ sind alle Abtastwerte gleich – kein Ton (0 Hz).`;
  }
}

function render(): void {
  const { f, fs } = state.values;
  const a = aliasSine(f, fs);
  graph.setOptions({ xRange: [0, fs], yRange: [0, (fs / 2) * 1.25] });
  timePlot.setOptions({ xRange: [0, (N_SAMPLES * 1000) / fs] });
  qs('#cap-time-title').textContent = `Zeitbereich: Abtastung alle T = 1/fₛ = ${formatNumber(1000 / fs, 3)} ms`;
  timeLegend.replaceChildren(
    legendElement([
      { label: `Eingang ${hz(f)}`, color: roles.original, width: 1.5 },
      { label: 'Abtastwerte', color: roles.samples, kind: 'stem' },
      { label: `durch die Abtastwerte: ${hz(a.f)}`, color: roles.alias, width: 3.5 },
    ]),
  );
  renderReadout();
  renderButtons();
}

state.subscribe((v, changed) => {
  if (changed.includes('fs')) {
    cancelProgram();
    fInput.max = String(v.fs);
    if (v.f > v.fs) state.set('f', v.fs);
    voice?.stop();
    voice = null;
    if (playing) void startPlayback();
  }
  if (changed.includes('f') && !mirroring) {
    cancelProgram();
    voice?.setFrequency(v.f);
  }
  if (changed.includes('vol')) voice?.setVolume(v.vol);
  render();
});
render();
renderStatus();
