import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { parseResults } from '@/components/catalogue/results-memory';

describe('saved catalogue results', () => {
  it('keeps the filtered URL and exact scroll position for the product that was opened', () => {
    const memory = {
      url: '/shop/?colour=green&shape=l-shape&page=2',
      product: '/product/green-sofa/',
      scroll: 843.5,
      returning: false,
    };
    expect(parseResults(JSON.stringify(memory))).toEqual(memory);
  });

  it('accepts category results as well as the whole shop', () => {
    expect(parseResults(JSON.stringify({
      url: '/sofas/l-shape/?material=velvet',
      product: '/product/green-sofa/',
      scroll: 0,
      returning: true,
    }))?.url).toBe('/sofas/l-shape/?material=velvet');
  });

  it.each(['', '{broken', 'null', '[]', '{}'])(
    'ignores missing or corrupt stored data: %s',
    (value) => expect(parseResults(value)).toBeNull(),
  );

  it.each([
    { url: 'https://example.com/' },
    { url: '//example.com/' },
    { url: '/\\example.com/' },
    { product: '/cart/' },
    { scroll: -1 },
    { scroll: '100' },
    { returning: 'yes' },
  ])('rejects unsafe or invalid stored fields: %o', (field) => {
    expect(parseResults(JSON.stringify({
      url: '/shop/', product: '/product/sofa/', scroll: 10, returning: false, ...field,
    }))).toBeNull();
  });
});
