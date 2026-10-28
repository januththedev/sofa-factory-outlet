import { afterAll, describe, expect, it } from 'vitest';
import { CARE_NOTES } from '@content/care';
import { productBySlug, publishedSlugs, relatedProducts } from '@/lib/catalogue/product';
import { closeDb, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

afterAll(closeDb);

describe('public product queries', () => {
  it('returns a published product with ordered variants and images', async () => {
    const slugs = await publishedSlugs();
    const product = await productBySlug(slugs[0]);
    expect(product).not.toBeNull();
    expect(product?.variants.length).toBeGreaterThan(0);
    expect(product?.variants[0].isDefault).toBe(true);
    expect(product?.variants[0].images.length).toBeGreaterThan(0);
    expect(product?.variants[0].images[0].src).toMatch(/\.webp$/);
  });

  it('does not expose hidden products', async () => {
    expect(await productBySlug('camaleonda')).toBeNull();
  });

  it('returns all 15 published slugs', async () => {
    expect(await publishedSlugs()).toHaveLength(15);
  });

  it('returns only other published products from the category', async () => {
    const product = await productBySlug((await publishedSlugs())[0]);
    expect(product).not.toBeNull();
    if (!product) throw new Error('Expected a published product');
    const related = await relatedProducts(product.id, 50);
    expect(related.every((item) => item.id !== product.id && item.slug !== 'camaleonda')).toBe(true);
  });

  it('has care guidance for every material derived by the seed', async () => {
    const db = await getDb();
    const rows = await db.selectDistinct({ material: s.products.material }).from(s.products);
    const materials = rows.map((row) => row.material).filter((material): material is string => material !== null);
    expect(materials.every((material) => material in CARE_NOTES)).toBe(true);
  });
});
