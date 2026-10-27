import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { getDb } from '../db';
import * as s from '../db/schema';
import type { ImageRef } from '../db/schema/types';
import { type PictureData, pictureData } from '../images/urls';

const NEW_FOR_DAYS = 30;

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  href: string;
  category: { name: string; path: string };
  priceMinor: number | null;
  priceFrom: boolean;
  featured: boolean;
  isNew: boolean;
  shape: string | null;
  material: string | null;
  seats: number | null;
  colours: Array<{ id: number; name: string; hex: string; family: string; image: PictureData | null }>;
  image: PictureData | null;
  hoverImage: PictureData | null;
};

type ProductWithRelations = typeof s.products.$inferSelect & {
  category: typeof s.categories.$inferSelect;
  variants: Array<typeof s.productVariants.$inferSelect>;
};

const firstImage = (images: ImageRef[] | undefined) => (images?.length ? pictureData(images[0]) : null);

export function toCard(p: ProductWithRelations): ProductCard {
  const variants = [...p.variants].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder);
  const main = variants[0];
  const publishedAt = p.publishedAt ?? p.createdAt;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    href: `/product/${p.slug}/`,
    category: { name: p.category.name, path: p.category.path },
    priceMinor: p.priceMinor,
    priceFrom: p.priceFrom,
    featured: p.featured,
    isNew: Date.now() - publishedAt.getTime() < NEW_FOR_DAYS * 86_400_000,
    shape: p.shape,
    material: p.material,
    seats: p.seats,
    colours: variants.map((v) => ({ id: v.id, name: v.colourName, hex: v.hex, family: v.family, image: firstImage(v.images) })),
    image: firstImage(main?.images),
    hoverImage: main?.images?.[1] ? pictureData(main.images[1]) : null,
  };
}

export async function listPublishedProducts(options: { where?: SQL; limit?: number } = {}): Promise<ProductCard[]> {
  const db = await getDb();
  const rows = await db.query.products.findMany({
    where: options.where ? and(eq(s.products.status, 'published'), options.where) : eq(s.products.status, 'published'),
    with: { category: true, variants: true },
    orderBy: [desc(s.products.featured), desc(s.products.publishedAt), asc(s.products.name)],
    limit: options.limit,
  });
  return rows.map(toCard);
}
