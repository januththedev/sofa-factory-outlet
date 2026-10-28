import type { Metadata } from 'next';
import { CtaSection, lightGhostBtn } from '@/components/pages/cta-section';
import { LazyMap } from '@/components/pages/lazy-map';
import { Note } from '@/components/pages/note';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { breadcrumbJsonLd, furnitureStoreJsonLd, JsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { getSettings, mapsDirectionsUrl, mapsEmbedUrl, whatsappLink } from '@/lib/settings/get';
import { formatHours } from '@/lib/settings/hours';

export const metadata: Metadata = pageMetadata({
  title: 'Visit the showroom',
  description:
    'Find the Sofa Factory Outlet showroom at 67 Pallidora Road, Dehiwala, Colombo. Book a visit to see and sit on every piece and choose your fabric.',
  path: '/visit/',
});

const PLACEHOLDER_DIRECTIONS = 'We will add directions from main roads and parking details here once confirmed.';

export default async function VisitPage() {
  const [settings, store] = await Promise.all([getSettings(), furnitureStoreJsonLd()]);
  const { business, hours } = settings;
  const hoursLines = hours.confirmed ? formatHours(hours) : null;
  const directionsUrl = mapsDirectionsUrl(business.address);
  const whatsappUrl = whatsappLink(business.whatsapp.number, 'Hi, I would like to visit the showroom.');
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Visit', path: '/visit/' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Visit"
        title="Visit the showroom"
        lede="See it. Sit on it. Then decide. Fabrics are shown and chosen at the showroom, and the team agrees the size, colour and layout with you there."
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Visit', href: '/visit/' },
        ]}
      />

      <section aria-labelledby="find-us-heading" className="site-container mt-14 grid gap-10 lg:mt-20 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <h2 id="find-us-heading" className="text-[clamp(1.9rem,3.2vw,2.6rem)] font-light leading-[1.05]">
            Find us
          </h2>
          <address className="mt-6 not-italic leading-relaxed">
            <p className="font-semibold">{business.address.street}</p>
            <p>
              {business.address.locality}, {business.address.city}
            </p>
          </address>
          <div className="mt-7 leading-relaxed text-ink-2">
            {hoursLines ? (
              <>
                <h3 className="text-lg font-normal">Opening hours</h3>
                <ul className="mt-3 space-y-1">
                  {hoursLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Visits are by appointment. Pick a day and a time that suits you and we will confirm it.</p>
            )}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <TLink href="/book-visit/" className="btn-primary px-7 py-4">
              Book a visit
            </TLink>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-7 py-4">
              Get directions
            </a>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-7 py-4">
                WhatsApp us
              </a>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-7">
          <LazyMap
            title={`Map of ${business.address.street}, ${business.address.locality}`}
            src={mapsEmbedUrl(business.address)}
            className="min-h-[22rem] overflow-hidden rounded-[var(--radius-card)] bg-bone-2 lg:h-full"
          />
        </div>
      </section>

      <section aria-label="Directions and parking" className="site-container mt-16 grid gap-6 lg:mt-24 lg:grid-cols-2">
        <div>
          <h2 className="text-[clamp(1.6rem,2.6vw,2.2rem)] font-light leading-[1.05]">How to find us</h2>
          {/* placeholder: the directions from main roads are unknown until the client confirms them */}
          <Note className="mt-5">
            <p>{PLACEHOLDER_DIRECTIONS}</p>
          </Note>
        </div>
        <div>
          <h2 className="text-[clamp(1.6rem,2.6vw,2.2rem)] font-light leading-[1.05]">Parking</h2>
          {/* placeholder: parking details are unknown until the client confirms them */}
          <Note className="mt-5">
            <p>{PLACEHOLDER_DIRECTIONS}</p>
          </Note>
        </div>
      </section>

      <CtaSection
        eyebrow="Book ahead"
        title="Pick a day and a time"
        body="Book the day and the time that suits you, and the team confirms the appointment with you before you set off."
        actions={
          <>
            <TLink href="/book-visit/" className="btn-primary px-7 py-4">
              Book a visit
            </TLink>
            <TLink href="/shop/" className={lightGhostBtn}>
              Browse the collection first
            </TLink>
          </>
        }
      />

      <JsonLd data={[store, breadcrumbJsonLd(crumbs)]} />
    </>
  );
}
