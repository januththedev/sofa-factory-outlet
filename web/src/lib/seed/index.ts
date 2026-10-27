import bcrypt from 'bcryptjs';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { buildSearchText } from '../catalogue/search-text';
import type { Db, DbOrTx } from '../db';
import * as s from '../db/schema';
import { env } from '../env';
import { DEFAULT_COMPLEMENTS, DEFAULT_PAIRINGS, DEFAULT_SETTINGS, DEFAULT_SLOTS } from '../settings/defaults';
import {
  CATEGORY_SEEDS,
  loadCapture,
  loadManifest,
  type MediaManifest,
  type ProductSeed,
  transformProduct,
} from './capture';

/** Bump when a new seed step should run once on existing databases. */
export const SEED_VERSION = 1;

type Log = (message: string) => void;

export async function ensureSeeded(db: Db, log: Log = () => {}): Promise<void> {
  const [row] = await db.select({ value: s.settings.value }).from(s.settings).where(eq(s.settings.key, 'seed_version'));
  const version = typeof row?.value === 'number' ? row.value : 0;
  if (version < SEED_VERSION) {
    await seedAll(db, log);
    await db
      .insert(s.settings)
      .values({ key: 'seed_version', value: SEED_VERSION })
      .onConflictDoUpdate({ target: s.settings.key, set: { value: SEED_VERSION, updatedAt: new Date() } });
  }
  await attachMissingImages(db, log);
}

export async function seedAll(db: Db, log: Log = () => {}): Promise<void> {
  const manifest = loadManifest();
  if (!manifest) log('seed: no seed/media-manifest.json yet — products are seeded without photos (run `npm run media:import`).');
  const capture = loadCapture();

  await db.transaction(async (tx) => {
    await seedSettings(tx);
    await seedSlots(tx);
    const categoryIds = await seedCategories(tx, manifest);
    const created = await seedProducts(tx, capture.products, categoryIds, manifest);
    await seedColourRules(tx, categoryIds);
    if (created > 0) await markFeatured(tx);
    log(`seed: ${created} products created`);
  });

  await seedOwner(db, log);
  const { seedKnowledge } = await import('./knowledge');
  await seedKnowledge(db, log);
}

async function seedSettings(tx: DbOrTx) {
  const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
  await tx.insert(s.settings).values(rows).onConflictDoNothing({ target: s.settings.key });
}

async function seedSlots(tx: DbOrTx) {
  const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(s.bookingSlots);
  if (count === 0) await tx.insert(s.bookingSlots).values(DEFAULT_SLOTS);
}

async function seedCategories(tx: DbOrTx, manifest: MediaManifest | null) {
  const ordered = [...CATEGORY_SEEDS].sort((a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)));
  const ids = new Map<string, { id: number; path: string }>();
  const existing = await tx.select({ id: s.categories.id, slug: s.categories.slug, path: s.categories.path }).from(s.categories);
  for (const row of existing) ids.set(row.slug, { id: row.id, path: row.path });

  for (const c of ordered) {
    if (ids.has(c.slug)) continue;
    const image = c.image ? manifest?.items[c.image] : undefined;
    const [row] = await tx
      .insert(s.categories)
      .values({
        slug: c.slug,
        path: c.path,
        name: c.name,
        parentId: c.parent ? ids.get(c.parent)?.id ?? null : null,
        kind: c.kind,
        hubFilter: c.hubFilter ?? null,
        legacySlug: c.legacySlug ?? null,
        image: image ? { ...image, alt: c.name } : null,
        sortOrder: c.sortOrder,
      })
      .returning({ id: s.categories.id, path: s.categories.path });
    ids.set(c.slug, row);
  }
  return ids;
}

