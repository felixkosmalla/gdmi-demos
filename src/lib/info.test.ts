import { describe, expect, it } from 'vitest';
import { placeTip, tipContainer } from './info';

const vp = { width: 390, height: 800 };
const tip = { width: 300, height: 80 };

describe('placeTip', () => {
  it('prefers above, centred on the anchor', () => {
    const p = placeTip({ left: 180, top: 400, width: 20, height: 20 }, tip, vp);
    expect(p.side).toBe('top');
    expect(p.top).toBe(400 - 8 - 80);
    expect(p.left).toBe(190 - 150);
    expect(p.arrowX).toBe(150);
  });

  it('flips below when there is no room above', () => {
    const p = placeTip({ left: 180, top: 20, width: 20, height: 20 }, tip, vp);
    expect(p.side).toBe('bottom');
    expect(p.top).toBe(20 + 20 + 8);
  });

  it('shifts to stay inside the viewport at the edges, arrow still points at the anchor', () => {
    const right = placeTip({ left: 350, top: 400, width: 20, height: 20 }, tip, vp);
    expect(right.left).toBe(390 - 8 - 300);
    expect(right.left + tip.width).toBeLessThanOrEqual(390 - 8);
    expect(right.left + right.arrowX).toBe(360);

    const left = placeTip({ left: 2, top: 400, width: 20, height: 20 }, tip, vp);
    expect(left.left).toBe(8);
    expect(left.arrowX).toBe(12); // clamped away from the rounded corner
  });

  it('uses the side with more room if it fits on neither and clamps to the viewport', () => {
    const tall = { width: 300, height: 500 };
    const p = placeTip({ left: 180, top: 300, width: 20, height: 20 }, tall, vp);
    expect(p.side).toBe('bottom');
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + tall.height).toBeLessThanOrEqual(800 - 8);
  });

  it('never goes left of the margin when the tip is wider than the viewport', () => {
    const p = placeTip({ left: 100, top: 400, width: 20, height: 20 }, { width: 500, height: 80 }, vp);
    expect(p.left).toBe(8);
  });
});

describe('tipContainer', () => {
  it('uses the fullscreen element while fullscreen is active, else body', () => {
    expect(tipContainer('lecture', 'body')).toBe('lecture');
    expect(tipContainer(null, 'body')).toBe('body');
    expect(tipContainer(undefined, 'body')).toBe('body');
  });
});
