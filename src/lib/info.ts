/**
 * Info tips: a small round "?" button next to a term that shows a short
 * explanation (hover, keyboard focus, or tap; Escape / leaving / tapping
 * elsewhere closes it). Only one tip is open at a time.
 *
 * From JS:
 *   figcaption.append(infoTerm('Betragsspektrum', 'Zeigt, wie stark jede Frequenz vorkommt.'));
 *   head.append(infoTip('f₀', 'Grundfrequenz: f₀ = 1/T.'));      // just the button
 *   slider(state, { key: 'fs', label: 'Abtastrate', info: '…' });  // controls.ts option
 *
 * From static HTML (wired automatically when this module is imported, which
 * controls.ts does; call initInfoTips() again for HTML inserted later):
 *   <span data-info="Kurze Erklärung …">Periode</span>
 *
 * The popup is `position: fixed` in <body> (so `overflow` never clips it) or,
 * while fullscreen is active, inside the fullscreen element (otherwise it
 * would be invisible). Styles: `.info-tip`, `.info-term`, `.info-popup` in page.css.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TipPlacement {
  left: number;
  top: number;
  side: 'top' | 'bottom';
  /** Horizontal position of the arrow tip relative to the popup's left edge. */
  arrowX: number;
}

/**
 * Places a popup of size `tip` above `anchor` (or below if there's not
 * enough room above), centred on it and shifted so it stays `margin` px
 * inside the viewport. If it fits on neither side, the side with more room
 * is used and the popup is clamped to the viewport.
 */
export function placeTip(anchor: Rect, tip: Size, viewport: Size, gap = 8, margin = 8): TipPlacement {
  const above = anchor.top - gap - margin;
  const below = viewport.height - (anchor.top + anchor.height) - gap - margin;
  const side: 'top' | 'bottom' = tip.height <= above || (tip.height > below && above >= below) ? 'top' : 'bottom';
  let top = side === 'top' ? anchor.top - gap - tip.height : anchor.top + anchor.height + gap;
  top = clamp(top, margin, Math.max(margin, viewport.height - margin - tip.height));

  const centre = anchor.left + anchor.width / 2;
  const left = clamp(centre - tip.width / 2, margin, Math.max(margin, viewport.width - margin - tip.width));
  const arrowX = clamp(centre - left, 12, Math.max(12, tip.width - 12));
  return { left, top, side, arrowX };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Where the popup must live: inside the fullscreen element if one is active, else in <body>. */
export function tipContainer<E>(fullscreenEl: E | null | undefined, body: E): E {
  return fullscreenEl ?? body;
}

// ---------------------------------------------------------------------------
// DOM part

/**
 * The "?" button alone. `term` gives the accessible name ("Info: <term>"),
 * `text` is the explanation (plain text; use Unicode for symbols, e.g. f₀, fₛ, π).
 * Put it right after the term; prefer `infoTerm()` so they never wrap apart.
 */
export function infoTip(term: string, text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'info-tip';
  b.dataset.info = text;
  b.dataset.term = term;
  upgradeButton(b);
  return b;
}

/**
 * `<span class="info-term">term<button class="info-tip">?</button></span>`:
 * the term plus its tip, kept on one line. `term` may be text or a node
 * (e.g. `symbolFragment('f_0')`); pass `name` for the accessible name if it's a node.
 */
export function infoTerm(term: string | Node, text: string, name?: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'info-term';
  span.append(term);
  span.append(infoTip(name ?? span.textContent ?? '', text));
  return span;
}

const INTERACTIVE = new Set(['A', 'BUTTON', 'INPUT', 'LABEL', 'SELECT', 'TEXTAREA', 'SUMMARY', 'OUTPUT']);

function upgradeButton(b: HTMLButtonElement): void {
  b.type = 'button';
  b.classList.add('info-tip');
  if (!b.textContent?.trim()) b.textContent = '?';
  if (!b.hasAttribute('aria-label')) {
    const term = b.dataset.term?.trim();
    b.setAttribute('aria-label', term ? `Info: ${term}` : 'Info');
  }
}

/**
 * Wires static markup under `root` (idempotent):
 * - `<span data-info="…">Term</span>` gets a "?" button appended inside and
 *   class `info-term` (kept on one line). On interactive elements (button,
 *   a, label, input …) the button is inserted *after* the element instead.
 * - `<button class="info-tip" data-info="…" data-term="Term"></button>` gets
 *   its "?" text and aria-label.
 */
export function initInfoTips(root: ParentNode = document): void {
  for (const b of root.querySelectorAll<HTMLButtonElement>('button.info-tip')) upgradeButton(b);
  for (const el of root.querySelectorAll<HTMLElement>('[data-info]:not(.info-tip)')) {
    const text = el.dataset.info ?? '';
    delete el.dataset.info;
    const term = el.dataset.term ?? el.textContent?.trim() ?? '';
    const b = infoTip(term, text);
    if (INTERACTIVE.has(el.tagName)) {
      el.after(b);
    } else {
      el.classList.add('info-term');
      el.append(b);
    }
  }
}

// --- one shared popup, delegated listeners ---------------------------------

const POPUP_ID = 'info-tip-popup';
let popup: HTMLDivElement | undefined;
let openBtn: HTMLButtonElement | null = null;
/** Opened by click/tap: stays open when the pointer leaves. */
let pinned = false;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
/** Button that received pointerdown: its focus comes from the click, which handles opening. */
let pressed: HTMLButtonElement | null = null;
let rafId = 0;
/**
 * Watches the DOM only while a tip is open: closes it as soon as its button is
 * removed (demos re-render readouts) and follows layout shifts otherwise.
 */
let observer: MutationObserver | undefined;

function onMutation(): void {
  if (!openBtn) return;
  if (!openBtn.isConnected) close();
  else schedulePosition();
}

type WebkitDoc = Document & { webkitFullscreenElement?: Element | null };

function fullscreenElement(): HTMLElement | null {
  const d = document as WebkitDoc;
  return (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) as HTMLElement | null;
}

function getPopup(): HTMLDivElement {
  if (!popup) {
    popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.className = 'info-popup';
    popup.setAttribute('role', 'tooltip');
    popup.hidden = true;
  }
  return popup;
}

function tipButton(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest<HTMLButtonElement>('button.info-tip') : null;
}

function inPopup(target: EventTarget | null): boolean {
  return !!popup && target instanceof Node && popup.contains(target);
}

function cancelClose(): void {
  if (closeTimer !== undefined) clearTimeout(closeTimer);
  closeTimer = undefined;
}

function open(b: HTMLButtonElement, pin: boolean): void {
  cancelClose();
  if (openBtn && openBtn !== b) close();
  pinned = pin;
  if (openBtn === b) return;
  const p = getPopup();
  const container = tipContainer(fullscreenElement(), document.body);
  if (p.parentElement !== container) container.append(p);
  p.textContent = b.dataset.info ?? '';
  // Projector-readable: 0.9 × the font size of the surrounding area (lecture or self-study part).
  const base = b.closest<HTMLElement>('.lecture, .explain') ?? document.body;
  p.style.fontSize = `${0.9 * parseFloat(getComputedStyle(base).fontSize)}px`;
  p.hidden = false;
  openBtn = b;
  b.dataset.open = '';
  b.setAttribute('aria-describedby', POPUP_ID);
  observer ??= new MutationObserver(onMutation);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  position();
}

function close(): void {
  cancelClose();
  if (!openBtn) return;
  delete openBtn.dataset.open;
  openBtn.removeAttribute('aria-describedby');
  openBtn = null;
  pinned = false;
  if (popup) popup.hidden = true;
  observer?.disconnect();
}

function scheduleClose(): void {
  if (pinned || !openBtn) return;
  cancelClose();
  closeTimer = setTimeout(close, 150);
}

function position(): void {
  if (!openBtn || !popup) return;
  if (!openBtn.isConnected || openBtn.getClientRects().length === 0) {
    close();
    return;
  }
  popup.style.left = '0px';
  popup.style.top = '0px';
  const r = openBtn.getBoundingClientRect();
  const t = popup.getBoundingClientRect();
  const root = document.documentElement;
  const vp = { width: root.clientWidth || innerWidth, height: root.clientHeight || innerHeight };
  if (r.bottom < 0 || r.top > vp.height) {
    close(); // anchor scrolled out of view
    return;
  }
  const pl = placeTip(r, t, vp);
  popup.style.left = `${Math.round(pl.left)}px`;
  popup.style.top = `${Math.round(pl.top)}px`;
  popup.style.setProperty('--arrow-x', `${Math.round(pl.arrowX)}px`);
  popup.dataset.side = pl.side;
}

function schedulePosition(): void {
  if (!openBtn || rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    position();
  });
}

