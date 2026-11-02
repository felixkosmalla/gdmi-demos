/**
 * Labelled form controls bound to a state object that lives in the URL query
 * string, so every configuration is linkable (e.g. `abtastung/?fs=150`).
 *
 *   const state = urlState({ fs: 150, c140: true, sig: 'rechteck' });
 *   controls.append(slider(state, { key: 'fs', label: 'Abtastrate', symbol: 'f_s', min: 20, max: 600, unit: 'Hz' }));
 *   state.subscribe(() => plot.redraw());
 */
import { demos } from '../demos';
import { infoTip } from './info';

// Info tips are re-exported so demos can import everything from here.
export { infoTerm, infoTip, initInfoTips } from './info';

export type Primitive = number | boolean | string;
export type StateValues = Record<string, Primitive>;

/** Widens literal default types: `{ sig: 'a' }` → `{ sig: string }`. */
export type Widen<T extends StateValues> = {
  [K in keyof T]: T[K] extends number ? number : T[K] extends boolean ? boolean : string;
};

export interface UrlState<T extends StateValues> {
  /** Current values. Read-only view; change them through `set`/`update`. */
  readonly values: Readonly<T>;
  /** The defaults passed to `urlState`. */
  readonly defaults: Readonly<T>;
  /** Keys that were present (and valid) in the query string at page load. */
  readonly fromUrl: ReadonlySet<keyof T>;
  get<K extends keyof T>(key: K): T[K];
  /** Sets one value, notifies subscribers synchronously, writes the URL (debounced). */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /** Sets several values at once with a single notification. */
  update(partial: Partial<T>): void;
  /** Restores all defaults. */
  reset(): void;
  /**
   * Calls `fn(values, changedKeys)` after every change. Returns an unsubscribe
   * function. Not called for the initial state; call your render function once yourself.
   */
  subscribe(fn: (values: Readonly<T>, changed: ReadonlyArray<keyof T>) => void): () => void;
  /** Writes pending URL changes immediately. */
  flush(): void;
}

export interface UrlStateOptions {
  /** Delay for `history.replaceState` in ms. Default 150. */
  debounceMs?: number;
}

/** Parses a query value into the type of `def`; returns undefined if invalid. */
export function parseValue(raw: string, def: Primitive): Primitive | undefined {
  if (typeof def === 'number') {
    if (raw.trim() === '') return undefined;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof def === 'boolean') {
    const s = raw.toLowerCase();
    if (['1', 'true', 'on', 'yes', 'ja', ''].includes(s)) return true;
    if (['0', 'false', 'off', 'no', 'nein'].includes(s)) return false;
    return undefined;
  }
  return raw;
}

/** Serialises a value for the query string (booleans as 1/0). */
export function serializeValue(v: Primitive): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

/**
 * Creates the page state from `defaults`, overridden by matching query
 * parameters (types are coerced from the defaults: number, boolean, string).
 * Only values that differ from the defaults are written back to the URL;
 * unrelated query parameters are kept.
 */
export function urlState<D extends StateValues>(defaults: D, options: UrlStateOptions = {}): UrlState<Widen<D>> {
  type T = Widen<D>;
  const defs = { ...defaults } as unknown as T;
  const values = { ...defs } as T;
  const fromUrl = new Set<keyof T>();
  const params = new URLSearchParams(location.search);
  for (const key of Object.keys(defs) as (keyof T & string)[]) {
    const raw = params.get(key);
    if (raw === null) continue;
    const parsed = parseValue(raw, defs[key]);
    if (parsed !== undefined) {
      values[key] = parsed as T[typeof key];
      fromUrl.add(key);
    }
  }

  const subscribers = new Set<(v: Readonly<T>, changed: ReadonlyArray<keyof T>) => void>();
  const debounceMs = options.debounceMs ?? 150;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function writeUrl(): void {
    timer = undefined;
    const p = new URLSearchParams(location.search);
    for (const key of Object.keys(defs) as (keyof T & string)[]) {
      if (values[key] === defs[key]) p.delete(key);
      else p.set(key, serializeValue(values[key]));
    }
    const qs = p.toString();
    const url = location.pathname + (qs ? `?${qs}` : '') + location.hash;
    history.replaceState(history.state, '', url);
  }

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(writeUrl, debounceMs);
  }

  function flush(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      writeUrl();
    }
  }
  addEventListener('pagehide', flush);

  function apply(partial: Partial<T>): void {
    const changed: (keyof T)[] = [];
    for (const key of Object.keys(partial) as (keyof T)[]) {
      if (!(key in defs)) throw new Error(`urlState: unknown key "${String(key)}"`);
      const v = partial[key] as T[keyof T];
      if (typeof v !== typeof defs[key]) throw new Error(`urlState: wrong type for "${String(key)}"`);
      if (values[key] !== v) {
        values[key] = v;
        changed.push(key);
      }
    }
    if (changed.length === 0) return;
    schedule();
    for (const fn of subscribers) fn(values, changed);
  }

  return {
    values,
    defaults: defs,
    fromUrl,
    get: (key) => values[key],
    set: (key, value) => apply({ [key]: value } as unknown as Partial<T>),
    update: apply,
    reset: () => apply({ ...defs }),
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    flush,
  };
}

