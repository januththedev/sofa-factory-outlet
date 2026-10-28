'use server';
import { eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { deleteProduct, saveProduct, type ProductInput } from '@/lib/admin/products';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { CsvProduct } from '@/lib/catalogue/csv';
import { processImage } from '@/lib/images/process';

export async function saveProductAction(input: ProductInput) {
  const session = await requireRole('any');
  return saveProduct(input, session.userId);
}

export async function deleteProductAction(productId: number) {
  const session = await requireRole('owner');
  const parsed = z.number().int().positive().safeParse(productId);
  if (!parsed.success) return { ok: false, error: 'Choose a valid product.' };
  return deleteProduct(parsed.data, session.userId);
}

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  operation: z.enum(['publish', 'hide', 'delete']),
});

const csvProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1),
  priceMinor: z.number().int().nonnegative().nullable(),
  status: z.enum(['draft', 'published', 'hidden']),
  material: z.string().nullable(),
  shape: z.string().nullable(),
  seats: z.number().int().min(1).max(30).nullable(),
  tags: z.array(z.string().trim().min(1)).max(50),
  description: z.string().max(40_000),
  colours: z.array(z.object({
    name: z.string().trim().min(1),
    hex: z.string().regex(/^#[0-9A-F]{6}$/u),
    photoUrls: z.array(z.string().url().startsWith('https://')).max(12),
  })).max(50),
});

const csvProductsSchema = z.array(csvProductSchema).min(1).max(1_000);

export async function bulkProductsAction(input: z.input<typeof bulkSchema>) {
  const session = await requireRole('any');
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Choose products and a valid bulk action.' };
  if (parsed.data.operation === 'delete' && session.role !== 'owner') {
    return { ok: false, error: 'Only an owner can delete products.' };
  }
  const db = await getDb();
  const products = await db.select().from(s.products).where(inArray(s.products.id, parsed.data.ids));
  const results = [];
  for (const product of products) {
    if (parsed.data.operation === 'delete') {
      results.push(await deleteProduct(product.id, session.userId));
      continue;
    }
    const variants = await db.select().from(s.productVariants)
      .where(eq(s.productVariants.productId, product.id));
    results.push(await saveProduct({
      id: product.id,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      shortDescription: product.shortDescription,
      descriptionMd: product.descriptionMd,
      sellingPoints: product.sellingPoints,
      material: product.material,
      shape: product.shape,
      seats: product.seats,
      tags: product.tags,
      dimensions: product.dimensions,
      priceMinor: product.priceMinor,
      compareAtMinor: product.compareAtMinor,
      priceFrom: product.priceFrom,
      status: parsed.data.operation === 'publish' ? 'published' : 'hidden',
      featured: product.featured,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      noindex: product.noindex,
      variants,
    }, session.userId));
  }
  const failed = results.find((result) => !result.ok);
  return failed ?? { ok: true };
}

export async function importProductsAction(rows: CsvProduct[]) {
  const session = await requireRole('any');
  const parsedRows = csvProductsSchema.safeParse(rows);
  if (!parsedRows.success) {
    return {
      ok: false,
      results: [{ line: 1, ok: false, error: 'The CSV preview is no longer valid.' }],
    };
  }
  const db = await getDb();
  const results: Array<{ line: number; ok: boolean; error?: string }> = [];
  for (const [index, row] of parsedRows.data.entries()) {
    try {
      const [category] = await db.select().from(s.categories).where(or(
        eq(s.categories.slug, row.category),
        eq(s.categories.path, row.category),
      )).limit(1);
      if (!category) throw new Error(`Unknown category: ${row.category}`);
      const productSlug = row.name.toLowerCase().trim()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '');
      const variants = [];
      for (const [colourIndex, colour] of row.colours.entries()) {
        const images = [];
        for (const url of colour.photoUrls) {
          const response = await fetch(url, { redirect: 'follow' });
          if (!response.ok) throw new Error(`Photo failed (${response.status}): ${url}`);
          if (!response.url.startsWith('https://')) throw new Error(`Photo redirected away from HTTPS: ${url}`);
          const contentType = response.headers.get('content-type') ?? '';
          if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType.split(';')[0])) {
            throw new Error(`Photo URL is not a supported image: ${url}`);
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.byteLength > 12 * 1024 * 1024) throw new Error(`Photo is larger than 12 MB: ${url}`);
          images.push(await processImage(bytes, {
            keyPrefix: `products/temporary-${productSlug}`,
            alt: `${row.name} in ${colour.name}`,
            source: url,
          }));
        }
        variants.push({
          colourName: colour.name,
          hex: colour.hex,
          images,
          inStock: true,
          isDefault: colourIndex === 0,
          sortOrder: colourIndex,
        });
      }
      const result = await saveProduct({
        name: row.name,
        slug: productSlug,
        categoryId: category.id,
        descriptionMd: row.description,
        material: row.material,
        shape: row.shape,
        seats: row.seats,
        tags: row.tags,
        priceMinor: row.priceMinor,
        priceFrom: false,
        status: row.status,
        featured: false,
        noindex: false,
        variants,
      }, session.userId);
      results.push({ line: index + 2, ok: result.ok, error: result.ok ? undefined : result.error });
    } catch (error) {
      results.push({
        line: index + 2,
        ok: false,
        error: error instanceof Error ? error.message : 'Import failed.',
      });
    }
  }
  return { ok: results.every((result) => result.ok), results };
}
