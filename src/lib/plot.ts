/**
 * Small HiDPI plotting helper on top of Canvas 2D: axes with "nice" ticks,
 * grid, axis labels, legend, and drawing primitives in data coordinates.
 *
 *   const plot = createPlot(qs('#plot'), {
 *     xRange: [0, 0.1], yRange: [-3, 3], xLabel: 'Zeit t in s', yLabel: 'x(t)',
 *     legend: [{ label: 'Original', color: roles.original }],
 *     draw: (p) => p.fn((t) => Math.sin(2 * Math.PI * 28 * t), { color: roles.original }),
 *   });
 *   state.subscribe(() => plot.redraw());
 *
 * The container element determines the size (give it a CSS height, e.g. the
 * `.plot` class from page.css); the canvas fills it and follows resizes.
 * Font size/family come from the container's computed style, colors from CSS
 * variables (see page.css), so the lecture view can scale everything via CSS.
 *
 * Keep this modest: special drawings (e.g. phasors) belong on a demo's own canvas,
 * or into the `draw` callback via `p.ctx` and `p.toPx`.
 */
import { formatNumber } from './controls';

/**
 * Signal role colors as CSS variable names, usable wherever a Style takes a
 * color. Keep roles consistent across demos.
 */
export const roles = {
  original: '--c-original', // accent blue: the original / input signal
  samples: '--c-samples', // dark grey: sample values (stems)
  reconstruction: '--c-reconstruction', // red: reconstruction / approximation
  alias: '--c-alias', // red: alias components
  copy: '--c-copy', // grey: spectral copies, "missing" parts
  marker: '--c-marker', // vertical/horizontal markers (e.g. Nyquist line)
  band: '--c-band', // translucent fill for highlighted ranges
  series1: '--c-series-1', // individual components (pointers, harmonics …)
  series2: '--c-series-2',
  series3: '--c-series-3',
  series4: '--c-series-4',
} as const;

export interface Style {
  /** Any CSS color, or a CSS variable name like `'--c-original'` (see {@link roles}). Default: text color. */
  color?: string;
  /** Line width in CSS px. Default 2. */
  width?: number;
  /** Dash pattern in CSS px, e.g. `[6, 4]`. */
  dash?: number[];
  /** Opacity 0…1. Default 1. */
  alpha?: number;
  /** Fill color for bars, rects, points (defaults to `color`). */
  fill?: string;
  /** Radius in CSS px for points and stem heads. Default 5 (points), 4.5 (stems). */
  radius?: number;
}

export interface TextOptions {
  color?: string;
  /** Default 'left'. */
  align?: CanvasTextAlign;
  /** Default 'alphabetic'. */
  baseline?: CanvasTextBaseline;
  /** Pixel offset from the anchor point. */
  dx?: number;
  dy?: number;
  /** Font size factor relative to the plot font (default 1). */
  scale?: number;
  bold?: boolean;
  /** Draw a semi-opaque background box behind the text (for readability on top of curves). */
  background?: boolean;
}

export interface LegendItem {
  label: string;
  color: string;
  dash?: number[];
  width?: number;
  /** How the swatch is drawn. Default 'line'. */
  kind?: 'line' | 'stem' | 'bar' | 'point' | 'band';
}

export interface PlotOptions {
  xRange: [number, number];
  yRange: [number, number];
  /** Axis labels including the unit, e.g. "Zeit t in ms", "Frequenz f in Hz". */
  xLabel?: string;
  yLabel?: string;
  /** Default true. */
  grid?: boolean;
  /** Explicit tick positions; default: automatic "nice" ticks. */
  xTicks?: number[];
  yTicks?: number[];
  /** Tick label formatting; default German number format with decimals from the tick step. */
  xTickFormat?: (v: number) => string;
  yTickFormat?: (v: number) => string;
  legend?: LegendItem[];
  /** Default 'top-right'. */
  legendPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Accessible description of the canvas (role="img"). */
  ariaLabel?: string;
  /** Called on every redraw (clipped to the plot area) to draw the data. */
  draw?: (p: Plot) => void;
}

export interface Area {
  /** Plot area in CSS px relative to the canvas. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Plot {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** Context with the transform set to CSS px. Usable inside `draw` for custom shapes. */
  readonly ctx: CanvasRenderingContext2D;
  /** Current options (mutate via `setOptions`). */
  readonly options: Readonly<PlotOptions>;
  /** Plot area (inside the axes) in CSS px. */
  readonly area: Readonly<Area>;
  /** Canvas size in CSS px. */
  readonly width: number;
  readonly height: number;
  /** Plot font size in px (from CSS). */
  readonly fontSize: number;

