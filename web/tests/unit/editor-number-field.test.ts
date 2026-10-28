import { describe, expect, it } from 'vitest';
import { numberOrEmpty } from '@/components/admin/products/editor-state';

describe('numberOrEmpty', () => {
  it('turns what is typed into a number', () => {
    expect(numberOrEmpty('3', null)).toBe(3);
    expect(numberOrEmpty('0.5', undefined)).toBe(0.5);
    expect(numberOrEmpty(12, null)).toBe(12);
  });

  it('keeps an empty field empty: null is not 0 (a product with no seat count must still save)', () => {
    expect(numberOrEmpty('', null)).toBeNull();
    expect(numberOrEmpty(null, null)).toBeNull();
    expect(numberOrEmpty(undefined, null)).toBeNull();
    expect(numberOrEmpty(null, undefined)).toBeUndefined();
  });

  it('treats something that is not a number as not set', () => {
    expect(numberOrEmpty('abc', null)).toBeNull();
    expect(numberOrEmpty(Number.NaN, undefined)).toBeUndefined();
  });

  it('keeps a real zero', () => {
    expect(numberOrEmpty('0', null)).toBe(0);
    expect(numberOrEmpty(0, null)).toBe(0);
  });
});
