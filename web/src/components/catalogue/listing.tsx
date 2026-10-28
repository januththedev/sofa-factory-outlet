import type { ShopParams } from '@/lib/catalogue/search';
import type { ShopResult } from '@/lib/catalogue/search';
import { EmptyState } from './empty-state';
import type { CategoryOption } from './filters/shop-filters';
import { ListingControls } from './listing-controls';
import { Pagination } from './pagination';
import { ShopGrid } from './shop-grid';

export function Listing({ result, params, path, categories = [], category, hub }: {
  result: ShopResult;
  params: ShopParams;
  path: string;
  categories?: CategoryOption[];
  category?: string;
  hub?: string;
}) {
  return (
    <ListingControls total={result.total} facets={result.facets} categories={categories} category={category} hub={hub}>
      <section id="product-grid" tabIndex={-1} aria-label="Product grid" className="scroll-mt-24 outline-none">
        {result.items.length ? <ShopGrid products={result.items} /> : <EmptyState />}
      </section>
      <Pagination page={result.page} pages={result.pages} path={path} params={params} />
    </ListingControls>
  );
}