// ---------------------------------------------------------------------------
// Formatting & DOM helpers

const formatters = new Map<number, Intl.NumberFormat>();

/** German number formatting with a fixed number of decimals and no digit grouping ("0,25", "8000"). */
export function formatNumber(v: number, decimals = 0): string {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: false,
    });
    formatters.set(decimals, f);
  }
  return f.format(v === 0 ? 0 : v); // avoid "-0"
}

/** Number of decimals implied by a step size (0.01 → 2, 5 → 0). */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = String(step);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/**
 * Nearest slider value min + k·step within [min, max] (like a range input:
 * below an off-grid max), rounded to the decimals of min and step, so 0.29
 * with step 0.1 gives 0.3, not 0.30000000000000004.
 */
export function snapToStep(v: number, min: number, max: number, step: number): number {
  const kMax = Math.floor((max - min) / step + 1e-9);
  const k = Math.min(kMax, Math.max(0, Math.round((v - min) / step)));
  const decimals = Math.max(decimalsOf(step), decimalsOf(min));
  return Number((min + k * step).toFixed(decimals)) + 0; // + 0 turns −0 into 0
}

/** `document.querySelector` that throws a helpful error instead of returning null. */
export function qs<E extends Element = HTMLElement>(selector: string, root: ParentNode = document): E {
  const el = root.querySelector<E>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

/**
 * Renders a symbol like "f_s" or "f_{max}" as text with a <sub> part
 * (f<sub>s</sub>). Text without "_" is returned as is.
 */
export function symbolFragment(symbol: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const m = /^(.*?)_(?:\{([^}]*)\}|(\S+))(.*)$/.exec(symbol);
  if (!m) {
    frag.append(symbol);
    return frag;
  }
  const sub = document.createElement('sub');
  sub.textContent = m[2] ?? m[3];
  frag.append(m[1], sub);
  if (m[4]) frag.append(symbolFragment(m[4]));
  return frag;
}

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T] & string;

/**
 * Returns `label` alone, or (with `info`) `<span class="control-name">label ?</span>`.
 * The "?" button sits next to the label element, not inside it, so it doesn't
 * end up in the control's accessible name.
 */
function withInfo(label: HTMLElement, term: string, info: string | undefined): HTMLElement {
  if (!info) return label;
  const name = document.createElement('span');
  name.className = 'control-name';
  name.append(label, infoTip(term, info));
  return name;
}

// ---------------------------------------------------------------------------
// Control factories. Each returns an element; append it where you want it.

export interface SliderOptions<T extends StateValues> {
  key: KeysOfType<T, number>;
  /** Visible label, e.g. "Abtastrate". */
  label: string;
  /** Symbol for the readout, e.g. "f_s" → "f_s = 150 Hz". Without it the readout shows only the value. */
  symbol?: string;
  min: number;
  max: number;
  /** Default 1. */
  step?: number;
  /** Unit appended to the readout, e.g. "Hz". */
  unit?: string;
  /** Custom readout text for a value (replaces "value unit"). */
  format?: (v: number) => string;
  /** Short explanation shown by a "?" info tip next to the label (see info.ts). */
  info?: string;
}

/**
 * Range slider bound to a numeric state key, with label and live readout.
 * Updates the state on every `input` event (so the URL follows while dragging).
 * A value from the URL is clamped to [min, max] and snapped to the step grid (see `snapToStep`).
 */
