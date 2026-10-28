import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CtaSection, lightGhostBtn } from '@/components/pages/cta-section';
import { GuideMeta } from '@/components/pages/guide-meta';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { getAllGuides, getGuideBySlug, guidePath, pickRelated } from '@/lib/guides';
import { articleJsonLd, breadcrumbJsonLd, JsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';

type PageProps = { params: Promise<{ slug: string }> };

// The hubs a guide can point at; the article body links to the specific ones itself.
const RANGES = [
  { href: '/sofas/', label: 'All sofas' },
  { href: '/sofas/l-shape/', label: 'L-shape' },
  { href: '/sofas/u-shape/', label: 'U-shape' },
  { href: '/sofas/sets/', label: 'Sofa sets' },
  { href: '/sofas/velvet/', label: 'Velvet' },
  { href: '/sofas/leather/', label: 'Leather' },
  { href: '/sofas/fabric/', label: 'Fabric' },
] as const;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const guides = await getAllGuides();
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) {
    return pageMetadata({ title: 'Guide not found', description: 'This guide does not exist.', path: guidePath(slug), noindex: true });
  }
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: guidePath(guide.slug),
    image: guide.image ?? undefined,
  });
}

export default async function GuideArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  const related = pickRelated(guide, await getAllGuides());
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides/' },
    { name: guide.title, path: guidePath(guide.slug) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title={guide.title}
        lede={guide.description}
        meta={<GuideMeta datePublished={guide.datePublished} readingMinutes={guide.readingMinutes} />}
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Guides', href: '/guides/' },
          { name: guide.title, href: guidePath(guide.slug) },
        ]}
      />

      <div className="site-container mt-12 mb-24 grid gap-12 lg:mt-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        {guide.toc.length > 0 ? (
          <nav aria-label="In this guide" className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">In this guide</p>
            <ol className="mt-4 space-y-2 text-sm leading-relaxed">
              {guide.toc.map((item) => (
                <li key={item.id} className={item.depth === 3 ? 'pl-4 text-mute' : 'text-ink-2'}>
                  <a href={`#${item.id}`} className="link-underline">
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <article
          className="prose prose-lg max-w-[65ch] overflow-x-auto prose-headings:font-display prose-headings:font-light prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-3xl prose-h3:mt-8 prose-p:leading-relaxed prose-a:text-maroon prose-a:decoration-maroon/40 hover:prose-a:decoration-maroon prose-strong:text-ink prose-img:rounded-[var(--radius-card)]"
          dangerouslySetInnerHTML={{ __html: guide.html }}
        />
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="site-container">
          <h2 id="related-heading" className="text-[clamp(1.8rem,3vw,2.6rem)] font-light leading-[1.05]">
            Related guides
          </h2>
          <ul className="mt-8 grid gap-6 lg:grid-cols-2">
            {related.map((item) => (
              <li key={item.slug}>
                <TLink
                  href={guidePath(item.slug)}
                  className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-paper p-7 transition-colors duration-300 hover:border-ink/30"
                >
                  <h3 className="text-xl font-light leading-[1.15]">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-ink-2">{item.description}</p>
                  <span className="link-underline mt-6 inline-block self-start text-sm font-semibold">Read the guide</span>
                </TLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="ranges-heading" className="site-container mt-16 lg:mt-24">
        <h2 id="ranges-heading" className="text-[clamp(1.8rem,3vw,2.6rem)] font-light leading-[1.05]">
          Browse the ranges
        </h2>
        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {RANGES.map((range) => (
            <li key={range.href}>
              <TLink href={range.href} className="link-underline font-medium">
                {range.label}
              </TLink>
            </li>
          ))}
        </ul>
      </section>

      <CtaSection
        eyebrow="See it in person"
        title="Feel the fabric before you decide"
        body="Reading only gets you so far. Book a showroom visit and the team will put the fabrics, sizes and layouts in front of you."
        actions={
          <>
            <TLink href="/book-visit/" className="btn-primary px-7 py-4">
              Book a visit
            </TLink>
            <TLink href="/shop/" className={lightGhostBtn}>
              Browse the collection
            </TLink>
          </>
        }
      />

      <JsonLd
        data={[
          articleJsonLd({
            title: guide.title,
            description: guide.description,
            path: guidePath(guide.slug),
            datePublished: guide.datePublished,
            dateModified: guide.dateModified ?? undefined,
            author: guide.author,
            image: guide.image ?? undefined,
          }),
          breadcrumbJsonLd(crumbs),
        ]}
      />
    </>
  );
}
