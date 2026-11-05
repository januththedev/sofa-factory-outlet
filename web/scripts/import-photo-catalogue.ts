// Creates DRAFT products from the owner's own photos: the grouping plans in
// marketing/photo-pipeline/catalogue/plan-*.json (product -> colour -> photo numbers) and the processed
// studio shots in .../catalogue/processed/studio/<folder>-<n>.jpg. Each studio shot goes through the same
// processImage() as admin uploads (AVIF + WebP widths, local storage or Vercel Blob).
//
//   npx tsx scripts/import-photo-catalogue.ts --dry        show what would be created
//   npx tsx scripts/import-photo-catalogue.ts              create the drafts (skips slugs that already exist)
//   npx tsx scripts/import-photo-catalogue.ts --publish    create them already published (default: drafts to check first)
//   npx tsx scripts/import-photo-catalogue.ts --refresh    swap the photos of products this importer made (drafts, or tagged owner-photos) for newer ones
//
// Photos: the Codex cut-out on the studio background (processed/studio-codex, see marketing/photo-pipeline/
// codex_studio.py) is used when it exists, otherwise the rembg studio shot (processed/studio).
//
// Products stay drafts: an admin checks each one, adds prices and sizes, then publishes it. Nothing here is
// made up: no prices, sizes, warranty or delivery claims.
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { buildSearchText } from '../src/lib/catalogue/search-text';
import { classifyHex, normaliseHex } from '../src/lib/colour/classify';
import { closeDb, getDb } from '../src/lib/db';
import * as s from '../src/lib/db/schema';
import type { ImageRef } from '../src/lib/db/schema/types';
import { processImage } from '../src/lib/images/process';

// Many large photos in a row: keep sharp to one thread and no cache so the import fits on a small machine.
sharp.concurrency(1);
sharp.cache(false);

const dry = process.argv.includes('--dry');
const refresh = process.argv.includes('--refresh');
const publish = process.argv.includes('--publish');
// Slugs that stay drafts even with --publish (e.g. a cover photo that still needs fixing).
const hold = new Set((process.env.IMPORT_HOLD ?? '').split(',').map((v) => v.trim()).filter(Boolean));
const root = path.resolve(process.cwd(), process.env.CATALOGUE_DIR || '../marketing/photo-pipeline/catalogue');
const studioDir = path.join(root, 'processed', 'studio');
const codexDir = path.join(root, 'processed', 'studio-codex');

/** The best studio shot for a photo: the Codex cut-out when there is one. */
const studioFile = (name: string): string | null => {
  for (const dir of [codexDir, studioDir]) {
    const file = path.join(dir, `${name}.jpg`);
    if (fs.existsSync(file)) return file;
  }
  return null;
};
const cutoutDir = path.join(root, 'processed', 'cutout');
const MAX_PHOTOS = 4;

type PlanVariant = { colour: string; photos: number[] };
type PlanProduct = { key: string; name: string; shape: string; category?: string; variants: PlanVariant[] };
type Plan = { folder: string; products: PlanProduct[] };

// The site's shape facet: hubs filter on these values (see seed CATEGORY_SEEDS).
const SHAPE: Record<string, string | null> = { 'l-shape': 'l-shape', 'u-shape': 'u-shape', set: 'set', 'three-seater': 'single' };
const SEATS: Record<string, number> = { 'set-321-classic': 6, 'set-321-chesterfield': 6, 'set-311-box': 5, 'three-seater-modern': 3, 'three-seater-chesterfield': 3 };

