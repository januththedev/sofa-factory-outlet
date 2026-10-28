import { buildUrlSet, sitemapByName } from '@/lib/seo/sitemaps';

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name.replace(/\.xml$/, '');
  const entries = await sitemapByName(name);
  if (!entries) return new Response('Not found', { status: 404 });
  return new Response(buildUrlSet(entries), { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
