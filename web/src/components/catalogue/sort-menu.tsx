'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SortMenu({ value = 'featured' }: { value?: string }) {
  const router = useRouter(); const pathname = usePathname(); const current = useSearchParams();
  return <label className="flex items-center gap-2 text-sm"><span>Sort by</span><select value={value} className="rounded-full border border-line bg-bone px-4 py-2"
    onChange={(event) => { const query = new URLSearchParams(current.toString()); if (event.target.value === 'featured') query.delete('sort'); else query.set('sort', event.target.value); query.delete('page'); router.replace(`${pathname}${query.size ? `?${query}` : ''}`, { scroll: false }); }}>
    <option value="featured">Featured</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
  </select></label>;
}
