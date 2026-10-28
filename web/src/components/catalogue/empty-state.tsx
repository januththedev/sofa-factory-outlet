'use client';

import { usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { TLink } from '@/components/site/transition';
import { clearFilters } from './filter-state';
import { listingUrl } from './filter-state';

export function EmptyState() {
  const path = usePathname();
  const query = useSearchParams();
  const clear = listingUrl(path, clearFilters(new URLSearchParams(query.toString())));
  return (
    <div className="rounded-[var(--radius-card)] bg-paper p-5 sm:p-8">
      <h2 className="font-display text-3xl">No pieces match those filters</h2>
      <p className="mt-3 text-base text-ink-2">Try fewer filters, or book a visit to discuss what you need.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <TLink className="btn btn-ghost min-h-11" href={clear}>Clear filters</TLink>
        <TLink className="btn btn-ghost min-h-11" href="/shop/">Browse the whole shop</TLink>
        <TLink className="btn btn-primary min-h-11" href="/book-visit/">Book a visit</TLink>
      </div>
    </div>
  );
}
