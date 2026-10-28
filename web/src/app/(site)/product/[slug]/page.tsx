import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarkdownIt from 'markdown-it';
import { careNotesFor } from '@content/care';
import { Breadcrumbs } from '@/components/catalogue/breadcrumbs';
import { CompleteTheLook } from '@/components/catalogue/complete-the-look';
import { ProductTile } from '@/components/catalogue/product-tile';
import { DimensionsDiagram } from '@/components/product/dimensions-diagram';
import { ProductExperience } from '@/components/product/product-experience';
import { productBySlug, publishedSlugs, relatedProducts } from '@/lib/catalogue/product';
import { JsonLd, breadcrumbJsonLd, productJsonLd } from '@/lib/seo/jsonld';

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await publishedSlugs()).map((slug) => ({ slug }));
}

function plainSummary(source: string): string {
  const plain = source.replace(/!\[[^\]]*]\([^)]*\)/g, ' ').replace(/\[([^\]]+)]\([^)]*\)/g, '$1').replace(/[#>*_`~-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= 160) return plain;
  const clipped = plain.slice(0, 156);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > 145 ? boundary : 156).trimEnd()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product) notFound();
  const title = product.seoTitle ?? `${product.name} | Sofa Factory Outlet`;
  const description = product.seoDescription ?? plainSummary(product.descriptionMd);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/product/${product.slug}/` },
    robots: product.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description, type: 'website', url: `/product/${product.slug}/` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product) notFound();
  const related = await relatedProducts(product.id, 4);
  const categoryPath = `/${product.category.path}/`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: product.category.name, path: categoryPath }, { name: product.name, path: `/product/${product.slug}/` }];
  const sellingPoints = product.sellingPoints?.split('\n').map((point) => point.replace(/^-\s*/, '').trim()).filter(Boolean) ?? [];
  const attributes = Object.entries(product.attributes);

  return (
    <main className="pb-24 lg:pb-0">
      <JsonLd data={productJsonLd(product)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <div className="site-container pb-16 pt-8 lg:pb-24 lg:pt-12">
        <Breadcrumbs items={crumbs.map(({ name, path }) => ({ name, href: path }))} className="mb-8" />
        <ProductExperience product={product} />
        <div className="mt-16 grid gap-12 border-t border-line pt-12 lg:grid-cols-12 lg:gap-16">
          <section aria-labelledby="description-heading" className="lg:col-span-7">
            <h2 id="description-heading" className="font-display text-4xl font-light">About this piece</h2>
            <div className="prose prose-lg mt-6 max-w-none prose-headings:font-display prose-a:text-maroon" dangerouslySetInnerHTML={{ __html: markdown.render(product.descriptionMd) }} />
            {sellingPoints.length ? <ul className="mt-8 grid gap-3">{sellingPoints.map((point) => <li key={point} className="flex gap-3"><span aria-hidden className="text-maroon">●</span><span>{point}</span></li>)}</ul> : null}
          </section>
          <aside className="space-y-10 lg:col-span-5">
            <section aria-labelledby="details-heading"><h2 id="details-heading" className="font-display text-3xl font-light">Details</h2><dl className="mt-5 divide-y divide-line border-y border-line">{product.material ? <div className="flex justify-between py-3"><dt>Material</dt><dd className="capitalize">{product.material}</dd></div> : null}{product.shape ? <div className="flex justify-between py-3"><dt>Shape</dt><dd className="capitalize">{product.shape.replace('-', ' ')}</dd></div> : null}{product.seats ? <div className="flex justify-between py-3"><dt>Seats</dt><dd>{product.seats}</dd></div> : null}</dl>{attributes.map(([name, values]) => <p key={name} className="mt-4 text-sm">Available {name.toLowerCase()}: {values.join(', ')}, confirmed at your visit</p>)}</section>
            <DimensionsDiagram dimensions={product.dimensions} />
            <section aria-labelledby="care-heading"><h2 id="care-heading" className="font-display text-3xl font-light">Care</h2><ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-2">{careNotesFor(product.material).map((note) => <li key={note}>{note}</li>)}</ul></section>
          </aside>
        </div>
        <CompleteTheLook anchors={[{ productId: product.id, variantId: product.variants[0]?.id }]} />
        {related.length ? <section aria-labelledby="related-heading" className="py-12 sm:py-16"><h2 id="related-heading" className="font-display text-[clamp(2rem,5vw,3.5rem)] font-light leading-none">More like this</h2><div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-6">{related.map((item) => <ProductTile key={item.id} product={item} />)}</div></section> : null}
      </div>
    </main>
  );
}
