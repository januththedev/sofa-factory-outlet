'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { listingUrl } from './filter-state';

export function SortMenu({ value = 'featured' }: { value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex min-w-0 items-center gap-2 text-base">
      <span>Sort</span>
      <select
        value={value}
        aria-label="Sort by"
        disabled={pending}
        className="min-h-11 w-32 rounded-full border border-line bg-bone px-3 text-base sm:w-44"
        onChange={(event) => {
          const query = new URLSearchParams(current.toString());
          if (event.target.value === 'featured') query.delete('sort');
          else query.set('sort', event.target.value);
          query.delete('page');
          startTransition(() => router.replace(listingUrl(pathname, query), { scroll: false }));
        }}
      >
        <option value="featured">Featured</option>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
      <span role="status" className="sr-only">{pending ? 'Sorting pieces…' : ''}</span>
    </label>
  );
}
