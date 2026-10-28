import type { Metadata } from 'next';
import { Listing } from '@/components/catalogue/listing';
import { listingCategories } from '@/components/catalogue/server';
import { searchListing } from '@/components/catalogue/server';
import { buildShopUrl } from '@/lib/catalogue/search';
import { parseShopParams } from '@/lib/catalogue/search';
import { pageMetadata } from '@/lib/seo/metadata';

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = parseShopParams(await searchParams);
  const filtered = Boolean(
    params.q || params.category || params.hub || params.colour?.length || params.material?.length
    || params.shape?.length || params.seats?.length || params.minPrice !== undefined
    || params.maxPrice !== undefined || params.sort,
  );
  const path = !filtered && params.page && params.page > 1 ? buildShopUrl({ page: params.page }) : '/shop/';
  return pageMetadata({
    title: 'Shop furniture',
    description: 'Browse sofas and furniture, then book a showroom visit to discuss colours and sizes.',
    path,
    noindex: filtered,
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Search }) {
  const params = parseShopParams(await searchParams);
  const [result, categories] = await Promise.all([searchListing(params), listingCategories()]);
  return (
    <main className="site-container pt-24 pb-12 lg:pt-32 lg:pb-20">
      <h1 className="font-display text-[clamp(3rem,8vw,7rem)] font-light leading-none">Shop</h1>
      <form action="/shop/" className="mt-6 mb-6 flex max-w-2xl gap-2">
        <label className="sr-only" htmlFor="shop-search">Search products</label>
        <input
          id="shop-search"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={params.q}
          placeholder="Search sofas, colours or materials"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-bone px-4 py-3 text-base"
        />
        <button className="btn btn-primary min-h-11 px-4" type="submit">Search</button>
      </form>
      <Listing result={result} params={params} path="/shop/" categories={categories} />
    </main>
  );
}
