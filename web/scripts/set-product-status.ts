// Changes a product's status (published, draft or hidden) by its slug.
//   npx tsx scripts/set-product-status.ts <slug> <published|draft|hidden>
// The public site caches products for up to an hour; POST /api/internal/revalidate refreshes it at once.
import './_env';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import * as s from '../src/lib/db/schema';

const STATUSES = ['published', 'draft', 'hidden'] as const;

async function main() {
  const [slug, status] = process.argv.slice(2) as [string, (typeof STATUSES)[number]];
  if (!slug || !STATUSES.includes(status)) throw new Error('usage: set-product-status.ts <slug> <published|draft|hidden>');
  const db = await getDb();
  const updated = await db
    .update(s.products)
    .set({ status, publishedAt: status === 'published' ? new Date() : null })
    .where(eq(s.products.slug, slug))
    .returning({ slug: s.products.slug, status: s.products.status });
  console.log(updated.length ? `${updated[0].slug} is now ${updated[0].status}` : `no product with the slug ${slug}`);
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
