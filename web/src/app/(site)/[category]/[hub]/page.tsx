import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HUB_CONTENT } from '../../../../../content/hubs';
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

type Props = {
  params: Promise<{ category: string; hub: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  const db = await getDb();
  const rows = await db.select({ path: s.categories.path }).from(s.categories);
  return rows.filter((row) => row.path.split('/').length === 2).map((row) => {
    const [category, hub] = row.path.split('/');
    return { category, hub };
  });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, hub } = await params;
  const row = await getCollection(`${category}/${hub}`);
  if (!row) return {};
  const query = parseShopParams(await searchParams);
  const content = HUB_CONTENT[row.path];
  const filtered = Boolean(
    query.q || query.category || query.hub || query.colour?.length || query.material?.length || query.shape?.length
    || query.seats?.length || query.minPrice !== undefined || query.maxPrice !== undefined || query.sort,
  );
  const emptyKnown = row.path === 'sofas/recliners' || row.path === 'tables/coffee';
  const path = !filtered && query.page && query.page > 1 ? `/${row.path}/?page=${query.page}` : `/${row.path}/`;
  return pageMetadata({
    title: content?.title ?? row.name,
    description: content?.metaDescription ?? `Browse ${row.name}.`,
    path,
    noindex: filtered || emptyKnown,
  });
}

export default async function HubPage({ params, searchParams }: Props) {
  const { category, hub } = await params;
  const row = await getCollection(`${category}/${hub}`);
  const content = row && HUB_CONTENT[row.path];
  if (!row || !content || !row.parent) notFound();
  const query = parseShopParams(await searchParams);
  const scope = row.kind === 'hub' ? { hub: row.path } : { category: row.path };
  const result = await searchListing({ ...query, ...scope });
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: row.parent.name, href: `/${row.parent.path}/` },
    { name: row.name, href: `/${row.path}/` },
  ];
  return (
    <main className="site-container pt-24 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pt-32 lg:pb-20">
      <JsonLd data={breadcrumbJsonLd(crumbs.map((crumb) => ({ name: crumb.name, path: crumb.href })))} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 mb-6 break-words font-display text-[clamp(2.5rem,7vw,6rem)] font-light leading-none">
        {content.title}
      </h1>
      <nav aria-label="Sibling collections" className="mb-6 flex flex-wrap gap-2">
        {row.parent.children.filter((child) => child.id !== row.id).map((child) => (
          <TLink className="flex min-h-11 items-center rounded-full border border-line px-4 text-base"
            href={`/${child.path}/`} key={child.id}>
            {child.name}
          </TLink>
        ))}
      </nav>
      <Listing result={result} params={query} path={`/${row.path}/`} {...scope} />
      <HubIntro content={content} />
    </main>
  );
}
