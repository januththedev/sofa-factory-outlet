import { buildSitemapIndex } from '@/lib/seo/sitemaps';

export function GET() {
  const xml = buildSitemapIndex(['/sitemaps/pages.xml', '/sitemaps/products.xml', '/sitemaps/categories.xml', '/sitemaps/guides.xml', '/sitemaps/images.xml']);
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
