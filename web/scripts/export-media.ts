// Writes every photo the site shows into public/media/<key>/<width>.<avif|webp>, so the pages can load them
// from the deployment itself (MEDIA_BASE_URL=/media) instead of Vercel Blob.
//
//   npx tsx scripts/export-media.ts            photos of published products, categories and site images
//   npx tsx scripts/export-media.ts --check    only report what is missing
//
// Keys are content hashes (see processImage), so a file found under a local storage folder (.data/blob-ux,
// .data/blob) is copied as is; otherwise it is rebuilt at the same key from its original: the captured upload
// (../assets/uploads/<source>) or the owner photo (catalogue/processed/studio-codex|studio/<name>.jpg).
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import manifest from '../seed/media-manifest.json';
import { closeDb, getDb } from '../src/lib/db';
import * as s from '../src/lib/db/schema';
import type { ImageRef } from '../src/lib/db/schema/types';

sharp.concurrency(1);
sharp.cache(false);

const check = process.argv.includes('--check');
const OUT = path.resolve(process.cwd(), 'public/media');
const LOCAL = ['.data/blob-ux', '.data/blob'].map((d) => path.resolve(process.cwd(), d));
const UPLOADS = path.resolve(process.cwd(), '../assets/uploads');
const CATALOGUE = path.resolve(process.cwd(), '../marketing/photo-pipeline/catalogue/processed');
const FORMATS = ['avif', 'webp'] as const;

function originalOf(ref: ImageRef): string | null {
  if (!ref.source) return null;
  if (ref.source.startsWith('owner-photos/')) {
    const name = ref.source.slice('owner-photos/'.length);
    return ['studio-codex', 'studio'].map((d) => path.join(CATALOGUE, d, `${name}.jpg`)).find((f) => fs.existsSync(f)) ?? null;
  }
  const file = path.join(UPLOADS, ...ref.source.split('/'));
  return fs.existsSync(file) ? file : null;
}

async function main() {
  const refs = new Map<string, ImageRef>();
  const add = (ref: ImageRef | null | undefined) => {
    if (ref?.key && ref.widths?.length) refs.set(ref.key, ref);
  };

  const db = await getDb();
  const published = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.status, 'published'));
  for (const { id } of published) {
    const variants = await db.select({ images: s.productVariants.images }).from(s.productVariants).where(eq(s.productVariants.productId, id));
    for (const v of variants) for (const img of v.images ?? []) add(img);
  }
  for (const c of await db.select({ image: s.categories.image }).from(s.categories)) add(c.image);
  for (const item of Object.values(manifest.items as Record<string, ImageRef>)) {
    if (!item.key.startsWith('products/')) add(item);
  }
  await closeDb();

  let copied = 0, rebuilt = 0, present = 0;
  const missing: string[] = [];
  for (const ref of refs.values()) {
    const files = ref.widths.flatMap((w) => FORMATS.map((ext) => `${ref.key}/${w}.${ext}`));
    if (files.every((f) => fs.existsSync(path.join(OUT, f)))) { present++; continue; }
    const dir = LOCAL.find((d) => files.every((f) => fs.existsSync(path.join(d, f))));
    if (dir) {
      if (!check) for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
        fs.copyFileSync(path.join(dir, f), path.join(OUT, f));
      }
      copied++;
      continue;
    }
    const original = originalOf(ref);
    if (!original) { missing.push(`${ref.key} (${ref.source ?? 'no source'})`); continue; }
    if (!check) {
      const input = fs.readFileSync(original);
      for (const width of ref.widths) {
        const resized = sharp(input, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true });
        fs.mkdirSync(path.join(OUT, ref.key), { recursive: true });
        await resized.clone().avif({ quality: 52, effort: 4 }).toFile(path.join(OUT, ref.key, `${width}.avif`));
        await resized.clone().webp({ quality: 80 }).toFile(path.join(OUT, ref.key, `${width}.webp`));
      }
      process.stdout.write(`\r  rebuilt ${rebuilt + 1}: ${ref.key}`.padEnd(90));
    }
    rebuilt++;
  }
  process.stdout.write('\n');
  console.log(`${refs.size} photos: ${present} already in public/media, ${copied} ${check ? 'to copy' : 'copied'}, ${rebuilt} ${check ? 'to rebuild' : 'rebuilt'}, ${missing.length} missing`);
  for (const m of missing) console.log(`  missing: ${m}`);
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
