import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { imageUrl } from '@/lib/images/urls';
import { siteUrl } from '@/lib/env';

export type SitemapUrl = { loc: string; lastmod?: string; images?: Array<{ loc: string; title?: string }> };
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const date = (value?: string | Date | null) => value ? new Date(value).toISOString().slice(0, 10) : undefined;
export const absolutePage = (value: string) => new URL(value.endsWith('/') ? value : `${value}/`, `${siteUrl()}/`).toString();
const absoluteUrl = (value: string) => new URL(value, `${siteUrl()}/`).toString();

export function buildSitemapIndex(paths: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((item) => `<sitemap><loc>${esc(absoluteUrl(item))}</loc></sitemap>`).join('')}</sitemapindex>`;
}
export function buildUrlSet(entries: SitemapUrl[]): string {
  const imageNs = entries.some((entry) => entry.images?.length) ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>${entries.map((entry) => `<url><loc>${esc(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${esc(date(entry.lastmod) ?? '')}</lastmod>` : ''}${entry.images?.map((image) => `<image:image><image:loc>${esc(image.loc)}</image:loc>${image.title ? `<image:title>${esc(image.title)}</image:title>` : ''}</image:image>`).join('') ?? ''}</url>`).join('')}</urlset>`;
}

const catalogueEntries = unstable_cache(async () => {
  const db = await getDb();
  const indexable = and(eq(s.products.status, 'published'), eq(s.products.noindex, false));
  const products = await db.select({ id: s.products.id, slug: s.products.slug, name: s.products.name, updatedAt: s.products.updatedAt, images: s.productVariants.images }).from(s.products).leftJoin(s.productVariants, eq(s.productVariants.productId, s.products.id)).where(indexable);
  const categories = await db.select({ id: s.categories.id, path: s.categories.path, kind: s.categories.kind, hubFilter: s.categories.hubFilter, updatedAt: s.categories.updatedAt }).from(s.categories);
  const published = await db.select({ path: s.categories.path, shape: s.products.shape, material: s.products.material }).from(s.products).innerJoin(s.categories, eq(s.categories.id, s.products.categoryId)).where(eq(s.products.status, 'published'));
  // Same rule as the listing search: a category holds its own and its sub-categories' pieces; a hub
  // (a filtered view such as sofas/l-shape) holds its parent's pieces that match its filter.
  const holds = (category: (typeof categories)[number], product: (typeof published)[number]) => {
    const scope = category.kind === 'hub' ? category.path.split('/')[0] : category.path;
    const inScope = product.path === category.path || product.path === scope || product.path.startsWith(`${scope}/`);
    return inScope && (!category.hubFilter?.shape || category.hubFilter.shape === product.shape)
      && (!category.hubFilter?.material || category.hubFilter.material === product.material);
  };
  return { products, categories: categories.filter((category) => published.some((product) => holds(category, product))) };
}, ['seo-sitemap-products-v2'], { tags: ['products', 'categories'], revalidate: 3600 });

const guideEntries = unstable_cache(async (): Promise<SitemapUrl[]> => {
  const dir = path.join(process.cwd(), 'content', 'guides');
  const files = await readdir(dir);
  const entries = await Promise.all(files.filter((file) => file.endsWith('.md')).map(async (file) => {
    const raw = await readFile(path.join(dir, file), 'utf8');
    const slug = /^slug:\s*["']?([^\r\n"']+)/m.exec(raw)?.[1]?.trim();
    const modified = /^dateModified:\s*["']?([^\r\n"']+)/m.exec(raw)?.[1]?.trim() ?? /^datePublished:\s*["']?([^\r\n"']+)/m.exec(raw)?.[1]?.trim();
    return slug ? { loc: absolutePage(`/guides/${slug}/`), lastmod: modified } : null;
  }));
  return entries.filter((entry) => entry !== null);
}, ['seo-sitemap-guides-v1'], { tags: ['guides'], revalidate: 3600 });

export async function sitemapByName(name: string): Promise<SitemapUrl[] | null> {
  if (name === 'pages') return ['/', '/shop/', '/about-us/', '/factory/', '/visit/', '/trade/', '/faq/', '/privacy/', '/sofa-shop-colombo/', '/custom-sofas-sri-lanka/', '/guides/'].map((loc) => ({ loc: absolutePage(loc) }));
  if (name === 'guides') return guideEntries();
  const { products, categories } = await catalogueEntries();
  if (name === 'products') return [...new Map(products.map((p) => [p.id, { loc: absolutePage(`/product/${p.slug}/`), lastmod: date(p.updatedAt) }])).values()];
  if (name === 'categories') return [...new Map(categories.map((c) => [c.path, { loc: absolutePage(`/${c.path}/`), lastmod: date(c.updatedAt) }])).values()];
  if (name === 'images') return products.filter((p) => p.images?.length).map((p) => ({ loc: absolutePage(`/product/${p.slug}/`), images: (p.images ?? []).map((image) => ({ loc: new URL(imageUrl(image, 1440), `${siteUrl()}/`).toString(), title: image.alt || p.name })) }));
  return null;
}
