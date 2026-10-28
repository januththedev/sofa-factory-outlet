import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarkdownIt from 'markdown-it';
import { careNotesFor } from '@content/care';
import { Breadcrumbs } from '@/components/catalogue/breadcrumbs';
import { CompleteTheLook } from '@/components/catalogue/complete-the-look';
import { ProductTile } from '@/components/catalogue/product-tile';
import { BackToResults } from '@/components/product/back-to-results';
import { DimensionsDiagram } from '@/components/product/dimensions-diagram';
import { ProductExperience } from '@/components/product/product-experience';
import { productBySlug } from '@/lib/catalogue/product';
import { publishedSlugs } from '@/lib/catalogue/product';
import { relatedProducts } from '@/lib/catalogue/product';
import { JsonLd } from '@/lib/seo/jsonld';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { productJsonLd } from '@/lib/seo/jsonld';

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await publishedSlugs()).map((slug) => ({ slug }));
}

function plainSummary(source: string): string {
  const plain = source.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: product.category.name, path: categoryPath },
    { name: product.name, path: `/product/${product.slug}/` },
  ];
  const sellingPoints = product.sellingPoints?.split('\n')
    .map((point) => point.replace(/^-\s*/, '').trim()).filter(Boolean) ?? [];
  const attributes = Object.entries(product.attributes);
  return (
    <main className="pb-[calc(12rem+env(safe-area-inset-bottom))] lg:pb-0">
      <JsonLd data={productJsonLd(product)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <div className="site-container pb-16 pt-24 lg:pb-24 lg:pt-32">
        <BackToResults categoryPath={categoryPath} />
        <Breadcrumbs items={crumbs.map(({ name, path }) => ({ name, href: path }))} className="mb-6" />
        <ProductExperience key={product.id} product={product} />
        <div className="mt-10 divide-y divide-line border-y border-line">
          <details open className="py-3">
            <summary className="min-h-11 cursor-pointer py-3 font-display text-2xl">About this piece</summary>
            <div className="prose mt-4 max-w-prose text-base prose-headings:font-display prose-a:text-maroon"
              dangerouslySetInnerHTML={{ __html: markdown.render(product.descriptionMd) }} />
            {sellingPoints.length ? (
              <ul className="mt-6 grid max-w-prose gap-3 text-base">
                {sellingPoints.map((point) => <li key={point}>{point}</li>)}
              </ul>
            ) : null}
          </details>
          <details className="py-3">
            <summary className="min-h-11 cursor-pointer py-3 font-display text-2xl">Details and dimensions</summary>
            <div className="grid gap-6 py-4 md:grid-cols-2">
              <div>
                <dl className="divide-y divide-line text-base">
                  {product.material ? (
                    <div className="flex justify-between gap-3 py-3">
                      <dt>Material</dt><dd className="capitalize">{product.material}</dd>
                    </div>
                  ) : null}
                  {product.shape ? (
                    <div className="flex justify-between gap-3 py-3">
                      <dt>Shape</dt><dd className="capitalize">{product.shape.replace(/-/g, ' ')}</dd>
                    </div>
                  ) : null}
                  {product.seats ? (
                    <div className="flex justify-between gap-3 py-3"><dt>Seats</dt><dd>{product.seats}</dd></div>
                  ) : null}
                </dl>
                {attributes.map(([name, values]) => (
                  <p key={name} className="mt-4 text-base">
                    Available {name.toLowerCase()}: {values.join(', ')}, confirmed at your visit
                  </p>
                ))}
                {!product.dimensions ? (
                  <p className="mt-4 text-base">Dimensions are confirmed at your visit.</p>
                ) : null}
              </div>
              <DimensionsDiagram dimensions={product.dimensions} />
            </div>
          </details>
          <details className="py-3">
            <summary className="min-h-11 cursor-pointer py-3 font-display text-2xl">Care</summary>
            <ul className="max-w-prose space-y-3 py-4 text-base leading-relaxed text-ink-2">
              {careNotesFor(product.material).map((note) => <li key={note}>{note}</li>)}
            </ul>
          </details>
        </div>
        <CompleteTheLook anchors={[{ productId: product.id, variantId: product.variants[0]?.id }]} />
        {related.length ? (
          <section aria-labelledby="related-heading" className="py-12 sm:py-16">
            <h2 id="related-heading" className="font-display text-[clamp(2rem,5vw,3.5rem)] font-light leading-none">
              More like this
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-x-3 gap-y-7 min-[340px]:grid-cols-2
              md:grid-cols-3 lg:grid-cols-4">
              {related.map((item) => <ProductTile key={item.id} product={item} />)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