export function slider<T extends StateValues>(state: UrlState<T>, o: SliderOptions<T>): HTMLElement {
  const step = o.step ?? 1;
  const decimals = decimalsOf(step);
  const id = uid(`ctl-${o.key}`);

  const wrap = document.createElement('div');
  wrap.className = 'control control-slider';
  const head = document.createElement('div');
  head.className = 'control-head';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = o.label;
  const out = document.createElement('output');
  out.htmlFor.add(id);
  out.className = 'readout';
  head.append(withInfo(label, o.label, o.info), out);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(o.min);
  input.max = String(o.max);
  input.step = String(step);
  wrap.append(head, input);

  const text = (v: number): string =>
    o.format ? o.format(v) : `${formatNumber(v, decimals)}${o.unit ? ` ${o.unit}` : ''}`;

  function render(): void {
    const v = state.get(o.key) as number;
    input.value = String(v);
    const t = text(v);
    out.replaceChildren();
    if (o.symbol) out.append(symbolFragment(o.symbol), ` = ${t}`);
    else out.append(t);
    input.setAttribute('aria-valuetext', o.symbol ? `${o.symbol.replace(/[_{}]/g, '')} = ${t}` : t);
  }

  input.addEventListener('input', () => {
    state.set(o.key, Number(input.value) as T[typeof o.key]);
  });
  state.subscribe((_, changed) => {
    if (changed.includes(o.key)) render();
  });

  const v = state.get(o.key) as number;
  const snapped = snapToStep(v, o.min, o.max, step);
  if (snapped !== v) state.set(o.key, snapped as T[typeof o.key]);
  render();
  return wrap;
}

export interface ToggleOptions<T extends StateValues> {
  key: KeysOfType<T, boolean>;
  label: string;
  /** Optional CSS color shown as a small swatch before the label (e.g. a signal's color). */
  swatch?: string;
  /** Short explanation shown by a "?" info tip after the label (see info.ts). */
  info?: string;
}

/**
 * Checkbox bound to a boolean state key. Returns `label.control-toggle`; with
 * `info` a `span.control-toggle.has-info` holding that label and the "?" button.
 */
export function toggle<T extends StateValues>(state: UrlState<T>, o: ToggleOptions<T>): HTMLElement {
  const label = document.createElement('label');
  label.className = o.info ? 'toggle-label' : 'control control-toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  label.append(input);
  if (o.swatch) {
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = o.swatch;
    label.append(sw);
  }
  label.append(o.label);
  input.addEventListener('change', () => state.set(o.key, input.checked as T[typeof o.key]));
  const render = (): void => {
    input.checked = state.get(o.key) as boolean;
  };
  state.subscribe((_, changed) => {
    if (changed.includes(o.key)) render();
  });
  render();
  if (!o.info) return label;
  const wrap = document.createElement('span');
  wrap.className = 'control control-toggle has-info';
  wrap.append(label, infoTip(o.label, o.info));
  return wrap;
}

export interface SelectOption<V extends Primitive> {
  value: V;
  label: string;
}

export interface SelectOptions<T extends StateValues, K extends keyof T & string> {
  key: K;
  label: string;
  options: ReadonlyArray<SelectOption<T[K]>>;
  /**
   * `'buttons'` (default): a row of toggle buttons (good for presets in the lecture).
   * `'dropdown'`: a native <select>.
   */
  variant?: 'buttons' | 'dropdown';
  /** Short explanation shown by a "?" info tip next to the label (see info.ts). */
  info?: string;
}

/**
 * Choice among fixed values for a string or number state key, rendered as a
 * button group (aria-pressed) or a native <select>. A value from the URL that
 * is not among the options is replaced by the default.
 */
