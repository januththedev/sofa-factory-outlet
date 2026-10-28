import { getPublishedCards } from '../catalogue/cached';
import type { ProductCard } from '../catalogue/queries';
import { getDb } from '../db';
import * as s from '../db/schema';
import type { Family } from './classify';
import { pickSuggestions } from './pairing';

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
export const suggestFor: (args: { anchors: Array<{ productId: number; variantId?: number }>; limit?: number; excludeProductIds?: number[] }) => Promise<Suggestion[]> = async (args) => {
  if (args.anchors.length === 0 || (args.limit ?? 4) <= 0) return [];

  const db = await getDb();
  const [cards, pairings, complements, categories, products, variants] = await Promise.all([
    getPublishedCards(),
    db.select().from(s.colourPairings),
    db.select().from(s.categoryComplements),
    db.select({ id: s.categories.id, path: s.categories.path }).from(s.categories),
    db.select({ id: s.products.id, categoryId: s.products.categoryId, material: s.products.material }).from(s.products),
    db.select({ id: s.productVariants.id, productId: s.productVariants.productId, colourName: s.productVariants.colourName, family: s.productVariants.family, inStock: s.productVariants.inStock, isDefault: s.productVariants.isDefault, sortOrder: s.productVariants.sortOrder }).from(s.productVariants),
  ]);

  const categoryByPath = new Map(categories.map((category) => [category.path, category.id]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const variantsByProduct = new Map<number, typeof variants>();
  for (const variant of variants) variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant]);

  const anchors = args.anchors.flatMap((requested) => {
    const product = productById.get(requested.productId);
    if (!product) return [];
    const choices = [...(variantsByProduct.get(product.id) ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder);
    const variant = requested.variantId === undefined ? choices[0] : choices.find((choice) => choice.id === requested.variantId);
    const category = categories.find((item) => item.id === product.categoryId);
    if (!variant || !category) return [];
    return [{ productId: product.id, categoryId: product.categoryId, categoryPath: category.path, family: variant.family as Family, colourName: variant.colourName, material: product.material }];
  });

  const stockByVariant = new Map(variants.map((variant) => [variant.id, variant.inStock]));
  const candidates = cards.flatMap((card) => {
    const categoryId = categoryByPath.get(card.category.path);
    if (categoryId === undefined) return [];
    return [{ ...card, categoryId, colours: card.colours.map((colour) => ({ ...colour, inStock: stockByVariant.get(colour.id) ?? false })) }];
  });

  return pickSuggestions({ anchors, candidates, pairings, complements, limit: args.limit ?? 4, excludeProductIds: args.excludeProductIds });
};
