import { describe, expect, it } from 'vitest';
import { assessConfidence } from '@/lib/chat/confidence';
import { buildPrompt, MODEL_OPTIONS } from '@/lib/chat/prompt';
import { productTemplate, storeTemplate } from '@/lib/chat/templates';
import { verifyAnswer } from '@/lib/chat/verify';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import type { ProductCard } from '@/lib/catalogue/queries';

const product = {
  id: 1,
  slug: 'emerald',
  name: 'Emerald Sofa',
  href: '/product/emerald/',
  category: { name: 'Sofas', path: 'sofas' },
  priceMinor: 1_249_000,
  priceFrom: false,
  featured: false,
  isNew: false,
  shape: 'l-shape',
  material: 'velvet',
  seats: 5,
  colours: [],
  image: null,
  hoverImage: null,
} satisfies ProductCard;

describe('confidence', () => {
  it('rejects empty and low-scoring retrieval', () => {
    expect(assessConfidence({}).sufficient).toBe(false);
    expect(assessConfidence({ chunkScores: [0.19] }).sufficient).toBe(false);
  });

  it('accepts FAQ and sufficiently scored retrieval', () => {
    expect(assessConfidence({ faq: true }).sufficient).toBe(true);
    expect(assessConfidence({ productScores: [0.2] }).sufficient).toBe(true);
  });
});

describe('templates and prompt', () => {
  it('only formats stored product prices', () => {
    expect(productTemplate([product])).toContain('Rs. 12,490');
    expect(productTemplate([{ ...product, priceMinor: null }])).toContain('price on request');
  });

  it('does not expose unconfirmed store details or hours', () => {
    expect(storeTemplate(DEFAULT_SETTINGS.business)).toBeNull();
    expect(productTemplate([product])).not.toMatch(/open|hours/i);
  });

  it('builds a bounded, fact-only prompt', () => {
    const prompt = buildPrompt({
      question: 'How much?',
      intent: 'product_question',
      chunks: [],
      products: [product],
    });
    expect(prompt).toContain('Answer only from FACTS and PRODUCTS');
    expect(prompt).toContain('[P1] Emerald Sofa');
    expect(MODEL_OPTIONS).toEqual({ temperature: 0.2, maxTokens: 250 });
  });
});

describe('answer verification', () => {
  it('strips invented prices and links', () => {
    const answer = verifyAnswer('It costs Rs. 99,999. See https://bad.example.', [product]);
    expect(answer).toContain('price on request');
    expect(answer).not.toContain('https://');
  });

  it('preserves stored prices and removes invented product names', () => {
    expect(verifyAnswer('Emerald Sofa costs Rs. 12,490.', [product])).toContain('Rs. 12,490');
    expect(verifyAnswer('I recommend the Royal Deluxe Sofa. Emerald Sofa is suitable.', [product]))
      .not.toContain('Royal Deluxe');
  });
});
