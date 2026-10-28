import 'server-only';

import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { searchProducts } from '@/lib/catalogue/search';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

export const searchListing = unstable_cache(searchProducts, ['mobile-shop-search-v1'], {
  tags: ['products', 'categories'],
  revalidate: 3600,
});

export const listingCategories = unstable_cache(async () => {
  const db = await getDb();
  return db.select({ path: s.categories.path, name: s.categories.name })
    .from(s.categories)
    .where(eq(s.categories.kind, 'category'));
}, ['mobile-shop-categories-v1'], { tags: ['categories'], revalidate: 3600 });

export const getCollection = unstable_cache(async (path: string) => {
  const db = await getDb();
  return db.query.categories.findFirst({
    where: eq(s.categories.path, path),
    with: { children: true, parent: { with: { children: true } } },
  });
}, ['mobile-shop-collection-v1'], { tags: ['categories'], revalidate: 3600 });
