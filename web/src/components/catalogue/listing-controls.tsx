'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import type { ShopResult } from '@/lib/catalogue/search';
import { clearFilters } from './filter-state';
import { filterChips } from './filter-state';
import { listingUrl } from './filter-state';
import { removeFilter } from './filter-state';
import { FilterSheet } from './filters/filter-sheet';
import { ShopFilters } from './filters/shop-filters';
import type { CategoryOption } from './filters/shop-filters';
import { SortMenu } from './sort-menu';
import { rememberResults } from './results-memory';
import { restoreResults } from './results-memory';

type Props = {
  total: number;
  facets: ShopResult['facets'];
  categories: CategoryOption[];
  category?: string;
  hub?: string;
  children: ReactNode;
};

export function ListingControls(props: Props) {
  const router = useRouter();
  const path = usePathname();
  const current = useSearchParams();
  const query = current.toString();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const chips = filterChips(new URLSearchParams(query), props.facets, props.categories);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const navigate = (next: URLSearchParams) => {
    setOpen(false);
    startTransition(() => router.replace(listingUrl(path, next), { scroll: false }));
  };

  useEffect(() => restoreResults(), [path, query]);

  return (
    <section className="min-w-0 pb-24 lg:pb-0" aria-label="Shop results">
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line bg-bone py-3">
        <p role="status" aria-live="polite" aria-atomic="true"><span key={query}>{props.total} pieces</span></p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpen(true)}
            className="btn btn-ghost min-h-11 px-3 lg:hidden">
            Filters ({chips.length})
          </button>
          <SortMenu value={current.get('sort') ?? 'featured'} />
        </div>
      </div>
      {pending ? <p role="status" className="py-2 text-base">Updating pieces…</p> : null}
      <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Product filters">
          <ShopFilters
            facets={props.facets}
            categories={props.categories}
            showCategories={!props.category && !props.hub}
            query={query}
            onChange={navigate}
          />
        </aside>
        <div className="min-w-0" aria-busy={pending}>
          {chips.length ? (
            <div className="mb-6 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <button
                  key={`${chip.key}:${chip.value}`}
                  type="button"
                  aria-label={`Remove filter: ${chip.label}`}
                  onClick={() => navigate(removeFilter(new URLSearchParams(query), chip))}
                  className="min-h-11 max-w-full rounded-full border border-line px-4 text-left text-base
                    [overflow-wrap:anywhere]"
                >
                  {chip.label} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button type="button" onClick={() => navigate(clearFilters(new URLSearchParams(query)))}
                className="min-h-11 px-3 text-base underline">
                Clear all
              </button>
            </div>
          ) : null}
          <div onClickCapture={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            const link = target.closest<HTMLAnchorElement>('a[href]');
            if (link?.pathname.startsWith('/product/')) rememberResults(link.pathname);
          }}>
            {props.children}
          </div>
        </div>
      </div>
      <div
        data-sticky-bar
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone px-4 pt-3 lg:hidden
          pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary min-h-11 w-full">
          Filters ({chips.length}) · {props.total} pieces
        </button>
      </div>
      {open ? (
        <FilterSheet
          key={query}
          query={query}
          total={props.total}
          facets={props.facets}
          categories={props.categories}
          category={props.category}
          hub={props.hub}
          onClose={close}
          onApply={navigate}
        />
      ) : null}
    </section>
  );
}
