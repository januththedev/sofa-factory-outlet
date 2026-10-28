import { and, desc, eq, ne } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getDb } from '../db';
import * as s from '../db/schema';
import { pictureData } from '../images/urls';
import type { ProductCard } from './queries';
import { toCard } from './queries';
import type { ProductDetail } from './types';

// CONTRACT STUB. Owner: "product-page" agent. Keep these exports and signatures.

/** A published product by slug, or null (hidden/draft products return null; the proxy redirects them). */
export const productBySlug: (slug: string) => Promise<ProductDetail | null> = async (slug) =>
  unstable_cache(
    async () => {
      const db = await getDb();
      const product = await db.query.products.findFirst({
        where: and(eq(s.products.slug, slug), eq(s.products.status, 'published')),
        with: { category: true, variants: true, reviews: true },
      });
      if (!product) return null;
      const approved = product.reviews.filter((review) => review.approved);
      const ratingTotal = approved.reduce((sum, review) => sum + review.rating, 0);
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        category: { id: product.category.id, name: product.category.name, path: product.category.path },
        descriptionMd: product.descriptionMd,
        shortDescription: product.shortDescription,
        sellingPoints: product.sellingPoints,
        material: product.material,
        shape: product.shape,
        seats: product.seats,
        dimensions: product.dimensions,
        attributes: product.attributes,
        priceMinor: product.priceMinor,
        compareAtMinor: product.compareAtMinor,
        priceFrom: product.priceFrom,
        tags: product.tags,
        featured: product.featured,
        noindex: product.noindex,
        publishedAt: product.publishedAt?.toISOString() ?? null,
        updatedAt: product.updatedAt.toISOString(),
        variants: [...product.variants]
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder)
          .map((variant) => ({
            id: variant.id,
            colourName: variant.colourName,
            hex: variant.hex,
            family: variant.family,
            tone: variant.tone,
            warmth: variant.warmth,
            inStock: variant.inStock,
            isDefault: variant.isDefault,
            images: variant.images.map((image) => pictureData(image)),
          })),
        reviews: { count: approved.length, average: approved.length ? ratingTotal / approved.length : null },
      } satisfies ProductDetail;
    },
    ['product-detail-v1', slug],
    { tags: ['products'], revalidate: 3600 },
  )();

/** Slugs of every published product, for generateStaticParams. */
export const publishedSlugs: () => Promise<string[]> = unstable_cache(
  async () => {
    const db = await getDb();
    const rows = await db.select({ slug: s.products.slug }).from(s.products).where(eq(s.products.status, 'published'));
    return rows.map((row) => row.slug);
  },
  ['published-product-slugs-v1'],
  { tags: ['products'], revalidate: 3600 },
);

/** Other published products from the same category, newest first, excluding `productId`. */
export const relatedProducts: (productId: number, limit?: number) => Promise<ProductCard[]> = async (productId, limit = 4) =>
  unstable_cache(
    async () => {
      const db = await getDb();
      const current = await db.query.products.findFirst({ where: eq(s.products.id, productId), columns: { categoryId: true } });
      if (!current) return [];
      const rows = await db.query.products.findMany({
        where: and(eq(s.products.status, 'published'), eq(s.products.categoryId, current.categoryId), ne(s.products.id, productId)),
        with: { category: true, variants: true },
        orderBy: [desc(s.products.publishedAt), desc(s.products.createdAt)],
        limit,
      });
      return rows.map(toCard);
    },
    ['related-products-v1', String(productId), String(limit)],
    { tags: ['products'], revalidate: 3600 },
  )();
