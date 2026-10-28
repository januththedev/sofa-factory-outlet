import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { classifyHex, normaliseHex } from '@/lib/colour/classify';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { ImageRef } from '@/lib/db/schema/types';
import { buildSearchText } from '@/lib/catalogue/search-text';
import { revalidateCatalogue, revalidateRedirects } from '@/lib/revalidate';

const imageSchema: z.ZodType<ImageRef> = z.object({
  key: z.string().min(1),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  widths: z.array(z.number().int().positive()).min(1),
  alt: z.string(),
  blur: z.string().optional(),
  dominant: z.string().optional(),
  flag: z.enum(['borrowed', 'licence']).nullable().optional(),
  cutout: z.boolean().optional(),
  source: z.string().optional(),
});

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  colourName: z.string().trim().min(1),
  hex: z.string().trim(),
  family: z.string().trim().optional(),
  tone: z.enum(['light', 'mid', 'dark']).optional(),
  warmth: z.enum(['warm', 'cool', 'neutral']).optional(),
  images: z.array(imageSchema).default([]),
  inStock: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative(),
});

export const productInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  categoryId: z.number().int().positive(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  descriptionMd: z.string().max(40_000).default(''),
  sellingPoints: z.string().trim().max(4_000).nullable().optional(),
  material: z.string().trim().max(100).nullable().optional(),
  shape: z.string().trim().max(100).nullable().optional(),
  seats: z.number().int().min(1).max(30).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  dimensions: z.object({
    widthCm: z.number().positive().optional(),
    depthCm: z.number().positive().optional(),
    heightCm: z.number().positive().optional(),
    seatHeightCm: z.number().positive().optional(),
    note: z.string().trim().max(500).optional(),
  }).nullable().optional(),
  priceMinor: z.number().int().nonnegative().nullable(),
  compareAtMinor: z.number().int().nonnegative().nullable().optional(),
  priceFrom: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'hidden']),
  featured: z.boolean().default(false),
  seoTitle: z.string().trim().max(80).nullable().optional(),
  seoDescription: z.string().trim().max(200).nullable().optional(),
  noindex: z.boolean().default(false),
  variants: z.array(variantSchema).max(50).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductSaveResult =
  | { ok: true; id: number; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const productPath = (slug: string) => `/product/${slug}/`;
const hubPath = (path: string) => `/${path.replace(/^\/+|\/+$/gu, '')}/`;

function validationFailure(error: z.ZodError): ProductSaveResult {
  const flattened = error.flatten().fieldErrors;
  const fieldErrors = Object.fromEntries(
    Object.entries(flattened).filter((entry): entry is [string, string[]] => Boolean(entry[1])),
  );
  return { ok: false, error: 'Check the highlighted fields.', fieldErrors };
}

export async function saveProduct(input: ProductInput, userId: number): Promise<ProductSaveResult> {
  void userId;
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const value = parsed.data;
  const db = await getDb();
  try {
    const saved = await db.transaction(async (tx) => {
      const [category] = await tx.select().from(s.categories).where(eq(s.categories.id, value.categoryId)).limit(1);
      if (!category) throw new Error('Choose a valid category.');
      const old = value.id
        ? (await tx.select().from(s.products).where(eq(s.products.id, value.id)).limit(1))[0]
        : undefined;
      if (value.id && !old) throw new Error('Product not found.');
      const variants = value.variants.map((variant) => {
        const classification = classifyHex(normaliseHex(variant.hex));
        return {
          ...variant,
          hex: normaliseHex(variant.hex),
          family: variant.family || classification.family,
          tone: variant.tone || classification.tone,
          warmth: variant.warmth || classification.warmth,
        };
      });
      const searchText = buildSearchText({
        name: value.name,
        categoryName: category.name,
        material: value.material,
        shape: value.shape,
        seats: value.seats,
        colours: variants.map((variant) => ({ name: variant.colourName, family: variant.family })),
        tags: value.tags,
        description: value.descriptionMd,
      });
      const values = {
        name: value.name,
        slug: value.slug,
        categoryId: value.categoryId,
        shortDescription: value.shortDescription || null,
        descriptionMd: value.descriptionMd,
        sellingPoints: value.sellingPoints || null,
        material: value.material || null,
        shape: value.shape || null,
        seats: value.seats ?? null,
        tags: value.tags,
        dimensions: value.dimensions ?? null,
        priceMinor: value.priceMinor,
        compareAtMinor: value.compareAtMinor ?? null,
        priceFrom: value.priceFrom,
        status: value.status,
        featured: value.featured,
        seoTitle: value.seoTitle || null,
        seoDescription: value.seoDescription || null,
        noindex: value.noindex,
        searchText,
        publishedAt: value.status === 'published' ? old?.publishedAt ?? new Date() : old?.publishedAt ?? null,
        updatedAt: new Date(),
      };
      const [product] = old
        ? await tx.update(s.products).set(values).where(eq(s.products.id, old.id)).returning()
        : await tx.insert(s.products).values(values).returning();
      await tx.delete(s.productVariants).where(eq(s.productVariants.productId, product.id));
      if (variants.length) {
        await tx.insert(s.productVariants).values(variants.map((variant, index) => ({
          productId: product.id,
          colourName: variant.colourName,
          hex: variant.hex,
          family: variant.family,
          tone: variant.tone,
          warmth: variant.warmth,
          images: variant.images,
          inStock: variant.inStock,
          isDefault: variant.isDefault || index === 0,
          sortOrder: index,
        })));
      }
      if (old && old.slug !== product.slug) {
        const fromPath = productPath(old.slug);
        const toPath = value.status === 'published'
          ? productPath(product.slug)
          : hubPath(category.path);
        await tx.update(s.redirects).set({ toPath, updatedAt: new Date() }).where(eq(s.redirects.toPath, fromPath));
        await tx.insert(s.redirects).values({
          fromPath,
          toPath,
          status: 301,
          reason: 'slug-change',
          productId: product.id,
        }).onConflictDoUpdate({
          target: s.redirects.fromPath,
          set: { toPath, status: 301, reason: 'slug-change', productId: product.id, updatedAt: new Date() },
        });
      }
      if (value.status === 'published') {
        await tx.delete(s.redirects).where(and(
          eq(s.redirects.productId, product.id),
          eq(s.redirects.reason, 'hidden-product'),
        ));
      } else {
        const categoryPath = hubPath(category.path);
        await tx.update(s.redirects).set({
          toPath: categoryPath,
          updatedAt: new Date(),
        }).where(eq(s.redirects.toPath, productPath(product.slug)));
        await tx.insert(s.redirects).values({
          fromPath: productPath(product.slug),
          toPath: categoryPath,
          status: 301,
          reason: 'hidden-product',
          productId: product.id,
        }).onConflictDoUpdate({
          target: s.redirects.fromPath,
          set: {
            toPath: categoryPath,
            status: 301,
            reason: 'hidden-product',
            productId: product.id,
            updatedAt: new Date(),
          },
        });
      }
      return product;
    });
    revalidateCatalogue();
    revalidateRedirects();
    return { ok: true, id: saved.id, slug: saved.slug };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the product.' };
  }
}

export async function deleteProduct(productId: number, userId: number): Promise<ProductSaveResult> {
  void userId;
  const db = await getDb();
  try {
    const deleted = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(s.products).where(eq(s.products.id, productId)).limit(1);
      if (!product) throw new Error('Product not found.');
      await tx.update(s.redirects).set({
        toPath: null,
        status: 410,
        reason: 'deleted',
        productId,
        updatedAt: new Date(),
      }).where(eq(s.redirects.toPath, productPath(product.slug)));
      await tx.delete(s.products).where(eq(s.products.id, productId));
      await tx.insert(s.redirects).values({
        fromPath: productPath(product.slug),
        toPath: null,
        status: 410,
        reason: 'deleted',
        productId,
      }).onConflictDoUpdate({
        target: s.redirects.fromPath,
        set: { toPath: null, status: 410, reason: 'deleted', productId, updatedAt: new Date() },
      });
      return product;
    });
    revalidateCatalogue();
    revalidateRedirects();
    return { ok: true, id: deleted.id, slug: deleted.slug };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the product.' };
  }
}
