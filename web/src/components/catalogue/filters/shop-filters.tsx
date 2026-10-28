'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FacetCount } from '@/lib/catalogue/types';

type Facets = { colour: FacetCount[]; material: FacetCount[]; shape: FacetCount[]; seats: FacetCount[] };
type Category = { path: string; name: string };

export function ShopFilters({ facets, categories, showCategories = true }: { facets: Facets; categories: Category[]; showCategories?: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const current = useSearchParams();
  const selected = (key: string) => new Set((current.get(key) ?? '').split(',').filter(Boolean));
  const replace = (key: string, value: string, checked: boolean) => {
    const query = new URLSearchParams(current.toString()); const values = selected(key);
    if (checked) values.add(value); else values.delete(value);
    if (values.size) query.set(key, [...values].sort().join(',')); else query.delete(key);
    query.delete('page'); router.replace(`${pathname}${query.size ? `?${query}` : ''}`, { scroll: false });
  };
  const group = (label: string, key: string, options: FacetCount[]) => <fieldset className="border-t border-line py-5"><legend className="mb-3 font-display text-lg">{label}</legend><div className="space-y-2">{options.map((option) =>
    <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={selected(key).has(option.value)} onChange={(event) => replace(key, option.value, event.target.checked)} />
      {option.hex ? <span aria-hidden className="h-4 w-4 rounded-full border border-line" style={{ backgroundColor: option.hex }} /> : null}<span>{option.label}</span><span className="ml-auto text-mute">{option.count}</span></label>)}</div></fieldset>;
  return <aside aria-label="Product filters">{showCategories ? <label className="block pb-5 text-sm"><span className="mb-2 block font-display text-lg">Category</span><select className="w-full rounded-[var(--radius-card)] border border-line bg-bone p-3" value={current.get('category') ?? ''}
    onChange={(event) => { const query = new URLSearchParams(current.toString()); if (event.target.value) query.set('category', event.target.value); else query.delete('category'); query.delete('page'); router.replace(`${pathname}${query.size ? `?${query}` : ''}`, { scroll: false }); }}><option value="">All categories</option>{categories.map((category) => <option value={category.path} key={category.path}>{category.name}</option>)}</select></label> : null}
    {group('Colour', 'colour', facets.colour)}{group('Material', 'material', facets.material)}{group('Shape', 'shape', facets.shape)}{group('Seats', 'seats', facets.seats)}</aside>;
}
