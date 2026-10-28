import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { HUB_CONTENT } from '../../../../content/hubs';
import { Breadcrumbs } from '@/components/catalogue/breadcrumbs';
import { HubIntro } from '@/components/catalogue/hub-intro';
import { Pagination } from '@/components/catalogue/pagination';
import { ShopGrid } from '@/components/catalogue/shop-grid';
import { SortMenu } from '@/components/catalogue/sort-menu';
import { ShopFilters } from '@/components/catalogue/filters/shop-filters';
import { TLink } from '@/components/site/transition';
import { searchProducts, parseShopParams } from '@/lib/catalogue/search';
import { getDb } from '@/lib/db'; import * as s from '@/lib/db/schema';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/jsonld'; import { pageMetadata } from '@/lib/seo/metadata';

const reserved = new Set('shop product admin api blob guides cart book-visit about-us factory visit trade privacy review'.split(' '));
type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function find(path: string) { const db = await getDb(); return db.query.categories.findFirst({ where: eq(s.categories.path, path), with: { children: true } }); }
export async function generateStaticParams() { const db = await getDb(); const rows = await db.select({ path: s.categories.path }).from(s.categories); return rows.filter((r) => !r.path.includes('/') && !reserved.has(r.path)).map((r) => ({ category: r.path })); }
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> { const { category } = await params; const row = await find(category); if (!row) return {}; const query = parseShopParams(await searchParams); const content = HUB_CONTENT[row.path]; const filtered = Boolean(query.q || query.colour?.length || query.material?.length || query.shape?.length || query.seats?.length || query.sort); const path = !filtered && query.page && query.page > 1 ? `/${row.path}/?page=${query.page}` : `/${row.path}/`; return pageMetadata({ title: content?.title ?? row.name, description: content?.metaDescription ?? `Browse ${row.name}.`, path, noindex: filtered }); }
export default async function CategoryPage({ params, searchParams }: Props) { const { category } = await params; const row = await find(category); const content = row && HUB_CONTENT[row.path]; if (!row || !content || row.path.includes('/')) notFound(); const query = parseShopParams(await searchParams); const result = await searchProducts({ ...query, category: row.path }); const crumbs = [{ name: 'Home', href: '/' }, { name: row.name, href: `/${row.path}/` }];
  return <main className="site-container py-12 lg:py-20"><JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href })))} /><Breadcrumbs items={crumbs} /><h1 className="mt-8 font-display text-[clamp(3rem,7vw,6rem)] font-light leading-none">{content.title}</h1><HubIntro content={content} />
    {row.children.length ? <nav aria-label="Related collections" className="mb-10 flex flex-wrap gap-2">{row.children.map((child) => <TLink className="rounded-full border border-line px-4 py-2 text-sm" href={`/${child.path}/`} key={child.id}>{child.name}</TLink>)}</nav> : null}
    <div className="flex justify-between gap-4 border-t border-line pt-8"><p>{result.total} {result.total === 1 ? 'product' : 'products'}</p><SortMenu value={query.sort} /></div><div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr]"><ShopFilters facets={result.facets} categories={[]} showCategories={false} /><div>{result.items.length ? <ShopGrid products={result.items} /> : <Empty />}<Pagination page={result.page} pages={result.pages} path={`/${row.path}/`} params={query} /></div></div></main>; }
function Empty() { return <div className="rounded-[var(--radius-card)] bg-paper p-8"><h2 className="font-display text-3xl">Let’s find the right piece</h2><p className="mt-3">Ask us about current options or book a visit to discuss colours and sizes.</p><TLink href="/book-visit/" className="btn btn-primary mt-6">Book a visit / ask us</TLink></div>; }
