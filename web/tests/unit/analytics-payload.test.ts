import { describe, expect, it } from 'vitest';
import { parseTrackPayload } from '@/lib/analytics/server';

const ID = '01234567-89ab-cdef-0123-456789abcdef';
const valid = {
  type: 'page_view',
  visitorId: ID,
  sessionId: ID,
  path: '/product/l-shape-sofa/',
  referrer: 'https://www.google.com/search?q=sofa',
  utm: { source: 'google', medium: 'cpc', campaign: 'autumn' },
};

const body = (patch: Record<string, unknown> = {}) => JSON.stringify({ ...valid, ...patch });

describe('parseTrackPayload', () => {
  it('accepts a payload from the browser tracker', () => {
    const result = parseTrackPayload(body());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload).toMatchObject({ type: 'page_view', path: '/product/l-shape-sofa/' });
  });

  it('accepts optional product, variant and value fields', () => {
    const result = parseTrackPayload(
      body({
        type: 'add_to_cart',
        productId: 685,
        variantId: 1234,
        value: { colour: 'Cream', quantity: 2, gift: false, note: null },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.productId).toBe(685);
  });

  const invalidCases: Array<[string, Record<string, unknown>]> = [
    ['an unknown event type', { type: 'purchase' }],
    ['a short visitor id', { visitorId: 'abc' }],
    ['a visitor id longer than 64 characters', { visitorId: 'v'.repeat(65) }],
    ['a short session id', { sessionId: 'abc' }],
    ['an empty path', { path: '' }],
    ['a path longer than 300 characters', { path: `/${'p'.repeat(300)}` }],
    ['a negative product id', { productId: -1 }],
    ['a non-integer variant id', { variantId: 1.5 }],
  ];

  it.each(invalidCases)('rejects %s', (label, patch) => {
    expect(parseTrackPayload(body(patch)).ok, label).toBe(false);
  });

  it('rejects a value over 1 KB', () => {
    const large = {
      a: 'x'.repeat(190),
      b: 'x'.repeat(190),
      c: 'x'.repeat(190),
      d: 'x'.repeat(190),
      e: 'x'.repeat(190),
      f: 'x'.repeat(190),
    };
    expect(parseTrackPayload(body({ value: large })).ok).toBe(false);
  });

  it('accepts a single long value while the whole value stays under 1 KB', () => {
    const result = parseTrackPayload(body({ value: { note: 'x'.repeat(500) } }));
    expect(result.ok).toBe(true);
  });

  it('rejects malformed JSON and missing bodies without throwing', () => {
    expect(parseTrackPayload('{not json').ok).toBe(false);
    expect(parseTrackPayload('').ok).toBe(false);
    expect(parseTrackPayload('null').ok).toBe(false);
  });
});
