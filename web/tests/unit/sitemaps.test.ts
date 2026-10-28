import { describe, expect, it } from 'vitest';
import { buildSitemapIndex, buildUrlSet } from '@/lib/seo/sitemaps';

describe('sitemap XML', () => {
  it('builds an index', () => expect(buildSitemapIndex(['/sitemaps/pages.xml/'])).toContain('<sitemapindex'));
  it('escapes values and formats dates', () => {
    const xml = buildUrlSet([{ loc: 'https://example.com/a&b/', lastmod: '2026-10-27T12:00:00Z' }]);
    expect(xml).toContain('a&amp;b'); expect(xml).toContain('<lastmod>2026-10-27</lastmod>');
  });
});
