import type { FacetCount } from '@/lib/catalogue/types';
import type { ShopParams } from '@/lib/catalogue/search';
import { z } from 'zod';

export type FilterKey = 'colour' | 'material' | 'shape' | 'seats';
export type FilterFacets = Record<FilterKey, FacetCount[]>;
export type FilterChip = { key: string; value: string; label: string };

const listKeys: FilterKey[] = ['colour', 'material', 'shape', 'seats'];
const filterKeys = [...listKeys, 'q', 'category', 'hub', 'minPrice', 'maxPrice'];
const priceSchema = z.coerce.number().int().min(0).max(100_000_000);

export function priceRangeError(query: URLSearchParams): string {
  for (const key of ['minPrice', 'maxPrice']) {
    const value = query.get(key);
    if (value && !priceSchema.safeParse(value).success) {
      return 'Enter whole rupee amounts between 0 and 100,000,000.';
    }
  }
  const min = query.get('minPrice');
  const max = query.get('maxPrice');
  return min && max && Number(min) > Number(max)
    ? 'Minimum price must be no higher than maximum price.'
    : '';
}

export function selectedValues(query: URLSearchParams, key: string): string[] {
  return [...new Set(query.getAll(key).flatMap((value) => value.split(',')).filter(Boolean))];
}

export function filterChips(
  query: URLSearchParams,
  facets: FilterFacets,
  categories: Array<{ path: string; name: string }> = [],
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const key of listKeys) {
    for (const value of selectedValues(query, key)) {
      const fallback = value.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
      const label = facets[key].find((option) => option.value === value)?.label ?? fallback;
      chips.push({ key, value, label: key === 'seats' ? `${label} seats` : label });
    }
  }
  for (const key of ['q', 'category', 'hub', 'minPrice', 'maxPrice']) {
    const value = query.get(key);
    if (value === null || value === '') continue;
    let label = value;
    if (key === 'category' || key === 'hub') {
      label = categories.find((category) => category.path === value)?.name ?? value.replace(/[-/]/g, ' ');
    }
    if (key === 'q') label = `Search: ${value}`;
    if (key === 'minPrice') label = `From Rs. ${value}`;
    if (key === 'maxPrice') label = `Up to Rs. ${value}`;
    chips.push({ key, value, label });
  }
  return chips;
}

export function changeFilter(query: URLSearchParams, key: string, value: string, checked: boolean) {
  const next = new URLSearchParams(query);
  const values = new Set(selectedValues(next, key));
  if (checked) values.add(value);
  else values.delete(value);
  next.delete(key);
  if (values.size) next.set(key, [...values].sort().join(','));
  next.delete('page');
  return next;
}

export function removeFilter(query: URLSearchParams, chip: FilterChip) {
  if (listKeys.includes(chip.key as FilterKey)) {
    return changeFilter(query, chip.key, chip.value, false);
  }
  const next = new URLSearchParams(query);
  next.delete(chip.key);
  next.delete('page');
  return next;
}

export function clearFilters(query: URLSearchParams) {
  const next = new URLSearchParams(query);
  for (const key of filterKeys) next.delete(key);
  next.delete('page');
  return next;
}

export function listingUrl(path: string, query: URLSearchParams) {
  const next = new URLSearchParams(query);
  next.sort();
  return `${path}${next.size ? `?${next}` : ''}`;
}

export function paginationUrl(path: string, params: ShopParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page: page === 1 ? undefined : page })) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && !value.length) continue;
    query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return listingUrl(path, query);
}