const slugify = (value: string) => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Median colour of the cut-out's solid pixels: the sofa's own colour, not the background. */
async function sofaHex(name: string): Promise<string> {
  const file = path.join(cutoutDir, `${name}.png`);
  if (!fs.existsSync(file)) return '#888888';
  const { data, info } = await sharp(file).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue;
    r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
  }
  const mid = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? 136;
  return `#${[mid(r), mid(g), mid(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function description(product: PlanProduct, colours: string[]): string {
  const list = colours.length > 1 ? `${colours.slice(0, -1).join(', ')} and ${colours.at(-1)}` : colours[0];
  return [
    `Made to order in our own Colombo workshop and sold factory-direct, with no middleman.`,
    ``,
    `Shown here in ${list}. Every piece is built after you order, so you choose the fabric, colour and size for your room.`,
    ``,
    `Visit the showroom to sit on it, compare fabrics and confirm the price and delivery.`,
  ].join('\n');
}

async function main() {
  const plans: Plan[] = fs.readdirSync(root).filter((f) => /^plan-.*\.json$/.test(f)).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')));
  const db = await getDb();
  const categories = new Map((await db.select().from(s.categories)).map((c) => [c.path, c]));
  let created = 0, skipped = 0, images = 0;

  for (const plan of plans) {
    for (const product of plan.products) {
      const slug = slugify(product.name);
      const category = categories.get(product.category ?? 'sofas');
      if (!category) { console.log(`skip ${product.name}: no category ${product.category}`); continue; }
      const [exists] = await db.select({ id: s.products.id, status: s.products.status, tags: s.products.tags }).from(s.products).where(eq(s.products.slug, slug)).limit(1);
      if (exists && !(refresh && (exists.status === 'draft' || exists.tags?.includes('owner-photos')))) { skipped++; console.log(`exists ${slug}`); continue; }

      const variants: Array<typeof s.productVariants.$inferInsert & { colourName: string; family: string; images: ImageRef[] }> = [];
      let aiPhotos = false;
      for (const [order, v] of product.variants.entries()) {
        // Codex cut-outs first (hero shot included), then the remaining studio shots, at most MAX_PHOTOS.
        const all = v.photos.map((n) => `${plan.folder}-${n}`).filter((n) => studioFile(n));
        const names = [...all.filter((n) => fs.existsSync(path.join(codexDir, `${n}.jpg`))), ...all.filter((n) => !fs.existsSync(path.join(codexDir, `${n}.jpg`)))].slice(0, MAX_PHOTOS);
        if (!names.length) continue;
        if (names.some((n) => fs.existsSync(path.join(codexDir, `${n}.jpg`)))) aiPhotos = true;
        const hex = normaliseHex(await sofaHex(names[0]));
        const c = classifyHex(hex);
        const refs: ImageRef[] = [];
        if (!dry) {
          for (const n of names) {
            refs.push(await processImage(fs.readFileSync(studioFile(n)!), {
              keyPrefix: `products/${slug}/${slugify(v.colour)}`,
              alt: `${product.name} in ${v.colour}`,
              source: `owner-photos/${n}`,
            }));
          }
        }
        images += names.length;
        variants.push({ productId: 0, colourName: v.colour, hex, family: c.family, tone: c.tone, warmth: c.warmth, images: refs, inStock: true, isDefault: order === 0, sortOrder: order });
      }
      if (!variants.length) { console.log(`no processed photos yet: ${product.name}`); continue; }
      variants[0].isDefault = true;

      if (exists) {
        // --refresh: only the photos change; names, prices, notes and any other edit made in admin stay.
        const current = await db.select().from(s.productVariants).where(eq(s.productVariants.productId, exists.id));
        let changed = 0;
        for (const v of variants) {
          const row = current.find((c) => c.colourName === v.colourName);
          if (!row || dry) { changed += row ? 1 : 0; continue; }
          await db.update(s.productVariants).set({ images: v.images }).where(eq(s.productVariants.id, row.id));
          changed++;
        }
        console.log(`${dry ? 'would refresh' : 'refreshed'} ${slug}: ${changed} colours`);
        created++;
        continue;
      }

      const colours = variants.map((v) => v.colourName);
      const shape = SHAPE[product.shape] ?? null;
      const seats = SEATS[product.key] ?? null;
      const descriptionMd = description(product, colours);
      console.log(`${dry ? 'would create' : 'create'} ${slug}: ${variants.length} colours, ${variants.reduce((n, v) => n + (dry ? 0 : v.images.length), 0) || '(dry)'} photos`);
      if (dry) { created++; continue; }

      await db.transaction(async (tx) => {
        const [row] = await tx.insert(s.products).values({
          slug, name: product.name, categoryId: category.id, descriptionMd,
          shortDescription: `Made to order in our Colombo workshop, in ${variants.length} colour${variants.length === 1 ? '' : 's'} and more.`,
          shape, seats, status: publish && !hold.has(slug) ? 'published' : 'draft', publishedAt: publish && !hold.has(slug) ? new Date() : null, priceMinor: null, tags: ['owner-photos'],
          reviewNotes: ['price-on-request: add a price or a "from" price', 'no-dimensions',
            ...(aiPhotos ? ['ai-edited-photos: the cut-outs were redrawn by an image tool, so check each photo still matches the real piece (legs, cushions, colour)'] : [])],
          searchText: buildSearchText({ name: product.name, categoryName: category.name, shape, seats, colours: variants.map((v) => ({ name: v.colourName, family: v.family })), tags: [], description: descriptionMd }),
        }).returning({ id: s.products.id });
        await tx.insert(s.productVariants).values(variants.map((v) => ({ ...v, productId: row.id })));
      });
      created++;
    }
  }
  console.log(`${dry ? 'would create/refresh' : 'created/refreshed'} ${created} draft products, ${images} photos; ${skipped} left alone`);
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
