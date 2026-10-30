import { describe, expect, it } from 'vitest';
import { niceStep, niceTicks, tickDecimals } from './plot';

describe('nice ticks', () => {
  it('chooses 1/2/5 steps', () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(0.1, 5)).toBeCloseTo(0.02, 12);
    expect(niceStep(600, 6)).toBe(100);
    expect(niceStep(8000, 4)).toBe(2000);
  });

  it('covers the range without float noise', () => {
    expect(niceTicks(0, 0.1, 5)).toEqual([0, 0.02, 0.04, 0.06, 0.08, 0.1]);
    expect(niceTicks(-1.5, 1.5, 6)).toEqual([-1.5, -1, -0.5, 0, 0.5, 1, 1.5]);
    expect(niceTicks(-3, 3, 4)).toEqual([-2, 0, 2]);
  });

  it('derives decimals from the step', () => {
    expect(tickDecimals(0.02)).toBe(2);
    expect(tickDecimals(5)).toBe(0);
    expect(tickDecimals(0.5)).toBe(1);
  });
});
