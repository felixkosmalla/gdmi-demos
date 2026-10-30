// Demo template: copy demos/_template/ to demos/<slug>/ and adapt.
// Wiring: urlState (query string) → controls → plot redraw.
import '../../src/lib/page.css';
import { formatNumber, fullscreenButton, ideaCredit, qs, resetButton, slider, urlState } from '../../src/lib/controls';
import { createPlot, roles } from '../../src/lib/plot';

// 1. State: every parameter with its default. Types (number/boolean/string)
//    come from the defaults; URL params like ?f=3&a=0.5 override them.
const state = urlState({
  f: 2, // frequency in Hz
  a: 1, // amplitude
});

// 2. Plots. The draw callback reads the current state on every redraw.
const plot = createPlot(qs('#plot-time'), {
  xRange: [0, 2],
  yRange: [-1.2, 1.2],
  xLabel: 'Zeit t in s',
  yLabel: 'x(t)',
  legend: [{ label: 'x(t) = A · sin(2π f t)', color: roles.original }],
  ariaLabel: 'Sinusschwingung im Zeitbereich',
  draw(p) {
    const { f, a } = state.values;
    p.fn((t) => a * Math.sin(2 * Math.PI * f * t), { color: roles.original, width: 3 });
  },
});

// 3. Controls: essential ones in the lecture area, extras in the self-study part.
qs('#controls').append(
  slider(state, { key: 'f', label: 'Frequenz', symbol: 'f', min: 0.5, max: 10, step: 0.5, unit: 'Hz' }),
);
qs('#extra-controls').append(
  slider(state, { key: 'a', label: 'Amplitude', symbol: 'A', min: 0, max: 1, step: 0.05 }),
);
qs('#head-actions').append(fullscreenButton(qs('#lecture')), resetButton(state));
// "Idee nach: …" from the `replaces` field of this demo's entry in src/demos.ts.
qs('#lecture').append(ideaCredit('<slug>'));

// 4. Derived text (status line) and redraw on every change.
const status = qs('#status');
function render(): void {
  const { f } = state.values;
  status.textContent = `Periodendauer T = 1/f = ${formatNumber(1 / f, 3)} s`;
  plot.redraw();
}
state.subscribe(render);
render();
