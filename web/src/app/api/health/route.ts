import { sql } from 'drizzle-orm';
import { dbMode, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDb();
  const [products] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`(count(*) filter (where ${s.products.status} = 'published'))::int`,
      hidden: sql<number>`(count(*) filter (where ${s.products.status} = 'hidden'))::int`,
      featured: sql<number>`(count(*) filter (where ${s.products.featured}))::int`,
    })
    .from(s.products);
  const [variants] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withImages: sql<number>`(count(*) filter (where jsonb_array_length(${s.productVariants.images}) > 0))::int`,
    })
    .from(s.productVariants);
  const [{ categories }] = await db.select({ categories: sql<number>`count(*)::int` }).from(s.categories);
  const [{ redirects }] = await db.select({ redirects: sql<number>`count(*)::int` }).from(s.redirects);
  const [{ admins }] = await db.select({ admins: sql<number>`count(*)::int` }).from(s.adminUsers);

  return Response.json({
    ok: true,
    db: dbMode(),
    storage: storage().kind,
    products,
    variants,
    categories,
    redirects,
    admins,
  });
}
