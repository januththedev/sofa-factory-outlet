import { CtaSection } from '@/components/pages/cta-section';
import { lightGhostBtn } from '@/components/pages/cta-section';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { breadcrumbJsonLd, furnitureStoreJsonLd, JsonLd } from '@/lib/seo/jsonld';
import { faqPageJsonLd, getPublicFaqs } from '@/lib/seo/public-faqs';
import { getSettings, whatsappLink } from '@/lib/settings/get';

export type IntentContent = {
  path: string;
  crumb: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** Short reasons, each a heading and one or two sentences. Only facts the client's own site states. */
  points: Array<{ title: string; body: string }>;
  stepsTitle: string;
  steps: string[];
  links: Array<{ label: string; href: string }>;
  /** FAQ tags whose questions are shown (and marked up) on this page. */
  faqTags: string[];
  whatsappText: string;
};

/**
 * A page written for one search ("sofa shop in Colombo", "custom sofas in Sri Lanka"): a plain answer,
 * the reasons, how it works, where to look next, the matching questions, and one way to act.
 */
export async function IntentLanding({ content }: { content: IntentContent }) {
  const [settings, store, faqs] = await Promise.all([getSettings(), furnitureStoreJsonLd(), getPublicFaqs()]);
  const { business } = settings;
  const whatsappUrl = business.whatsapp.confirmed ? whatsappLink(business.whatsapp.number, content.whatsappText) : null;
  const questions = faqs.filter((faq) => faq.tags.some((tag) => content.faqTags.includes(tag))).slice(0, 6);
  const address = business.address.confirmed
    ? [business.address.street, business.address.locality, business.address.city].filter(Boolean).join(', ')
    : null;

  return (
    <>
      <PageHeader
        eyebrow={content.eyebrow}
        title={content.title}
        lede={content.lede}
        breadcrumbs={[{ name: 'Home', href: '/' }, { name: content.crumb, href: content.path }]}
        actions={
          <>
            <TLink href="/book-visit/" className="btn-primary px-6 py-3">Book a showroom visit</TLink>
            <TLink href="/shop/" className="btn-ghost px-6 py-3">Browse the collection</TLink>
          </>
        }
      />

      <section aria-labelledby="why-heading" className="site-container mt-12 lg:mt-20">
        <h2 id="why-heading" className="max-w-[22ch] text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]">
          Why buy from the factory
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:mt-10">
          {content.points.map((point) => (
            <li key={point.title} className="rounded-[var(--radius-card)] border border-line bg-paper p-7">
              <h3 className="text-xl font-normal">{point.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-2">{point.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-heading" className="site-container mt-12 lg:mt-24">
        <h2 id="steps-heading" className="max-w-[22ch] text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]">
          {content.stepsTitle}
        </h2>
        <ol className="mt-8 grid gap-4 lg:max-w-[70ch]">
          {content.steps.map((step, index) => (
            <li key={step} className="flex gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-6">
              <span className="font-display text-lg text-maroon">0{index + 1}</span>
              <p className="leading-relaxed text-ink-2">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-[62ch] leading-relaxed text-mute">
          {address
            ? `The showroom is at ${address}.`
            : 'The showroom address and opening hours are confirmed with you when you book a visit.'}
        </p>
      </section>

      <section aria-labelledby="browse-heading" className="site-container mt-12 lg:mt-24">
        <h2 id="browse-heading" className="text-[clamp(1.7rem,3vw,2.4rem)] font-light leading-[1.1]">
          Where to start
        </h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {content.links.map((link) => (
            <li key={link.href}>
              <TLink href={link.href} className="btn-ghost min-h-11 px-5 py-2">{link.label}</TLink>
            </li>
          ))}
        </ul>
      </section>

      {questions.length ? (
        <section aria-labelledby="questions-heading" className="site-container mt-12 lg:mt-24 lg:max-w-[80ch]">
          <h2 id="questions-heading" className="text-[clamp(1.7rem,3vw,2.4rem)] font-light leading-[1.1]">
            Common questions
          </h2>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {questions.map((faq) => (
              <details key={faq.question} className="group py-1">
                <summary
                  className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg
                    [&::-webkit-details-marker]:hidden"
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
          <p className="mt-4">
            <TLink href="/faq/" className="underline">All questions and answers</TLink>
          </p>
        </section>
      ) : null}

      <CtaSection
        title="Come and sit on it first"
        body="Book a time to visit the showroom. The team will show you fabrics, sizes and finished pieces."
        actions={
          <>
            <TLink href="/book-visit/" className="btn-primary px-7 py-4">Book a visit</TLink>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={lightGhostBtn}>
                Ask on WhatsApp
              </a>
            ) : null}
          </>
        }
      />

      <JsonLd
        data={[
          store,
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: content.crumb, path: content.path }]),
          ...(questions.length ? [faqPageJsonLd(questions)] : []),
        ]}
      />
    </>
  );
}
