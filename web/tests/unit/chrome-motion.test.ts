import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { skipCurtain } from '@/components/site/motion-policy';

describe('curtain motion policy', () => {
  it.each([320, 360, 390, 430, 767])('navigates immediately at %i px with a fine pointer', (width) => {
    expect(skipCurtain(false, false, width)).toBe(true);
  });

  it('keeps the curtain at the desktop breakpoint with a fine pointer', () => {
    expect(skipCurtain(false, false, 768)).toBe(false);
    expect(skipCurtain(false, false, 1440)).toBe(false);
  });

  it('skips the curtain for touch pointers even on wide screens', () => {
    expect(skipCurtain(false, true, 1440)).toBe(true);
  });

  it('skips the curtain for reduced motion at every size and pointer type', () => {
    expect(skipCurtain(true, false, 1440)).toBe(true);
    expect(skipCurtain(true, false, 320)).toBe(true);
    expect(skipCurtain(true, true, 1440)).toBe(true);
  });
});
