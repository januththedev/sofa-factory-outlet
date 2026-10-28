import type { Metadata } from 'next';
import { GuideMeta } from '@/components/pages/guide-meta';
import { Note } from '@/components/pages/note';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { getAllGuides, guidePath } from '@/lib/guides';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Guides',
  description:
    'Practical guides from the Sofa Factory Outlet team: the best sofa fabrics for Sri Lanka’s humid climate, and how to choose between L-shape, U-shape and 3+2+1.',
  path: '/guides/',
});

export default async function GuidesIndexPage() {
  const guides = await getAllGuides();

  return (
    <>
      <PageHeader
        eyebrow="Guides"
        title="Sofa guides"
        lede="Practical, plain answers about fabrics, shapes and living with a sofa, written by the people who make them."
      />

      <section aria-labelledby="all-guides-heading" className="site-container mt-14 mb-24 lg:mt-20">
        <h2 id="all-guides-heading" className="sr-only">
          All guides
        </h2>
        {guides.length === 0 ? (
          <Note label="Coming soon">
            <p>
              New guides are being written. Until the first one is published, the team can answer any question at the
              showroom or on WhatsApp.
            </p>
          </Note>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <TLink
                  href={guidePath(guide.slug)}
                  className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-paper p-7 transition-colors duration-300 hover:border-ink/30 lg:p-9"
                >
                  <GuideMeta datePublished={guide.datePublished} readingMinutes={guide.readingMinutes} />
                  <h3 className="mt-4 text-2xl font-light leading-[1.1] lg:text-3xl">{guide.title}</h3>
                  <p className="mt-4 leading-relaxed text-ink-2">{guide.description}</p>
                  <span className="link-underline mt-7 inline-block self-start text-sm font-semibold">Read the guide</span>
                </TLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
