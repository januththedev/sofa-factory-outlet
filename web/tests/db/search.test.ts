import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db';
import { searchProducts } from '@/lib/catalogue/search';

afterAll(closeDb);

describe('catalogue search', () => {
  it('never returns hidden products', async () => { const result = await searchProducts({ pageSize: 48 }); expect(result.total).toBe(15); expect(result.items).toHaveLength(15); });
  it('filters shapes and promoted hubs', async () => { const shape = await searchProducts({ shape: ['l-shape'] }); const hub = await searchProducts({ hub: 'sofas/l-shape' }); expect(shape.items.length).toBeGreaterThan(0); expect(shape.items.every((p) => p.shape === 'l-shape')).toBe(true); expect(hub.items.map((p) => p.id)).toEqual(shape.items.map((p) => p.id)); });
  it('supports full-text and misspelt searches', async () => { expect((await searchProducts({ q: 'leather sofa' })).items.map((p) => p.name)).toContain('Maroon Leather Sofa Set 3+2+1'); expect((await searchProducts({ q: 'chesterfeild' })).items.some((p) => /Chesterfield/.test(p.name))).toBe(true); });
  it('counts facets without applying their own dimension', async () => { const result = await searchProducts({ colour: ['maroon'] }); expect(result.facets.colour.length).toBeGreaterThan(1); expect(result.facets.colour.every((f) => f.count > 0)).toBe(true); });
  it('paginates and keeps unpriced products last for price sorts', async () => { const page = await searchProducts({ pageSize: 2, page: 2 }); expect(page.items).toHaveLength(2); expect(page.pages).toBe(8); const sorted = await searchProducts({ sort: 'price-asc', pageSize: 48 }); const firstUnpriced = sorted.items.findIndex((p) => p.priceMinor === null); expect(sorted.items.slice(firstUnpriced).every((p) => p.priceMinor === null)).toBe(true); });
});
