import { describe, expect, it } from 'vitest';
import { articleJsonLd, breadcrumbJsonLd, productJsonLd } from '@/lib/seo/jsonld';
import type { ProductDetail } from '@/lib/catalogue/types';

const product = { slug: 'chair', name: 'Chair', shortDescription: 'A chair', descriptionMd: '', material: 'fabric', priceMinor: null, dimensions: null, variants: [{ colourName: 'Blue', images: [] }], reviews: { count: 0, average: null } } as unknown as ProductDetail;
describe('JSON-LD', () => {
  it('uses absolute breadcrumb URLs', () => expect(JSON.stringify(breadcrumbJsonLd([{ name: 'Home', path: '/' }]))).toContain('http://localhost:3000/'));
  it('only emits offers and ratings when present', () => {
    expect(productJsonLd(product)).not.toHaveProperty('offers');
    expect(productJsonLd({ ...product, priceMinor: 125_000, reviews: { count: 2, average: 4.5 } })).toMatchObject({ offers: { price: 1250, priceCurrency: 'LKR' }, aggregateRating: { reviewCount: 2 } });
  });
  it('builds article schema', () => expect(articleJsonLd({ title: 'Guide', description: 'Helpful', path: '/guides/a/', datePublished: '2026-01-01', author: 'Team' })).toMatchObject({ '@type': 'Article', dateModified: '2026-01-01' }));
});
