import { describe, expect, it } from 'vitest';
import { formatNumber } from './controls';

describe('formatNumber', () => {
  it('formats with German decimals and no grouping', () => {
    expect(formatNumber(0.25, 2)).toBe('0,25');
    expect(formatNumber(8000)).toBe('8000');
    expect(formatNumber(-1.5, 1)).toBe('-1,5');
  });

  it('never prints "-0": values that round to zero have no sign', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-0.24)).toBe('0');
    expect(formatNumber(-0.004, 2)).toBe('0,00');
    expect(formatNumber(-1e-12, 1)).toBe('0,0');
    expect(formatNumber(-0.6)).toBe('-1');
    expect(formatNumber(-0.005, 2)).toBe('-0,01');
  });
});