function install(): void {
  const doc = document;
  doc.addEventListener('pointerover', (e) => {
    const b = tipButton(e.target);
    if (b || inPopup(e.target)) cancelClose();
    if (b && e.pointerType !== 'touch') open(b, b === openBtn && pinned);
  });
  doc.addEventListener('pointerout', (e) => {
    if (!openBtn || e.pointerType === 'touch') return;
    const from = tipButton(e.target) === openBtn || inPopup(e.target);
    const to = tipButton(e.relatedTarget) === openBtn || inPopup(e.relatedTarget);
    if (from && !to) scheduleClose();
  });
  doc.addEventListener(
    'pointerdown',
    (e) => {
      const b = tipButton(e.target);
      pressed = b;
      if (openBtn && b !== openBtn && !inPopup(e.target)) close();
    },
    true,
  );
  // A press that ends without a click (dragged away) must not swallow the next keyboard focus.
  // (Touch focuses after pointerup; focusin then opens and the click pins, so the tip still opens.)
  const release = (): void => {
    pressed = null;
  };
  doc.addEventListener('pointerup', release, true);
  doc.addEventListener('pointercancel', release, true);
  doc.addEventListener('click', (e) => {
    const b = tipButton(e.target);
    pressed = null;
    if (!b) return;
    e.preventDefault();
    if (b === openBtn && pinned) close();
    else open(b, true);
  });
  doc.addEventListener('focusin', (e) => {
    const b = tipButton(e.target);
    const fromPointer = b !== null && b === pressed;
    pressed = null;
    if (b && !fromPointer) open(b, false);
  });
  doc.addEventListener('focusout', (e) => {
    if (openBtn && tipButton(e.target) === openBtn && !inPopup(e.relatedTarget)) close();
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openBtn) {
      close();
      e.stopPropagation();
    }
  });
  doc.addEventListener('fullscreenchange', close);
  doc.addEventListener('webkitfullscreenchange', close);
  addEventListener('resize', schedulePosition);
  addEventListener('scroll', schedulePosition, { capture: true, passive: true });
}

if (typeof document !== 'undefined') {
  install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initInfoTips());
  else initInfoTips();
}
