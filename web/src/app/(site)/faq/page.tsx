import type { Metadata } from 'next';
import { CtaSection } from '@/components/pages/cta-section';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { faqPageJsonLd, getPublicFaqs, groupFaqs } from '@/lib/seo/public-faqs';

export const metadata: Metadata = pageMetadata({
  title: 'Sofa questions answered',
  description:
    'Answers about buying a sofa in Sri Lanka from Sofa Factory Outlet: custom sizes and colours, fabrics, ' +
    'care, prices and visiting the Colombo showroom.',
  path: '/faq/',
});

export default async function FaqPage() {
  const faqs = await getPublicFaqs();
  const sections = groupFaqs(faqs);
  const published = sections.flatMap((section) => section.items);

  return (
    <>
      <PageHeader
        eyebrow="Questions"
        title="Sofa questions, answered"
        lede="What people ask before they buy: sizes, fabrics, colours, care, prices and visiting the showroom."
        breadcrumbs={[{ name: 'Home', href: '/' }, { name: 'Questions', href: '/faq/' }]}
      />

      <nav aria-label="Topics" className="site-container mt-8 flex flex-wrap gap-2">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="btn-ghost min-h-11 px-4 py-2 text-sm">
            {section.title}
          </a>
        ))}
      </nav>

      <div className="site-container mt-10 grid gap-14 lg:mt-16 lg:max-w-[80ch]">
        {sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
            <h2 id={`${section.id}-heading`} className="text-[clamp(1.7rem,3vw,2.4rem)] font-light leading-[1.1]">
              {section.title}
            </h2>
            <div className="mt-5 divide-y divide-line border-y border-line">
              {section.items.map((faq) => (
                <details key={faq.question} className="group py-1">
                  <summary
                    className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3
                      text-lg [&::-webkit-details-marker]:hidden"
                  >
                    <h3 className="font-normal">{faq.question}</h3>
                    <span aria-hidden className="shrink-0 text-2xl text-mute transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 leading-relaxed text-ink-2">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <p className="text-mute">
          Something else? Ask the chat at the bottom of the page, or{' '}
          <TLink href="/visit/" className="underline">visit the showroom</TLink>.
        </p>
      </div>

      <CtaSection
        title="See it, sit on it, then decide"
        body="Book a showroom visit and the team will show you fabrics, sizes and the pieces in person."
        actions={
          <TLink href="/book-visit/" className="btn-primary px-7 py-4">
            Book a visit
          </TLink>
        }
      />

      <JsonLd data={[faqPageJsonLd(published), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Questions', path: '/faq/' }])]} />
    </>
  );
}
