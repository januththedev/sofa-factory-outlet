import { notImplemented } from '../not-implemented';
import type { ProductCard } from '../catalogue/queries';

// CONTRACT STUB. Owner: "colour-engine" agent. Keep these exports and signatures.

export type Suggestion = {
  product: ProductCard;
  /** The variant whose colour was chosen to match the anchors. */
  variantId: number;
  /** One short sentence the code generates, e.g. "Cream cushions soften emerald velvet". */
  reason: string;
  score: number;
};

/**
 * Plan.md "Colour-matched suggestions": every candidate scores category fit
 * (category_complements) + colour harmony (colour_pairings, backed up by hue
 * distance) + a featured/in-stock boost. Products already in `anchors` or in
 * `excludeProductIds` are skipped. Published products only. Returns the best
 * `limit` (default 4), highest score first.
 */
export const suggestFor: (args: { anchors: Array<{ productId: number; variantId?: number }>; limit?: number; excludeProductIds?: number[] }) => Promise<Suggestion[]> = async () =>
  notImplemented('suggestFor');
