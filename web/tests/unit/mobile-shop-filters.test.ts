import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { changeFilter } from '@/components/catalogue/filter-state';
import { clearFilters } from '@/components/catalogue/filter-state';
import { filterChips } from '@/components/catalogue/filter-state';
import { listingUrl } from '@/components/catalogue/filter-state';
import { paginationUrl } from '@/components/catalogue/filter-state';
import { priceRangeError } from '@/components/catalogue/filter-state';
import { removeFilter } from '@/components/catalogue/filter-state';
import { selectedValues } from '@/components/catalogue/filter-state';
import type { FilterFacets } from '@/components/catalogue/filter-state';

const facets: FilterFacets = {
  colour: [{ value: 'green', label: 'Green', count: 3, hex: '#008000' }],
  material: [{ value: 'velvet', label: 'Velvet', count: 2 }],
  shape: [{ value: 'l-shape', label: 'L shape', count: 1 }],
  seats: [{ value: '3', label: '3', count: 1 }],
};

describe('mobile shop filter choices and chips', () => {
  it('accepts open price bounds and zero, and rejects invalid or reversed price ranges', () => {
    expect(priceRangeError(new URLSearchParams())).toBe('');
    expect(priceRangeError(new URLSearchParams('minPrice=0&maxPrice=5000'))).toBe('');
    expect(priceRangeError(new URLSearchParams('maxPrice=0'))).toBe('');
    for (const value of ['-1', '1.5', 'NaN', '100000001']) {
      expect(priceRangeError(new URLSearchParams({ minPrice: value }))).not.toBe('');
    }
    expect(priceRangeError(new URLSearchParams('minPrice=20&maxPrice=10')))
      .toBe('Minimum price must be no higher than maximum price.');
  });

  it('counts each distinct choice once and ignores pagination and sort', () => {
    const query = new URLSearchParams('colour=green,blue&colour=green&seats=3&page=2&sort=newest&pageSize=1');
    const chips = filterChips(query, facets);
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => chip.label)).toEqual(['Green', 'Blue', '3 seats']);
    expect(filterChips(new URLSearchParams('page=2&sort=newest'), facets)).toEqual([]);
  });

  it('labels search, category, hub and both price bounds including zero', () => {
    const query = new URLSearchParams('q=green sofa&category=sofas&hub=sofas/l-shape&minPrice=0&maxPrice=5000');
    const chips = filterChips(query, facets, [{ path: 'sofas', name: 'Sofas' }]);
    expect(chips.map((chip) => chip.label)).toEqual([
      'Search: green sofa', 'Sofas', 'sofas l shape', 'From Rs. 0', 'Up to Rs. 5000',
    ]);
  });

  it('preserves applied choices when editing a local draft', () => {
    const applied = new URLSearchParams('colour=green&sort=newest&page=4');
    const draft = changeFilter(applied, 'colour', 'blue', true);
    expect(applied.toString()).toBe('colour=green&sort=newest&page=4');
    expect(selectedValues(draft, 'colour')).toEqual(['blue', 'green']);
    expect(draft.get('sort')).toBe('newest');
    expect(draft.has('page')).toBe(false);
    expect(changeFilter(draft, 'colour', 'blue', true).get('colour')).toBe('blue,green');
  });

  it('removes one chip while keeping other colours and filters', () => {
    const query = new URLSearchParams('colour=green,blue&material=velvet&page=3&pageSize=1&sort=newest');
    const chip = filterChips(query, facets).find((item) => item.value === 'green');
    expect(chip).toBeDefined();
    if (!chip) throw new Error('Expected a green filter chip');
    const next = removeFilter(query, chip);
    expect(next.get('colour')).toBe('blue');
    expect(next.get('material')).toBe('velvet');
    expect(next.get('sort')).toBe('newest');
    expect(next.get('pageSize')).toBe('1');
    expect(next.has('page')).toBe(false);
    expect(query.get('colour')).toBe('green,blue');
  });

  it('drops empty query keys after removing the final choice or a scalar chip', () => {
    const query = new URLSearchParams('colour=green&q=sofa&page=2');
    const next = changeFilter(query, 'colour', 'green', false);
    expect(next.has('colour')).toBe(false);
    expect(removeFilter(next, { key: 'q', value: 'sofa', label: 'Search: sofa' }).toString()).toBe('');
  });

  it('clears filters and search together while retaining sort, page size and unrelated query data', () => {
    const query = new URLSearchParams(
      'colour=green&material=velvet&shape=l-shape&seats=3&category=sofas&hub=sofas/l-shape'
      + '&minPrice=0&maxPrice=5000&q=sofa&page=2&sort=newest&pageSize=1&utm_source=chat',
    );
    const cleared = clearFilters(query);
    expect(filterChips(cleared, facets)).toHaveLength(0);
    expect(cleared.toString()).toBe('sort=newest&pageSize=1&utm_source=chat');
    expect(query.has('colour')).toBe(true);
  });

  it('builds one stable category navigation from several draft choices', () => {
    let draft = new URLSearchParams('page=3&sort=newest');
    draft = changeFilter(draft, 'colour', 'green', true);
    draft = changeFilter(draft, 'shape', 'l-shape', true);
    expect(listingUrl('/sofas/', draft)).toBe('/sofas/?colour=green&shape=l-shape&sort=newest');
    expect(listingUrl('/shop/', new URLSearchParams())).toBe('/shop/');
  });

  it('keeps filters and route scope on numbered, previous and next page URLs', () => {
    const params = { colour: ['green'], shape: ['l-shape'], pageSize: 1, page: 2 };
    expect(paginationUrl('/shop/', params, 3)).toBe('/shop/?colour=green&page=3&pageSize=1&shape=l-shape');
    expect(paginationUrl('/sofas/l-shape/', params, 1))
      .toBe('/sofas/l-shape/?colour=green&pageSize=1&shape=l-shape');
    expect(params.page).toBe(2);
  });
});
