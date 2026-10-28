import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

vi.mock('@/lib/revalidate', () => ({
  revalidateCatalogue: vi.fn(),
  revalidateRedirects: vi.fn(),
}));

import { deleteProduct, saveProduct, type ProductInput } from '@/lib/admin/products';

let db: Db;
let categoryId: number;
const slug = (suffix: string) => `admin-test-${suffix}-${Date.now()}`;

function input(productSlug: string, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: 'Admin Test Sofa',
    slug: productSlug,
    categoryId,
    descriptionMd: 'A useful test description',
    material: 'velvet',
    shape: 'l-shape',
    seats: 5,
    tags: ['test'],
    priceMinor: 100_000,
    priceFrom: false,
    status: 'draft',
    featured: false,
    noindex: false,
    variants: [{
      colourName: 'Forest',
      hex: '#33664A',
      images: [],
      inStock: true,
      isDefault: true,
      sortOrder: 0,
    }],
    ...overrides,
  };
}

beforeAll(async () => {
  db = await getDb();
  const [category] = await db.select().from(s.categories).limit(1);
  categoryId = category.id;
});

afterAll(async () => {
  await closeDb();
});

describe('admin product save pipeline', () => {
  it('creates and updates a product with colour classification', async () => {
    const created = await saveProduct(input(slug('create')), 1);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = await saveProduct(
      input(created.slug, { id: created.id, name: 'Updated Admin Sofa' }),
      1,
    );
    expect(updated.ok).toBe(true);
    const [product] = await db.select().from(s.products).where(eq(s.products.id, created.id));
    const [variant] = await db.select().from(s.productVariants).where(eq(s.productVariants.productId, created.id));
    expect(product.name).toBe('Updated Admin Sofa');
    expect(variant.family).toBeTruthy();
  });

  it('writes a 301 on slug change and flattens redirect chains', async () => {
    const firstSlug = slug('chain-a');
    const secondSlug = slug('chain-b');
    const thirdSlug = slug('chain-c');
    const created = await saveProduct(input(firstSlug, { status: 'published' }), 1);
    if (!created.ok) throw new Error(created.error);
    await saveProduct(input(secondSlug, { id: created.id, status: 'published' }), 1);
    await saveProduct(input(thirdSlug, { id: created.id, status: 'published' }), 1);
    const [first] = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, `/product/${firstSlug}/`));
    const [second] = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, `/product/${secondSlug}/`));
    expect(first).toMatchObject({ toPath: `/product/${thirdSlug}/`, status: 301 });
    expect(second).toMatchObject({ toPath: `/product/${thirdSlug}/`, status: 301 });
  });

  it('writes a hub redirect when hidden and removes it when republished', async () => {
    const oldSlug = slug('visibility-old');
    const productSlug = slug('visibility');
    const created = await saveProduct(input(oldSlug, { status: 'published' }), 1);
    if (!created.ok) throw new Error(created.error);
    await saveProduct(input(productSlug, { id: created.id, status: 'hidden' }), 1);
    const hidden = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, `/product/${productSlug}/`));
    const old = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, `/product/${oldSlug}/`));
    expect(hidden[0]).toMatchObject({ reason: 'hidden-product', status: 301 });
    expect(old[0]?.toPath).toBe(hidden[0]?.toPath);
    await saveProduct(input(productSlug, { id: created.id, status: 'published' }), 1);
    const republished = await db.select().from(s.redirects)
      .where(eq(s.redirects.fromPath, `/product/${productSlug}/`));
    expect(republished).toEqual([]);
  });

  it('writes a 410 when deleted', async () => {
    const productSlug = slug('delete');
    const created = await saveProduct(input(productSlug), 1);
    if (!created.ok) throw new Error(created.error);
    expect((await deleteProduct(created.id, 1)).ok).toBe(true);
    const [redirect] = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, `/product/${productSlug}/`));
    expect(redirect).toMatchObject({ toPath: null, status: 410, reason: 'deleted' });
  });

  it('sets published_at once and preserves it across later saves', async () => {
    const productSlug = slug('published');
    const created = await saveProduct(input(productSlug), 1);
    if (!created.ok) throw new Error(created.error);
    await saveProduct(input(productSlug, { id: created.id, status: 'published' }), 1);
    const [first] = await db.select().from(s.products).where(eq(s.products.id, created.id));
    await saveProduct(input(productSlug, { id: created.id, status: 'hidden' }), 1);
    await saveProduct(input(productSlug, { id: created.id, status: 'published' }), 1);
    const [second] = await db.select().from(s.products).where(eq(s.products.id, created.id));
    expect(first.publishedAt).not.toBeNull();
    expect(second.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
  });

  it('rebuilds search_text from category, facets, colours and copy', async () => {
    const created = await saveProduct(input(slug('search'), { descriptionMd: 'Distinctive showroom copy' }), 1);
    if (!created.ok) throw new Error(created.error);
    const [product] = await db.select().from(s.products).where(eq(s.products.id, created.id));
    expect(product.searchText).toContain('velvet');
    expect(product.searchText).toContain('Forest');
    expect(product.searchText).toContain('Distinctive showroom copy');
  });
});