  /** Merges options (e.g. new xRange, legend or draw) and schedules a redraw. */
  setOptions(o: Partial<PlotOptions>): void;
  /** Schedules a redraw on the next animation frame (multiple calls coalesce). */
  redraw(): void;
  /** Redraws synchronously. */
  drawNow(): void;
  destroy(): void;

  // Coordinate transforms (CSS px relative to the canvas' top-left corner).
  xToPx(x: number): number;
  yToPx(y: number): number;
  pxToX(px: number): number;
  pxToY(py: number): number;
  toPx(x: number, y: number): [number, number];
  fromPx(px: number, py: number): [number, number];
  /** Data coordinates of a mouse/pointer event over the canvas. */
  eventToData(ev: MouseEvent): [number, number];
  /** Resolves a color (CSS color or '--var' name) to a concrete CSS color string. */
  color(c: string | undefined): string;

  // Drawing primitives (data coordinates). Use them inside `draw`.
  /** Polyline through (xs[i], ys[i]); NaN values break the line. */
  line(xs: ArrayLike<number>, ys: ArrayLike<number>, style?: Style): void;
  /** Samples f across the visible x range at (device) pixel resolution. Non-finite values break the line. */
  fn(f: (x: number) => number, style?: Style): void;
  /** Vertical stems from `baseline` (default 0) to each value, with a dot at the tip. */
  stems(xs: ArrayLike<number>, ys: ArrayLike<number>, style?: Style & { baseline?: number; dot?: boolean }): void;
  /** Bars centred at xs with `barWidth` in data units (default 0.8 × smallest spacing). */
  bars(xs: ArrayLike<number>, ys: ArrayLike<number>, style?: Style & { barWidth?: number; baseline?: number }): void;
  /** Full-height vertical line, optionally labelled at the top (e.g. "f_s/2 (Nyquist)"). */
  vline(x: number, style?: Style, label?: string): void;
  /** Full-width horizontal line, optionally labelled at the right end. */
  hline(y: number, style?: Style, label?: string): void;
  /** Filled circle of `radius`. If `fill` differs from `color`, it gets an outline in `color` (e.g. `fill: '#fff'` = hollow marker). */
  point(x: number, y: number, style?: Style): void;
  /** Several points with the same style as {@link Plot.point}. */
  points(xs: ArrayLike<number>, ys: ArrayLike<number>, style?: Style): void;
  /** Text anchored at data coordinates. */
  text(x: number, y: number, str: string, opts?: TextOptions): void;
  /** Filled rectangle between two data corners. */
  rect(x0: number, y0: number, x1: number, y1: number, style?: Style): void;
  /** Full-height filled band between x0 and x1 (e.g. the range [0, f_s/2]). */
  band(x0: number, x1: number, style?: Style): void;
}

