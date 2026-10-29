import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
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
  const products = await db.select({ id: s.products.id, slug: s.products.slug, name: s.products.name, updatedAt: s.products.updatedAt, images: s.productVariants.images }).from(s.products).leftJoin(s.productVariants, eq(s.productVariants.productId, s.products.id)).where(eq(s.products.status, 'published'));
  const categories = await db.select({ id: s.categories.id, path: s.categories.path, hubFilter: s.categories.hubFilter, updatedAt: s.categories.updatedAt }).from(s.categories);
  const published = await db.select({ categoryId: s.products.categoryId, shape: s.products.shape, material: s.products.material }).from(s.products).where(eq(s.products.status, 'published'));
  return { products, categories: categories.filter((category) => published.some((product) => product.categoryId === category.id && (!category.hubFilter?.shape || category.hubFilter.shape === product.shape) && (!category.hubFilter?.material || category.hubFilter.material === product.material))) };
}, ['seo-sitemap-products-v1'], { tags: ['products'], revalidate: 3600 });

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
  if (name === 'pages') return ['/', '/shop/', '/about-us/', '/factory/', '/visit/', '/trade/', '/book-visit/', '/faq/', '/sofa-shop-colombo/', '/custom-sofas-sri-lanka/', '/guides/'].map((loc) => ({ loc: absolutePage(loc) }));
  if (name === 'guides') return guideEntries();
  const { products, categories } = await catalogueEntries();
  if (name === 'products') return [...new Map(products.map((p) => [p.id, { loc: absolutePage(`/product/${p.slug}/`), lastmod: date(p.updatedAt) }])).values()];
  if (name === 'categories') return [...new Map(categories.map((c) => [c.path, { loc: absolutePage(`/${c.path}/`), lastmod: date(c.updatedAt) }])).values()];
  if (name === 'images') return products.filter((p) => p.images?.length).map((p) => ({ loc: absolutePage(`/product/${p.slug}/`), images: (p.images ?? []).map((image) => ({ loc: new URL(imageUrl(image, 1440), `${siteUrl()}/`).toString(), title: image.alt || p.name })) }));
  return null;
}
