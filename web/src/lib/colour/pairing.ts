import type { ProductCard } from '@/lib/catalogue/queries';
import { classifyHex, hexToOklch, hueDistance, NEUTRAL_FAMILIES, type Family } from './classify';
import { FAMILY_LABELS } from './dictionary';
import { describeReason } from './reasons';

export type PairingRule = { family: string; pairsWith: string; weight: number; reason: string | null };
export type ComplementRule = { categoryId: number; complementId: number; weight: number };

export type SuggestionAnchor = {
  productId: number;
  categoryId: number;
  categoryPath: string;
  family: Family;
  colourName: string;
  material?: string | null;
};

export type SuggestionCandidate = ProductCard & {
  categoryId: number;
  colours: Array<ProductCard['colours'][number] & { inStock?: boolean }>;
};

export type PickedSuggestion = {
  product: ProductCard;
  variantId: number;
  reason: string;
  score: number;
};

const REPRESENTATIVE_HEX: Record<Family, string> = {
  white: '#F7F5F0', cream: '#EDE3D1', beige: '#D8C7A8', camel: '#C19A6B', brown: '#6F4E37',
  grey: '#9A9B9D', charcoal: '#4A4D50', black: '#1C1C1E', green: '#2F6B4F', olive: '#6B6B3A',
  teal: '#2E7D7A', blue: '#3A5A8C', navy: '#1F2A44', pink: '#D4A5A5', red: '#B03A2E',
  maroon: '#6B1F2A', orange: '#C1622F', mustard: '#D4A72C', purple: '#6B4E8C', gold: '#C9A227',
  multi: '#6F6A64',
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function harmony(anchorFamily: Family, candidateFamily: Family, pairings: PairingRule[]): { score: number; verb: string | null } {
  const explicit = pairings
    .filter((rule) =>
      (rule.family === anchorFamily && rule.pairsWith === candidateFamily) ||
      (rule.family === candidateFamily && rule.pairsWith === anchorFamily),
    )
    .sort((a, b) => b.weight - a.weight)[0];
  if (explicit) return { score: clamp(explicit.weight), verb: explicit.reason };
  if (NEUTRAL_FAMILIES.has(anchorFamily) || NEUTRAL_FAMILIES.has(candidateFamily)) return { score: 0.6, verb: null };
  if (anchorFamily === candidateFamily) return { score: 0.35, verb: null };

  const anchorHex = REPRESENTATIVE_HEX[anchorFamily];
  const candidateHex = REPRESENTATIVE_HEX[candidateFamily];
  // Classification guards the representative lookup, while OKLCH gives a
  // stable hue for achromatic edge cases; perceptual distance sets the band.
  classifyHex(anchorHex);
  classifyHex(candidateHex);
  hexToOklch(anchorHex);
  hexToOklch(candidateHex);
  const distance = hueDistance(anchorHex, candidateHex);
  return { score: distance <= 0.18 ? 0.4 : distance >= 0.4 ? 0.5 : 0.2, verb: null };
}

export function categoryFit(anchorCategoryIds: number[], candidateCategoryId: number, complements: ComplementRule[]): number {
  return clamp(
    complements.reduce(
      (best, rule) => anchorCategoryIds.includes(rule.categoryId) && rule.complementId === candidateCategoryId ? Math.max(best, rule.weight) : best,
      0,
    ),
  );
}

export function scoreCandidate(input: { categoryFit: number; harmony: number; featured: boolean; inStock: boolean }): number {
  if (input.categoryFit === 0) return 0;
  return clamp(0.5 * input.categoryFit + 0.4 * input.harmony + (input.featured ? 0.06 : 0) + (input.inStock ? 0.04 : 0));
}

export function pickSuggestions(input: {
  anchors: SuggestionAnchor[];
  candidates: SuggestionCandidate[];
  pairings: PairingRule[];
  complements: ComplementRule[];
  limit: number;
  excludeProductIds?: number[];
}): PickedSuggestion[] {
  const skipped = new Set([...input.anchors.map((anchor) => anchor.productId), ...(input.excludeProductIds ?? [])]);
  const categoryIds = input.anchors.map((anchor) => anchor.categoryId);

  return input.candidates
    .filter((candidate) => !skipped.has(candidate.id))
    .flatMap((candidate) => {
      const fit = categoryFit(categoryIds, candidate.categoryId, input.complements);
      if (fit === 0 || candidate.colours.length === 0 || input.anchors.length === 0) return [];

      const matches = candidate.colours.flatMap((colour) =>
        input.anchors.map((anchor) => ({ colour, anchor, ...harmony(anchor.family, colour.family as Family, input.pairings) })),
      );
      matches.sort((a, b) => b.score - a.score || a.colour.name.localeCompare(b.colour.name));
      const best = matches[0];
      const score = scoreCandidate({ categoryFit: fit, harmony: best.score, featured: candidate.featured, inStock: best.colour.inStock !== false });
      return [{
        product: candidate,
        variantId: best.colour.id,
        reason: describeReason({
          candidateCategoryPath: candidate.category.path,
          candidateColourName: best.colour.name || FAMILY_LABELS[best.colour.family as Family],
          candidateFamily: best.colour.family as Family,
          anchorColourName: best.anchor.colourName || FAMILY_LABELS[best.anchor.family],
          anchorMaterial: best.anchor.material,
          verb: best.verb,
        }),
        score,
      }];
    })
    .sort((a, b) => b.score - a.score || Number(b.product.featured) - Number(a.product.featured) || a.product.name.localeCompare(b.product.name))
    .slice(0, Math.max(0, input.limit));
}