export function select<T extends StateValues, K extends keyof T & string>(
  state: UrlState<T>,
  o: SelectOptions<T, K>,
): HTMLElement {
  const values = o.options.map((opt) => opt.value);
  if (!values.includes(state.get(o.key))) {
    state.set(o.key, values.includes(state.defaults[o.key]) ? state.defaults[o.key] : values[0]);
  }

  if (o.variant === 'dropdown') {
    const id = uid(`ctl-${o.key}`);
    const wrap = document.createElement('div');
    wrap.className = 'control control-select';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = o.label;
    const sel = document.createElement('select');
    sel.id = id;
    o.options.forEach((opt, i) => sel.add(new Option(opt.label, String(i))));
    sel.addEventListener('change', () => state.set(o.key, values[Number(sel.value)]));
    const render = (): void => {
      sel.value = String(values.indexOf(state.get(o.key)));
    };
    state.subscribe((_, changed) => {
      if (changed.includes(o.key)) render();
    });
    render();
    wrap.append(withInfo(label, o.label, o.info), sel);
    return wrap;
  }

  const wrap = document.createElement('div');
  wrap.className = 'control control-choice';
  wrap.setAttribute('role', 'group');
  const labelId = uid(`ctl-${o.key}-label`);
  wrap.setAttribute('aria-labelledby', labelId);
  const label = document.createElement('span');
  label.className = 'control-label';
  label.id = labelId;
  label.textContent = o.label;
  const row = document.createElement('div');
  row.className = 'button-row';
  const buttons = o.options.map((opt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = opt.label;
    b.addEventListener('click', () => state.set(o.key, opt.value));
    row.append(b);
    return b;
  });
  const render = (): void => {
    const cur = state.get(o.key);
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(values[i] === cur)));
  };
  state.subscribe((_, changed) => {
    if (changed.includes(o.key)) render();
  });
  render();
  wrap.append(withInfo(label, o.label, o.info), row);
  return wrap;
}

export interface ButtonOptions {
  label: string;
  onClick: (ev: MouseEvent) => void;
  /** `'primary'` = filled accent button (e.g. Play). Default `'secondary'`. */
  variant?: 'primary' | 'secondary';
  title?: string;
}

/** Plain button (e.g. "150 Hz" quick presets or Play/Stop). */
export function button(o: ButtonOptions): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = o.variant === 'primary' ? 'btn btn-primary' : 'btn';
  b.textContent = o.label;
  if (o.title) b.title = o.title;
  b.addEventListener('click', o.onClick);
  return b;
}

/**
 * Labelled row of controls or buttons (e.g. presets, toggles) with role="group".
 * `label` may be `{ label, info }` to add a "?" info tip next to it.
 */
export function group(label: string | { label: string; info?: string }, ...children: HTMLElement[]): HTMLElement {
  const { label: text, info } = typeof label === 'string' ? { label } : label;
  const wrap = document.createElement('div');
  wrap.className = 'control';
  wrap.setAttribute('role', 'group');
  const l = document.createElement('span');
  l.className = 'control-label';
  l.textContent = text;
  l.id = uid('grp');
  wrap.setAttribute('aria-labelledby', l.id);
  const row = document.createElement('div');
  row.className = 'button-row';
  row.append(...children);
  wrap.append(withInfo(l, text, info), row);
  return wrap;
}

/**
 * Short "Idee nach: …" line built from the demo's `replaces` entry in
 * src/demos.ts. Demos now show their sources in a `p.sources` line under the
 * <h1> instead (see page.css); this stays for pages without one.
 */
export function ideaCredit(slug: string): HTMLParagraphElement {
  const demo = demos.find((d) => d.slug === slug);
  if (!demo) throw new Error(`ideaCredit: no entry for "${slug}" in src/demos.ts`);
  const p = document.createElement('p');
  p.className = 'credit';
  p.textContent = `Idee nach: ${demo.replaces}`;
  return p;
}

/** "Zurücksetzen" button that restores all defaults of `state`. */
export function resetButton<T extends StateValues>(state: UrlState<T>, label = 'Zurücksetzen'): HTMLButtonElement {
  return button({ label, onClick: () => state.reset(), title: 'Alle Einstellungen auf Standardwerte zurücksetzen' });
}

/**
 * Button that toggles fullscreen for `element` (usually the `.lecture` area).
 * Hidden when the browser has no fullscreen API (e.g. iPhone Safari).
 */
export function fullscreenButton(element: HTMLElement): HTMLButtonElement {
  type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
  type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };
  const doc = document as WebkitDoc;
  const el = element as WebkitEl;
  const current = (): Element | null => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

  const b = button({
    label: 'Vollbild',
    title: 'Vortragsbereich im Vollbild anzeigen',
    onClick: () => {
      if (current()) {
        if (doc.exitFullscreen) void doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        void el.requestFullscreen();
      } else {
        el.webkitRequestFullscreen?.();
      }
    },
  });
  if (!el.requestFullscreen && !el.webkitRequestFullscreen) b.hidden = true;
  const update = (): void => {
    const on = current() === element;
    b.textContent = on ? 'Vollbild beenden' : 'Vollbild';
    b.setAttribute('aria-pressed', String(on));
  };
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('webkitfullscreenchange', update);
  update();
  return b;
}