function imagesFor(seed: ProductSeed, manifest: MediaManifest | null) {
  if (!manifest) return [];
  return seed.images
    .map((im) => {
      const ref = manifest.items[im.rel];
      return ref ? { ...ref, alt: im.alt, flag: im.flag } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

async function seedProducts(
  tx: DbOrTx,
  captured: ReturnType<typeof loadCapture>['products'],
  categoryIds: Map<string, { id: number; path: string }>,
  manifest: MediaManifest | null,
): Promise<number> {
  const existing = new Set(
    (await tx.select({ legacyId: s.products.legacyId }).from(s.products)).map((r) => r.legacyId).filter(Boolean),
  );
  let created = 0;

  for (const p of captured) {
    if (existing.has(p.id)) continue;
    const seed = transformProduct(p, manifest);
    const category = categoryIds.get(seed.categorySlug);
    if (!category) throw new Error(`Unknown category ${seed.categorySlug} for product ${p.id}`);

    const [product] = await tx
      .insert(s.products)
      .values({
        legacyId: seed.legacyId,
        slug: seed.slug,
        name: seed.name,
        categoryId: category.id,
        descriptionMd: seed.descriptionMd,
        shortDescription: seed.shortDescription,
        sellingPoints: seed.sellingPoints,
        material: seed.material,
        shape: seed.shape,
        seats: seed.seats,
        attributes: seed.attributes,
        priceMinor: seed.priceMinor,
        compareAtMinor: seed.compareAtMinor,
        priceFrom: seed.priceFrom,
        status: seed.status,
        tags: seed.tags,
        seoTitle: seed.seoTitle,
        reviewNotes: seed.reviewNotes,
        searchText: buildSearchText({
          name: seed.name,
          categoryName: seed.categorySlug,
          material: seed.material,
          shape: seed.shape,
          seats: seed.seats,
          colours: seed.colour ? [{ name: seed.colour.name, family: seed.colour.family }] : [],
          tags: seed.tags,
          description: seed.plainDescription,
        }),
        publishedAt: seed.status === 'published' ? seed.publishedAt ?? new Date() : null,
        createdAt: seed.publishedAt ?? new Date(),
      })
      .returning({ id: s.products.id });

    const colour = seed.colour ?? { name: 'Natural', hex: '#C8B8A2', family: 'beige', tone: 'mid', warmth: 'neutral' };
    await tx.insert(s.productVariants).values({
      productId: product.id,
      colourName: colour.name,
      hex: colour.hex,
      family: colour.family,
      tone: colour.tone,
      warmth: colour.warmth,
      images: imagesFor(seed, manifest),
      isDefault: true,
    });

    if (seed.status === 'hidden') {
      await tx
        .insert(s.redirects)
        .values({
          fromPath: `/product/${seed.slug}/`,
          toPath: `/${category.path}/`,
          status: 301,
          reason: 'hidden-product',
          productId: product.id,
        })
        .onConflictDoNothing({ target: s.redirects.fromPath });
    }
    created += 1;
  }
  return created;
}

async function markFeatured(tx: DbOrTx) {
  const newest = await tx
    .select({ id: s.products.id })
    .from(s.products)
    .where(eq(s.products.status, 'published'))
    .orderBy(desc(s.products.publishedAt), desc(s.products.legacyId))
    .limit(6);
  if (newest.length) {
    await tx
      .update(s.products)
      .set({ featured: true })
      .where(inArray(s.products.id, newest.map((r) => r.id)));
  }
}

async function seedColourRules(tx: DbOrTx, categoryIds: Map<string, { id: number; path: string }>) {
  await tx.insert(s.colourPairings).values(DEFAULT_PAIRINGS).onConflictDoNothing();
  const rows = DEFAULT_COMPLEMENTS.map((c) => ({
    categoryId: categoryIds.get(c.category)?.id,
    complementId: categoryIds.get(c.complement)?.id,
    weight: c.weight,
  })).filter((r): r is { categoryId: number; complementId: number; weight: number } => Boolean(r.categoryId && r.complementId));
  if (rows.length) await tx.insert(s.categoryComplements).values(rows).onConflictDoNothing();
}

async function seedOwner(db: Db, log: Log) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.adminUsers);
  if (count > 0) return;
  if (!env.OWNER_EMAIL || !env.OWNER_PASSWORD) {
    log('seed: OWNER_EMAIL / OWNER_PASSWORD not set — no admin account created yet.');
    return;
  }
  await db.insert(s.adminUsers).values({
    name: env.OWNER_NAME,
    email: env.OWNER_EMAIL.toLowerCase(),
    passwordHash: await bcrypt.hash(env.OWNER_PASSWORD, 12),
    role: 'owner',
  });
  log(`seed: owner account created for ${env.OWNER_EMAIL}`);
}

/**
 * Photos are processed separately (`npm run media:import`). Whenever the
 * manifest is newer than the database, fill in products and categories that
 * still have no images, without touching anything edited in admin.
 */
export async function attachMissingImages(db: Db, log: Log = () => {}) {
  const manifest = loadManifest();
  if (!manifest) return;
  const capture = loadCapture();
  const products = await db
    .select({ productId: s.products.id, legacyId: s.products.legacyId, variantId: s.productVariants.id })
    .from(s.products)
    .innerJoin(s.productVariants, and(eq(s.productVariants.productId, s.products.id), eq(s.productVariants.isDefault, true)))
    .where(sql`jsonb_array_length(${s.productVariants.images}) = 0`);
  let filled = 0;
  for (const row of products) {
    const captured = capture.products.find((p) => p.id === row.legacyId);
    if (!captured) continue;
    const images = imagesFor(transformProduct(captured, manifest), manifest);
    if (!images.length) continue;
    await db.update(s.productVariants).set({ images }).where(eq(s.productVariants.id, row.variantId));
    filled += 1;
  }
  for (const c of CATEGORY_SEEDS) {
    const ref = c.image ? manifest.items[c.image] : undefined;
    if (!ref) continue;
    await db
      .update(s.categories)
      .set({ image: { ...ref, alt: c.name } })
      .where(and(eq(s.categories.slug, c.slug), sql`${s.categories.image} is null`));
  }
  if (filled) log(`seed: attached photos to ${filled} products`);
}
