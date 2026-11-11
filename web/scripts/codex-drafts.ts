// Lists owner-photo products that are drafts although every photo on them is now a Codex cut-out
// (ready to publish once someone has looked at the cover).
//   npx tsx scripts/codex-drafts.ts
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import * as s from '../src/lib/db/schema';

const codexDir = path.resolve(process.cwd(), '../marketing/photo-pipeline/catalogue/processed/studio-codex');
const isCodex = (src?: string) => !!src?.startsWith('owner-photos/') && fs.existsSync(path.join(codexDir, `${src.slice(13)}.jpg`));

async function main() {
  const db = await getDb();
  const drafts = (await db.select({ id: s.products.id, slug: s.products.slug, tags: s.products.tags }).from(s.products).where(and(eq(s.products.status, 'draft'))))
    .filter((p) => p.tags?.includes('owner-photos'));
  for (const p of drafts) {
    const variants = await db.select({ colour: s.productVariants.colourName, images: s.productVariants.images }).from(s.productVariants).where(eq(s.productVariants.productId, p.id));
    const photos = variants.flatMap((v) => v.images ?? []);
    if (photos.length && photos.every((i) => isCodex(i.source))) {
      console.log(`${p.slug}\t${variants.length} colours\t${photos.length} photos\tcover ${photos[0].source}`);
    }
  }
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
