import type { Metadata } from 'next';
import { CtaSection, lightGhostBtn } from '@/components/pages/cta-section';
import { Note } from '@/components/pages/note';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { JsonLd, organizationJsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { getSettings, whatsappLink } from '@/lib/settings/get';

export const metadata: Metadata = pageMetadata({
  title: 'For the trade',
  description:
    'Custom sofas and furniture for interior designers, architects and apartment developers: custom sizes, fabrics and colours, made to order at factory-direct prices.',
  path: '/trade/',
});

// Only what the captured site supports: custom sizes, fabrics and colours, made to order.
const OFFER = [
  {
    title: 'Custom sizes',
    body: 'Pieces are made to order, so a sofa can be built to the measurement your room, show unit or client needs instead of a fixed catalogue size.',
  },
  {
    title: 'Fabrics and colours',
    body: 'Durable fabrics in many colours and designs — velvet, leather, corduroy and woven covers among them — with the fabric and colour chosen for each project.',
  },
  {
    title: 'Made to order',
    body: 'Each piece is built in our own Colombo workshop after the order, and sold without a middleman or showroom markup.',
  },
  {
    title: 'After-sales support',
    body: 'Support for repairs, adjustments and inquiries continues after delivery, so the pieces you specify stay looked after.',
  },
] as const;

const HOW_IT_WORKS = [
  'Send the project details on WhatsApp or book a showroom visit, with the room sizes and the look you are after.',
  'Choose the fabric, size, colour and layout with the team at the showroom — samples are shown and chosen there.',
  'Prices and terms are confirmed with you directly, and nothing is built before you have agreed them.',
] as const;

export default async function TradePage() {
  const [settings, organisation] = await Promise.all([getSettings(), organizationJsonLd()]);
  const whatsappUrl = whatsappLink(
    settings.business.whatsapp.number,
    'Hi, I would like to discuss a trade or project enquiry.',
  );

  return (
    <>
      <PageHeader
        eyebrow="For the trade"
        title="Made to order for your projects"
        lede="Interior designers, architects and apartment developers work with the factory directly: choose the fabric, size, colour and layout, and each piece is built to order at factory-direct prices."
      />

      <section aria-labelledby="offer-heading" className="site-container mt-14 lg:mt-20">
        <h2 id="offer-heading" className="max-w-[20ch] text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]">
          What the factory can offer
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {OFFER.map((item) => (
            <li key={item.title} className="rounded-[var(--radius-card)] border border-line bg-paper p-7">
              <h3 className="text-xl font-normal">{item.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-2">{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-[62ch] leading-relaxed text-mute">
          Sofas and sofa sets are the core of the range, alongside beds, chairs, tables, ottomans and cushions.
        </p>
      </section>

      <section aria-labelledby="how-heading" className="site-container mt-20 lg:mt-28">
        <h2 id="how-heading" className="max-w-[20ch] text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]">
          How a trade order works
        </h2>
        <ol className="mt-10 grid gap-5 lg:max-w-[70ch]">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="flex gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-7">
              <span className="font-display text-lg text-maroon">0{index + 1}</span>
              <p className="leading-relaxed text-ink-2">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 lg:max-w-[70ch]">
          {/* placeholder: trade terms are unknown until the client agrees them */}
          <Note label="Trade terms">
            <p>
              Trade terms — pricing for volume, lead times and minimum quantities — are agreed with you directly. We will
              publish them here once they are confirmed.
            </p>
          </Note>
        </div>
      </section>

      <CtaSection
        title="Start a project enquiry"
        body="Send the details of the project on WhatsApp, or book a showroom visit and talk it through with the team in person."
        actions={
          <>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-7 py-4">
                Enquire on WhatsApp
              </a>
            ) : null}
            <TLink href="/book-visit/" className={whatsappUrl ? lightGhostBtn : 'btn-primary px-7 py-4'}>
              Book a visit
            </TLink>
          </>
        }
      />

      <JsonLd data={organisation} />
    </>
  );
}
