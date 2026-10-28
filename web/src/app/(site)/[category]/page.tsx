import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HUB_CONTENT } from '../../../../content/hubs';
import { Breadcrumbs } from '@/components/catalogue/breadcrumbs';
import { HubIntro } from '@/components/catalogue/hub-intro';
import { Listing } from '@/components/catalogue/listing';
import { getCollection } from '@/components/catalogue/server';
import { searchListing } from '@/components/catalogue/server';
import { TLink } from '@/components/site/transition';
import { parseShopParams } from '@/lib/catalogue/search';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';

const reserved = new Set(
  'shop product admin api blob guides cart book-visit about-us factory visit trade privacy review'.split(' '),
);
type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  const db = await getDb();
  const rows = await db.select({ path: s.categories.path }).from(s.categories);
  return rows.filter((row) => !row.path.includes('/') && !reserved.has(row.path))
    .map((row) => ({ category: row.path }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  const row = await getCollection(category);
  if (!row) return {};
  const query = parseShopParams(await searchParams);
  const content = HUB_CONTENT[row.path];
  const filtered = Boolean(
    query.q || query.category || query.hub || query.colour?.length || query.material?.length || query.shape?.length
    || query.seats?.length || query.minPrice !== undefined || query.maxPrice !== undefined || query.sort,
  );
  const path = !filtered && query.page && query.page > 1 ? `/${row.path}/?page=${query.page}` : `/${row.path}/`;
  return pageMetadata({
    title: content?.title ?? row.name,
    description: content?.metaDescription ?? `Browse ${row.name}.`,
    path,
    noindex: filtered,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const row = await getCollection(category);
  const content = row && HUB_CONTENT[row.path];
  if (!row || !content || row.path.includes('/')) notFound();
  const query = parseShopParams(await searchParams);
  const result = await searchListing({ ...query, category: row.path });
  const crumbs = [{ name: 'Home', href: '/' }, { name: row.name, href: `/${row.path}/` }];
  return (
    <main className="site-container pt-24 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pt-32 lg:pb-20">
      <JsonLd data={breadcrumbJsonLd(crumbs.map((crumb) => ({ name: crumb.name, path: crumb.href })))} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 mb-6 break-words font-display text-[clamp(2.5rem,7vw,6rem)] font-light leading-none">
        {content.title}
      </h1>
      {row.children.length ? (
        <nav aria-label="Related collections" className="mb-6 flex flex-wrap gap-2">
          {row.children.map((child) => (
            <TLink className="flex min-h-11 items-center rounded-full border border-line px-4 text-base"
              href={`/${child.path}/`} key={child.id}>
              {child.name}
            </TLink>
          ))}
        </nav>
      ) : null}
      <Listing result={result} params={query} path={`/${row.path}/`} category={row.path} />
      <HubIntro content={content} />
    </main>
  );
}
