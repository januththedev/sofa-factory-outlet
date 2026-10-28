import { describe, expect, it } from 'vitest';
import type { ProductCard } from '@/lib/catalogue/queries';
import { categoryFit, harmony, pickSuggestions, scoreCandidate, type SuggestionCandidate } from '@/lib/colour/pairing';
import { describeReason } from '@/lib/colour/reasons';

const card = (input: Partial<Omit<ProductCard, 'colours'>> & Pick<ProductCard, 'id' | 'name'> & { colours?: SuggestionCandidate['colours'] }): SuggestionCandidate => ({
  id: input.id,
  slug: input.name.toLowerCase().replaceAll(' ', '-'),
  name: input.name,
  href: '/product/test/',
  category: input.category ?? { name: 'Cushions', path: 'pillows' },
  categoryId: 2,
  priceMinor: null,
  priceFrom: false,
  featured: input.featured ?? false,
  isNew: false,
  shape: null,
  material: null,
  seats: null,
  colours: input.colours ?? [{ id: input.id * 10, name: 'Cream', hex: '#EDE3D1', family: 'cream', image: null, inStock: true }],
  image: null,
  hoverImage: null,
});

const rules = [{ family: 'green', pairsWith: 'cream', weight: 0.9, reason: 'soften' }];
const complements = [{ categoryId: 1, complementId: 2, weight: 1 }];
const anchors = [{ productId: 1, categoryId: 1, categoryPath: 'sofas', family: 'green' as const, colourName: 'Emerald', material: 'velvet' }];

describe('colour pairing', () => {
  it('treats explicit pairings as symmetric and takes the strongest direction', () => {
    expect(harmony('cream', 'green', [...rules, { family: 'cream', pairsWith: 'green', weight: 0.7, reason: 'lift' }])).toEqual({ score: 0.9, verb: 'soften' });
  });

  it('pairs neutrals with everything and gives same-family harmony', () => {
    expect(harmony('cream', 'purple', []).score).toBe(0.6);
    expect(harmony('green', 'green', []).score).toBe(0.35);
  });

  it('keeps hue-distance fallback scores in range', () => {
    expect(harmony('green', 'blue', []).score).toBeGreaterThanOrEqual(0);
    expect(harmony('green', 'blue', []).score).toBeLessThanOrEqual(1);
  });

  it('finds the strongest category fit and rejects unrelated categories', () => {
    expect(categoryFit([1, 3], 2, [...complements, { categoryId: 3, complementId: 2, weight: 0.6 }])).toBe(1);
    expect(categoryFit([1], 9, complements)).toBe(0);
  });

  it('weights category fit before harmony and boosts featured stock', () => {
    expect(scoreCandidate({ categoryFit: 1, harmony: 0.5, featured: true, inStock: true })).toBeCloseTo(0.8);
    expect(scoreCandidate({ categoryFit: 0, harmony: 1, featured: true, inStock: true })).toBe(0);
  });

  it('skips anchors and exclusions, and chooses the best variant', () => {
    const candidates = [
      card({ id: 1, name: 'Anchor' }),
      card({ id: 2, name: 'Excluded' }),
      card({ id: 3, name: 'Two colours', colours: [
        { id: 31, name: 'Purple', hex: '#6B4E8C', family: 'purple', image: null, inStock: true },
        { id: 32, name: 'Cream', hex: '#EDE3D1', family: 'cream', image: null, inStock: true },
      ] }),
    ];
    const result = pickSuggestions({ anchors, candidates, pairings: rules, complements, limit: 4, excludeProductIds: [2] });
    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe(32);
  });

  it('writes short, natural reasons', () => {
    expect(describeReason({ candidateCategoryPath: 'pillows', candidateColourName: 'Cream', candidateFamily: 'cream', anchorColourName: 'Emerald', anchorMaterial: 'velvet', verb: 'soften' })).toBe('Cream cushions soften emerald velvet');
    expect(describeReason({ candidateCategoryPath: 'chairs', candidateColourName: 'Grey', candidateFamily: 'grey', anchorColourName: 'Navy', anchorMaterial: null, verb: null })).toBe('Grey armchair goes well with navy');
  });
});
