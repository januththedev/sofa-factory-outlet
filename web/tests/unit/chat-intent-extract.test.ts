import { describe, expect, it } from 'vitest';
import { extractDetails } from '@/lib/chat/extract';
import { classifyIntent } from '@/lib/chat/intent';

describe('chat intent', () => {
  it.each([
    ['show me green sofas', {}, 'find_products'],
    ['what material is this', { productId: 2 }, 'product_question'],
    ['what will match my cart', { cart: [{ productId: 2, quantity: 1 }] }, 'cart_pairing'],
    ['where is the showroom', {}, 'store_info'],
    ['book a visit', {}, 'booking'],
    ['hello there', {}, 'small_talk'],
    ['tell me a cricket score', {}, 'off_topic'],
  ])('classifies %s', (query, context, expected) => {
    expect(classifyIntent(query, context)).toBe(expected);
  });
});

describe('chat extraction', () => {
  it.each([
    ['under 1.5 lakhs', 150_000],
    ['below 80k', 80_000],
  ])('extracts maximum budget from %s', (query, expected) => {
    expect(extractDetails(query).maxPrice).toBe(expected);
  });

  it('extracts approximate budgets, colour and room dimensions', () => {
    expect(extractDetails('green sofa around 2 lakh for 12x14 ft')).toMatchObject({
      colour: 'green',
      targetPrice: 200_000,
      roomSize: '12x14 ft',
    });
  });
});
