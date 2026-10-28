import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';
import { previewFilters } from '@/app/(site)/shop/actions';
import { searchListing } from '@/components/catalogue/server';
import type { ShopResult } from '@/lib/catalogue/search';

vi.mock('@/components/catalogue/server', () => ({ searchListing: vi.fn() }));

const result: ShopResult = {
  items: [],
  total: 3,
  page: 1,
  pageSize: 12,
  pages: 1,
  facets: { colour: [], material: [], shape: [], seats: [], price: { min: null, max: null } },
};

beforeEach(() => {
  vi.mocked(searchListing).mockReset();
  vi.mocked(searchListing).mockResolvedValue(result);
});

describe('draft filter count preview', () => {
  it('counts all draft choices together without returning a navigation or product payload', async () => {
    expect(await previewFilters({ query: 'colour=green,blue&shape=l-shape&page=4' })).toEqual({
      ok: true, total: 3, facets: result.facets,
    });
    expect(searchListing).toHaveBeenCalledWith({ colour: ['blue', 'green'], shape: ['l-shape'], page: 1 });
  });

  it('keeps a category page in its collection even if the query tries to override it', async () => {
    await previewFilters({ query: 'category=beds&material=velvet', category: 'sofas' });
    expect(searchListing).toHaveBeenCalledWith({ category: 'sofas', material: ['velvet'], page: 1 });
  });

  it('keeps a hub page in its saved hub', async () => {
    await previewFilters({ query: 'hub=sofas/leather&colour=green', hub: 'sofas/l-shape' });
    expect(searchListing).toHaveBeenCalledWith({ hub: 'sofas/l-shape', colour: ['green'], page: 1 });
  });

  it('validates external choices with the existing URL parser, including repeated parameters', async () => {
    await previewFilters({ query: 'colour=green&colour=blue,green&material=unknown&seats=x,3&minPrice=-2' });
    expect(searchListing).toHaveBeenCalledWith({ colour: ['blue', 'green'], seats: [3], minPrice: 0, page: 1 });
  });

  it('rejects oversized queries and invalid route scopes before searching', async () => {
    expect((await previewFilters({ query: 'x'.repeat(4001) })).ok).toBe(false);
    expect((await previewFilters({ query: '', category: '../admin' })).ok).toBe(false);
    expect(searchListing).not.toHaveBeenCalled();
  });

  it('returns a retryable error when the count cannot be loaded', async () => {
    vi.mocked(searchListing).mockRejectedValue(new Error('database unavailable'));
    expect(await previewFilters({ query: 'colour=green' })).toEqual({
      ok: false, error: 'Could not count pieces. Please try again.',
    });
  });
});
