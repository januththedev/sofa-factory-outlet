import { desc, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { FAMILY_LABELS } from '../colour/dictionary';
import type { Family } from '../colour/classify';
import { getDb } from '../db';
import * as s from '../db/schema';
import type { PictureData } from '../images/urls';
import { listPublishedProducts, type ProductCard } from './queries';

export type PublicReview = { id: number; rating: number; title: string | null; body: string; authorName: string; verifiedVisit: boolean };

/** Approved on-site reviews (none until the client supplies real ones). */
export const getApprovedReviews = unstable_cache(
  async (): Promise<PublicReview[]> => {
    const db = await getDb();
    return db
      .select({ id: s.reviews.id, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body, authorName: s.reviews.authorName, verifiedVisit: s.reviews.verifiedVisit })
      .from(s.reviews)
      .where(eq(s.reviews.approved, true))
      .orderBy(desc(s.reviews.createdAt))
      .limit(6);
  },
  ['approved-reviews-v1'],
  { tags: ['reviews'], revalidate: 3600 },
);

// The catalogue is small, so the public site reads every published product
// once, caches it under the `products` tag and derives tiles and swatches in
// memory. Saving a product in admin calls revalidateTag('products', 'max').
export const getPublishedCards = unstable_cache(() => listPublishedProducts(), ['published-cards-v1'], {
  tags: ['products'],
  revalidate: 3600,
});

export async function getFeaturedCards(limit = 6): Promise<ProductCard[]> {
  const all = await getPublishedCards();
  const featured = all.filter((p) => p.featured);
  const rest = all.filter((p) => !p.featured);
  return [...featured, ...rest].slice(0, limit);
}

export type CollectionTile = {
  id: string;
  name: string;
  blurb: string;
  href: string;
  count: number;
  image: PictureData | null;
};

const TILE_DEFS: Array<{ id: string; name: string; blurb: string; href: string; match: (p: ProductCard) => boolean }> = [
  { id: 'l-shape', name: 'L-shape sofas', blurb: 'Corner and chaise sofas for family living rooms.', href: '/sofas/l-shape/', match: (p) => p.shape === 'l-shape' },
  { id: 'u-shape', name: 'U-shape sofas', blurb: 'Big modular sectionals with a chaise on both ends.', href: '/sofas/u-shape/', match: (p) => p.shape === 'u-shape' },
  { id: 'sets', name: 'Sofa sets', blurb: '3+2+1 sets and wing-chair suites, ready for the room.', href: '/sofas/sets/', match: (p) => p.shape === 'set' },
  { id: 'velvet', name: 'Velvet', blurb: 'Soft, rich and made to be sat in.', href: '/sofas/velvet/', match: (p) => p.material === 'velvet' && p.category.path === 'sofas' },
  { id: 'leather', name: 'Leather', blurb: 'Hard-wearing leather in deep, warm tones.', href: '/sofas/leather/', match: (p) => p.material === 'leather' },
  { id: 'beds', name: 'Bedding', blurb: 'Fitted covers and linen for the bedroom.', href: '/beds/', match: (p) => p.category.path === 'beds' },
];

/** Landing-page "collections": sofa hubs and categories that have published pieces, each shown with a real photo. */
export async function getCollectionTiles(): Promise<CollectionTile[]> {
  const all = await getPublishedCards();
  const used = new Set<number>();
  return TILE_DEFS.map((def) => {
    const items = all.filter(def.match);
    // Prefer a clean white-background cut-out that no earlier tile already shows.
    const pick =
      items.find((p) => p.image?.cutout && !used.has(p.id)) ?? items.find((p) => p.image && !used.has(p.id)) ?? items.find((p) => p.image);
    if (pick) used.add(pick.id);
    return { id: def.id, name: def.name, blurb: def.blurb, href: def.href, count: items.length, image: pick?.image ?? null };
  }).filter((tile) => tile.count > 0);
}

export type Swatch = { family: Family; label: string; hex: string; count: number; href: string };

/** One swatch per colour family among published pieces, for the colour explorer. */
export async function getColourSwatches(): Promise<Swatch[]> {
  const all = await getPublishedCards();
  const byFamily = new Map<Family, { hex: string; count: number }>();
  for (const product of all) {
    if (product.category.path !== 'sofas') continue;
    for (const colour of product.colours) {
      const family = colour.family as Family;
      if (family === 'multi') continue;
      const entry = byFamily.get(family);
      if (entry) entry.count += 1;
      else byFamily.set(family, { hex: colour.hex, count: 1 });
    }
  }
  return [...byFamily.entries()]
    .map(([family, { hex, count }]) => ({
      family,
      label: FAMILY_LABELS[family],
      hex,
      count,
      href: `/shop/?colour=${family}`,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
