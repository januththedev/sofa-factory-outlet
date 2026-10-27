import { describe, expect, it } from 'vitest';
import { formatLkr, LAKH_MINOR, parseLkr } from '@/lib/money';

describe('formatLkr', () => {
  it('formats whole rupees from minor units', () => {
    expect(formatLkr(0)).toBe('Rs. 0');
    expect(formatLkr(100)).toBe('Rs. 1');
    expect(formatLkr(12300)).toBe('Rs. 123');
    expect(formatLkr(1249000)).toBe('Rs. 12,490');
  });

  it('groups thousands with commas', () => {
    expect(formatLkr(125000000)).toBe('Rs. 1,250,000');
    expect(formatLkr(LAKH_MINOR)).toBe('Rs. 100,000');
    expect(formatLkr(12345678900)).toBe('Rs. 123,456,789');
  });

  it('keeps two decimals when asked', () => {
    expect(formatLkr(0, { decimals: true })).toBe('Rs. 0.00');
    expect(formatLkr(100, { decimals: true })).toBe('Rs. 1.00');
    expect(formatLkr(1249050, { decimals: true })).toBe('Rs. 12,490.50');
    expect(formatLkr(125000000, { decimals: true })).toBe('Rs. 1,250,000.00');
    expect(formatLkr(1234567, { decimals: true })).toBe('Rs. 12,345.67');
  });

  it('rounds minor units to the nearest rupee by default', () => {
    expect(formatLkr(1249)).toBe('Rs. 12');
    expect(formatLkr(1250)).toBe('Rs. 13');
    expect(formatLkr(1251)).toBe('Rs. 13');
    expect(formatLkr(1999)).toBe('Rs. 20');
    expect(formatLkr(1234567)).toBe('Rs. 12,346');
  });
});

describe('parseLkr', () => {
  it('parses plain rupees into minor units', () => {
    expect(parseLkr('12490')).toBe(1249000);
    expect(parseLkr('0')).toBe(0);
    expect(parseLkr('12')).toBe(1200);
    expect(parseLkr('12490.50')).toBe(1249050);
  });

  it('accepts "Rs." and "Rs" prefixes', () => {
    expect(parseLkr('Rs. 12,490')).toBe(1249000);
    expect(parseLkr('Rs 12,490')).toBe(1249000);
    expect(parseLkr('rs. 12490')).toBe(1249000);
    expect(parseLkr('RS. 99')).toBe(9900);
  });

  it('ignores commas and surrounding spaces', () => {
    expect(parseLkr('12,490')).toBe(1249000);
    expect(parseLkr(' 12 490 ')).toBe(1249000);
    expect(parseLkr('Rs. 1,250,000.00')).toBe(125000000);
    expect(parseLkr('1,25,000')).toBe(12500000);
  });

  it('rounds fractional rupees to whole minor units', () => {
    expect(parseLkr('0.29')).toBe(29);
    expect(parseLkr('1,23,456.789')).toBe(12345679);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseLkr('')).toBeNull();
    expect(parseLkr('   ')).toBeNull();
    expect(parseLkr('Rs.')).toBeNull();
    expect(parseLkr('Rs. ')).toBeNull();
    expect(parseLkr('abc')).toBeNull();
    expect(parseLkr('12,34a')).toBeNull();
    expect(parseLkr('1.234.5')).toBeNull();
    expect(parseLkr('Infinity')).toBeNull();
    expect(parseLkr('NaN')).toBeNull();
  });

  it('round-trips values formatted by formatLkr', () => {
    expect(parseLkr(formatLkr(1249000))).toBe(1249000);
    expect(parseLkr(formatLkr(125000000))).toBe(125000000);
    expect(parseLkr(formatLkr(1249050, { decimals: true }))).toBe(1249050);
  });
});

describe('LAKH_MINOR', () => {
  it('is one lakh in minor units', () => {
    expect(LAKH_MINOR).toBe(10_000_000);
    expect(LAKH_MINOR).toBe(100_000 * 100);
  });
});