/** Picks a "nice" step (1, 2, 5 × 10^k) so that the range gets at most ~maxTicks ticks. */
export function niceStep(range: number, maxTicks: number): number {
  const raw = Math.abs(range) / Math.max(1, maxTicks);
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/** "Nice" tick positions covering [min, max] with at most ~maxTicks ticks. */
export function niceTicks(min: number, max: number, maxTicks = 6): number[] {
  if (min > max) [min, max] = [max, min];
  const step = niceStep(max - min, maxTicks);
  const eps = step * 1e-9;
  const ticks: number[] = [];
  for (let i = Math.ceil((min - eps) / step); i * step <= max + eps; i++) {
    ticks.push(Number((i * step).toPrecision(12)));
    if (ticks.length > 1000) break;
  }
  return ticks;
}

/** Number of decimals needed to show ticks with this step (0.25 → 2, 5 → 0). */
export function tickDecimals(step: number): number {
  if (!(step > 0)) return 0;
  for (let d = 0; d < 10; d++) {
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  }
  return 10;
}

interface Theme {
  font: string;
  fontSize: number;
  fontFamily: string;
  text: string;
  axis: string;
  grid: string;
  bg: string;
  legendBg: string;
}

/** Creates a plot inside `container` (which should be empty and have a CSS size). */
export function createPlot(container: HTMLElement, initial: PlotOptions): Plot {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  container.append(canvas);
  const ctx0 = canvas.getContext('2d');
  if (!ctx0) throw new Error('Canvas 2D not supported');
  const ctx: CanvasRenderingContext2D = ctx0;

  let options: PlotOptions = { grid: true, ...initial };
  let width = 0;
  let height = 0;
  let dpr = 1;
  const area: Area = { left: 0, top: 0, width: 1, height: 1 };
  let theme: Theme;
  const colorCache = new Map<string, string>();
  let frame = 0;
  let destroyed = false;

  function readTheme(): Theme {
    colorCache.clear();
    const cs = getComputedStyle(container);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const fontFamily = cs.fontFamily || 'system-ui, sans-serif';
    const v = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback;
    return {
      font: `${fontSize}px ${fontFamily}`,
      fontSize,
      fontFamily,
      text: v('--plot-text', '#222'),
      axis: v('--plot-axis', '#555'),
      grid: v('--plot-grid', '#e3e3e3'),
      bg: v('--plot-bg', '#fff'),
      legendBg: v('--plot-legend-bg', 'rgba(255,255,255,0.85)'),
    };
  }

  function color(c: string | undefined): string {
    if (!c) return theme?.text ?? '#222';
    if (!c.startsWith('--')) return c;
    let r = colorCache.get(c);
    if (r === undefined) {
      r = getComputedStyle(container).getPropertyValue(c).trim() || '#888';
      colorCache.set(c, r);
    }
    return r;
  }

  function fontOf(scale = 1, bold = false): string {
    return `${bold ? '600 ' : ''}${Math.round(theme.fontSize * scale * 10) / 10}px ${theme.fontFamily}`;
  }

  // --- transforms ---------------------------------------------------------
  const xToPx = (x: number): number => {
    const [a, b] = options.xRange;
    return area.left + ((x - a) / (b - a)) * area.width;
  };
  const yToPx = (y: number): number => {
    const [a, b] = options.yRange;
    return area.top + area.height - ((y - a) / (b - a)) * area.height;
  };
  const pxToX = (px: number): number => {
    const [a, b] = options.xRange;
    return a + ((px - area.left) / area.width) * (b - a);
  };
  const pxToY = (py: number): number => {
    const [a, b] = options.yRange;
    return a + ((area.top + area.height - py) / area.height) * (b - a);
  };
  // Clamp pixel values so huge numbers don't break canvas paths.
  const cl = (v: number): number => (v > 1e6 ? 1e6 : v < -1e6 ? -1e6 : v);

  function applyStroke(s: Style | undefined): void {
    ctx.strokeStyle = color(s?.color);
    ctx.lineWidth = s?.width ?? 2;
    ctx.setLineDash(s?.dash ?? []);
    ctx.globalAlpha = s?.alpha ?? 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
  }
  function applyFill(s: Style | undefined): void {
    ctx.fillStyle = color(s?.fill ?? s?.color);
    ctx.globalAlpha = s?.alpha ?? 1;
  }

  // --- layout & frame -----------------------------------------------------
  function ticksFor(axis: 'x' | 'y'): { ticks: number[]; format: (v: number) => string } {
    const range = axis === 'x' ? options.xRange : options.yRange;
    const explicit = axis === 'x' ? options.xTicks : options.yTicks;
    const custom = axis === 'x' ? options.xTickFormat : options.yTickFormat;
    const lenPx = axis === 'x' ? area.width : area.height;
    const spacing = axis === 'x' ? theme.fontSize * 5 : theme.fontSize * 2.6;
    const maxTicks = Math.max(2, Math.floor(lenPx / spacing));
    const ticks = explicit ?? niceTicks(range[0], range[1], maxTicks);
    const step = explicit ? 0 : niceStep(range[1] - range[0], maxTicks);
    const dec = explicit ? Math.max(0, ...explicit.map(tickDecimals)) : tickDecimals(step);
    return { ticks, format: custom ?? ((v) => formatNumber(v, dec)) };
  }

  function layout(): void {
    const fs = theme.fontSize;
    ctx.font = theme.font;
    // first pass with a provisional area to estimate y tick label widths
    area.left = fs * 3;
    area.top = fs * 0.6;
    area.height = Math.max(10, height - area.top - fs * (options.xLabel ? 3.1 : 1.9));
    const y = ticksFor('y');
    let maxW = 0;
    for (const t of y.ticks) maxW = Math.max(maxW, ctx.measureText(y.format(t)).width);
    area.left = Math.ceil(maxW + fs * 0.6 + (options.yLabel ? fs * 1.5 : 0) + 2);
    const right = fs * 1.2;
    area.width = Math.max(10, width - area.left - right);
  }

  function drawFrame(): void {
    const fs = theme.fontSize;
    const { left, top, width: w, height: h } = area;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    const x = ticksFor('x');
    const y = ticksFor('y');
    const inX = (v: number): boolean => v >= Math.min(...options.xRange) - 1e-12 && v <= Math.max(...options.xRange) + 1e-12;
    const inY = (v: number): boolean => v >= Math.min(...options.yRange) - 1e-12 && v <= Math.max(...options.yRange) + 1e-12;

    if (options.grid) {
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const t of x.ticks) if (inX(t)) {
        const px = Math.round(xToPx(t)) + 0.5;
        ctx.moveTo(px, top);
        ctx.lineTo(px, top + h);
      }
      for (const t of y.ticks) if (inY(t)) {
        const py = Math.round(yToPx(t)) + 0.5;
        ctx.moveTo(left, py);
        ctx.lineTo(left + w, py);
      }
      ctx.stroke();
    }

    // zero lines (axes through the origin), if visible
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (inY(0)) {
      const py = Math.round(yToPx(0)) + 0.5;
      ctx.moveTo(left, py);
      ctx.lineTo(left + w, py);
    }
    if (inX(0)) {
      const px = Math.round(xToPx(0)) + 0.5;
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + h);
    }
    ctx.stroke();

    // frame
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(left) + 0.5, Math.round(top) + 0.5, Math.round(w), Math.round(h));

    // tick labels
    ctx.fillStyle = theme.text;
    ctx.font = theme.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of x.ticks) if (inX(t)) ctx.fillText(x.format(t), xToPx(t), top + h + fs * 0.3);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of y.ticks) if (inY(t)) ctx.fillText(y.format(t), left - fs * 0.35, yToPx(t));

    // axis labels
    if (options.xLabel) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(options.xLabel, left + w / 2, height - 2);
    }
    if (options.yLabel) {
      ctx.save();
      ctx.translate(fs * 0.2, top + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(options.yLabel, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawLegend(): void {
    const items = options.legend;
    if (!items || items.length === 0) return;
    const fs = theme.fontSize;
    ctx.save();
    ctx.font = theme.font;
    const sw = fs * 1.8; // swatch width
    const pad = fs * 0.45;
    const lh = fs * 1.35;
    let textW = 0;
    for (const it of items) textW = Math.max(textW, ctx.measureText(it.label).width);
    const boxW = pad * 3 + sw + textW;
    const boxH = pad * 2 + lh * items.length - (lh - fs);
    const pos = options.legendPosition ?? 'top-right';
    const bx = pos.endsWith('right') ? area.left + area.width - boxW - pad : area.left + pad;
    const by = pos.startsWith('top') ? area.top + pad : area.top + area.height - boxH - pad;
    ctx.fillStyle = theme.legendBg;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);
    items.forEach((it, i) => {
      const cy = by + pad + fs / 2 + i * lh;
      const x0 = bx + pad;
      const c = color(it.color);
      ctx.strokeStyle = c;
      ctx.fillStyle = c;
      ctx.lineWidth = it.width ?? 2.5;
      ctx.setLineDash(it.dash ?? []);
      ctx.beginPath();
      switch (it.kind ?? 'line') {
        case 'line':
          ctx.moveTo(x0, cy);
          ctx.lineTo(x0 + sw, cy);
          ctx.stroke();
          break;
        case 'stem':
          ctx.moveTo(x0 + sw / 2, cy + fs * 0.45);
          ctx.lineTo(x0 + sw / 2, cy - fs * 0.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x0 + sw / 2, cy - fs * 0.2, fs * 0.22, 0, 2 * Math.PI);
          ctx.fill();
          break;
        case 'bar':
          ctx.fillRect(x0 + sw * 0.3, cy - fs * 0.45, sw * 0.4, fs * 0.9);
          break;
        case 'point':
          ctx.arc(x0 + sw / 2, cy, fs * 0.28, 0, 2 * Math.PI);
          ctx.fill();
          break;
        case 'band':
          ctx.fillRect(x0, cy - fs * 0.4, sw, fs * 0.8);
          break;
      }
      ctx.setLineDash([]);
      ctx.fillStyle = theme.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label, x0 + sw + pad, cy);
    });
    ctx.restore();
  }

  function resize(): boolean {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const d = window.devicePixelRatio || 1;
    if (w === width && h === height && d === dpr) return false;
    width = w;
    height = h;
    dpr = d;
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    return true;
  }

  function drawNow(): void {
    if (destroyed) return;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    resize();
    theme = readTheme();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    layout();
    drawFrame();
    if (options.draw) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.left, area.top, area.width, area.height);
      ctx.clip();
      options.draw(plot);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    drawLegend();
  }

  function redraw(): void {
    if (!frame && !destroyed) frame = requestAnimationFrame(() => {
      frame = 0;
      drawNow();
    });
  }

  // --- primitives ---------------------------------------------------------
  function line(xs: ArrayLike<number>, ys: ArrayLike<number>, style?: Style): void {
    applyStroke(style);
    ctx.beginPath();
    let pen = false;
    const n = Math.min(xs.length, ys.length);
    for (let i = 0; i < n; i++) {
      const x = xs[i];
      const y = ys[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        pen = false;
        continue;
      }
      const px = cl(xToPx(x));
      const py = cl(yToPx(y));
      if (pen) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      pen = true;
    }
    ctx.stroke();
  }

  function fn(f: (x: number) => number, style?: Style): void {
    const n = Math.max(2, Math.ceil(area.width * Math.min(dpr, 2)));
    const xs = new Float64Array(n + 1);
    const ys = new Float64Array(n + 1);
    const [a, b] = options.xRange;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      xs[i] = x;
      ys[i] = f(x);
    }
    line(xs, ys, style);
  }

  function stems(
    xs: ArrayLike<number>,
    ys: ArrayLike<number>,
    style?: Style & { baseline?: number; dot?: boolean },
  ): void {
    const base = yToPx(style?.baseline ?? 0);
    const n = Math.min(xs.length, ys.length);
    applyStroke(style);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(ys[i])) continue;
      const px = xToPx(xs[i]);
      ctx.moveTo(px, cl(base));
      ctx.lineTo(px, cl(yToPx(ys[i])));
    }
    ctx.stroke();
    if (style?.dot !== false) {
      applyFill(style);
      const r = style?.radius ?? 4.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (!Number.isFinite(ys[i])) continue;
        const px = xToPx(xs[i]);
        const py = cl(yToPx(ys[i]));
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, 2 * Math.PI);
      }
      ctx.fill();
    }
  }

  function bars(
    xs: ArrayLike<number>,
    ys: ArrayLike<number>,
    style?: Style & { barWidth?: number; baseline?: number },
  ): void {
    const n = Math.min(xs.length, ys.length);
    let bw = style?.barWidth;
    if (bw === undefined) {
      let minGap = Infinity;
      for (let i = 1; i < n; i++) minGap = Math.min(minGap, Math.abs(xs[i] - xs[i - 1]));
      bw = Number.isFinite(minGap) && minGap > 0 ? minGap * 0.8 : (options.xRange[1] - options.xRange[0]) / 50;
    }
    const base = yToPx(style?.baseline ?? 0);
    applyFill(style);
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(ys[i])) continue;
      const x0 = xToPx(xs[i] - bw / 2);
      const x1 = xToPx(xs[i] + bw / 2);
      const py = cl(yToPx(ys[i]));
      // at least 1 px wide so dense spectra stay visible
      const w = Math.max(1, Math.abs(x1 - x0));
      ctx.fillRect(Math.min(x0, x1), Math.min(base, py), w, Math.abs(py - base));
    }
  }

  function labelAt(str: string, px: number, py: number, align: CanvasTextAlign, baseline: CanvasTextBaseline, c: string): void {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = theme.font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    const w = ctx.measureText(str).width;
    const fs = theme.fontSize;
    const x0 = align === 'right' ? px - w : align === 'center' ? px - w / 2 : px;
    const y0 = baseline === 'top' ? py : baseline === 'bottom' ? py - fs : py - fs / 2;
    ctx.fillStyle = theme.legendBg;
    ctx.fillRect(x0 - 3, y0 - 2, w + 6, fs + 4);
    ctx.fillStyle = c;
    ctx.fillText(str, px, py);
    ctx.restore();
  }

  function vline(x: number, style?: Style, label?: string): void {
    const px = Math.round(xToPx(x)) + 0.5;
    applyStroke(style);
    ctx.beginPath();
    ctx.moveTo(px, area.top);
    ctx.lineTo(px, area.top + area.height);
    ctx.stroke();
    if (label) {
      ctx.font = theme.font;
      const w = ctx.measureText(label).width;
      const right = px + 6 + w <= area.left + area.width;
      labelAt(label, right ? px + 6 : px - 6, area.top + 4, right ? 'left' : 'right', 'top', color(style?.color));
    }
  }

  function hline(y: number, style?: Style, label?: string): void {
    const py = Math.round(yToPx(y)) + 0.5;
    applyStroke(style);
    ctx.beginPath();
    ctx.moveTo(area.left, py);
    ctx.lineTo(area.left + area.width, py);
    ctx.stroke();
    if (label) {
      const above = py - theme.fontSize - 6 >= area.top;
      labelAt(label, area.left + area.width - 6, above ? py - 4 : py + 4, 'right', above ? 'bottom' : 'top', color(style?.color));
    }
  }

  function points(xs: ArrayLike<number>, ys: ArrayLike<number>, style?: Style): void {
    const r = style?.radius ?? 5;
    applyFill(style);
    ctx.beginPath();
    const n = Math.min(xs.length, ys.length);
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) continue;
      const px = cl(xToPx(xs[i]));
      const py = cl(yToPx(ys[i]));
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, 2 * Math.PI);
    }
    ctx.fill();
    if (style?.fill && style.color && style.fill !== style.color) {
      applyStroke({ ...style, dash: [] });
      ctx.stroke();
    }
  }

  function text(x: number, y: number, str: string, o: TextOptions = {}): void {
    const px = xToPx(x) + (o.dx ?? 0);
    const py = yToPx(y) + (o.dy ?? 0);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = fontOf(o.scale ?? 1, o.bold);
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    if (o.background) {
      const m = ctx.measureText(str);
      const w = m.width;
      const asc = m.actualBoundingBoxAscent;
      const desc = m.actualBoundingBoxDescent;
      const x0 = ctx.textAlign === 'right' || ctx.textAlign === 'end' ? px - w : ctx.textAlign === 'center' ? px - w / 2 : px;
      ctx.fillStyle = theme.legendBg;
      ctx.fillRect(x0 - 3, py - asc - 3, w + 6, asc + desc + 6);
    }
    ctx.fillStyle = color(o.color);
    ctx.fillText(str, px, py);
    ctx.restore();
  }

  function rect(x0: number, y0: number, x1: number, y1: number, style?: Style): void {
    const a = cl(xToPx(x0));
    const b = cl(xToPx(x1));
    const c = cl(yToPx(y0));
    const d = cl(yToPx(y1));
    applyFill(style);
    ctx.fillRect(Math.min(a, b), Math.min(c, d), Math.abs(b - a), Math.abs(d - c));
  }

  function band(x0: number, x1: number, style?: Style): void {
    const a = cl(xToPx(x0));
    const b = cl(xToPx(x1));
    applyFill(style);
    ctx.fillRect(Math.min(a, b), area.top, Math.abs(b - a), area.height);
  }

  // --- wiring -------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    if (resize()) drawNow();
  });
  ro.observe(container);

  let mq: MediaQueryList | undefined;
  const onDprChange = (): void => {
    watchDpr();
    drawNow();
  };
  function watchDpr(): void {
    mq?.removeEventListener('change', onDprChange);
    mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener('change', onDprChange);
  }
  watchDpr();

  const plot: Plot = {
    container,
    canvas,
    ctx,
    get options() {
      return options;
    },
    area,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get fontSize() {
      return theme?.fontSize ?? 16;
    },
    setOptions(o) {
      options = { ...options, ...o };
      if (o.ariaLabel !== undefined) canvas.setAttribute('aria-label', o.ariaLabel);
      redraw();
    },
    redraw,
    drawNow,
    destroy() {
      destroyed = true;
      ro.disconnect();
      mq?.removeEventListener('change', onDprChange);
      if (frame) cancelAnimationFrame(frame);
      canvas.remove();
    },
    xToPx,
    yToPx,
    pxToX,
    pxToY,
    toPx: (x, y) => [xToPx(x), yToPx(y)],
    fromPx: (px, py) => [pxToX(px), pxToY(py)],
    eventToData(ev) {
      const r = canvas.getBoundingClientRect();
      return [pxToX(ev.clientX - r.left), pxToY(ev.clientY - r.top)];
    },
    color,
    line,
    fn,
    stems,
    bars,
    vline,
    hline,
    point: (x, y, style) => points([x], [y], style),
    points,
    text,
    rect,
    band,
  };

  if (options.ariaLabel) canvas.setAttribute('aria-label', options.ariaLabel);
  drawNow();
  return plot;
}
