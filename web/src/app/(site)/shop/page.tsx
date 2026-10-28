import type { Metadata } from 'next';
import { eq, sql } from 'drizzle-orm';
import { ShopFilters } from '@/components/catalogue/filters/shop-filters';
import { Pagination } from '@/components/catalogue/pagination';
import { ShopGrid } from '@/components/catalogue/shop-grid';
import { SortMenu } from '@/components/catalogue/sort-menu';
import { TLink } from '@/components/site/transition';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { buildShopUrl, parseShopParams, searchProducts } from '@/lib/catalogue/search';
import { pageMetadata } from '@/lib/seo/metadata';

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = parseShopParams(await searchParams);
  const filtered = Boolean(params.q || params.category || params.hub || params.colour?.length || params.material?.length || params.shape?.length || params.seats?.length || params.minPrice !== undefined || params.maxPrice !== undefined || params.sort);
  const path = !filtered && params.page && params.page > 1 ? buildShopUrl({ page: params.page }) : '/shop/';
  return pageMetadata({ title: 'Shop furniture', description: 'Browse sofas and furniture made in our Colombo workshop, with custom colours and sizes and delivery across Sri Lanka.', path, noindex: filtered });
}

export default async function ShopPage({ searchParams }: { searchParams: Search }) {
  const params = parseShopParams(await searchParams); const result = await searchProducts(params); const db = await getDb();
  const categories = await db.select({ path: s.categories.path, name: s.categories.name }).from(s.categories).where(eq(s.categories.kind, 'category'));
  const [priceCount] = await db.select({ count: sql<number>`count(*)::int` }).from(s.products).where(sql`${s.products.status} = 'published' and ${s.products.priceMinor} is not null`);
  const priced = priceCount.count >= 2;
  return <main className="site-container py-12 lg:py-20"><p className="eyebrow">Factory collection</p><h1 className="mt-3 font-display text-[clamp(3rem,8vw,7rem)] font-light leading-none">Shop</h1>
    <form action="/shop/" className="mt-10 flex max-w-2xl gap-3"><label className="sr-only" htmlFor="shop-search">Search products</label><input id="shop-search" name="q" defaultValue={params.q} placeholder="Search sofas, colours or materials" className="min-w-0 flex-1 rounded-full border border-line bg-bone px-5 py-3" /><button className="btn btn-primary" type="submit">Search</button></form>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4"><p aria-live="polite">{result.total} {result.total === 1 ? 'product' : 'products'}</p><SortMenu value={params.sort} /></div>
    <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr]"><ShopFilters facets={result.facets} categories={categories} /><div>{priced ? <p className="mb-4 text-sm text-mute">Price range: Rs. {result.facets.price.min}–{result.facets.price.max}</p> : null}{result.items.length ? <ShopGrid products={result.items} /> : <div className="rounded-[var(--radius-card)] bg-paper p-8"><h2 className="font-display text-3xl">No matching products</h2><p className="mt-3 text-ink-2">Try removing a filter, ask us about what you need, or book a visit.</p><div className="mt-6 flex gap-3"><TLink className="btn btn-ghost" href="/shop/">Clear filters</TLink><TLink className="btn btn-primary" href="/book-visit/">Ask us / Book a visit</TLink></div></div>}
      <Pagination page={result.page} pages={result.pages} path="/shop/" params={params} /></div></div></main>;
}
