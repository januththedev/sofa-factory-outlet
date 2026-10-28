import type { Metadata } from 'next';
import { CtaSection } from '@/components/pages/cta-section';
import { lightGhostBtn } from '@/components/pages/cta-section';
import { LazyMap } from '@/components/pages/lazy-map';
import { Note } from '@/components/pages/note';
import { TLink } from '@/components/site/transition';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { furnitureStoreJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { getSettings } from '@/lib/settings/get';
import { mapsDirectionsUrl } from '@/lib/settings/get';
import { mapsEmbedUrl } from '@/lib/settings/get';
import { formatHours } from '@/lib/settings/hours';

export const metadata: Metadata = pageMetadata({
  title: 'Visit the showroom',
  description:
    'Find the Sofa Factory Outlet showroom, get directions and book a visit to try the sofas and choose your fabric.',
  path: '/visit/',
});

const PLACEHOLDER_DIRECTIONS = 'Ask the team about directions and parking when booking your visit.';

export default async function VisitPage() {
  const [settings, store] = await Promise.all([getSettings(), furnitureStoreJsonLd()]);
  const { business, hours } = settings;
  const hoursLines = hours.confirmed ? formatHours(hours) : null;
  const directionsUrl = mapsDirectionsUrl(business.address);
  const phone = business.phone.confirmed ? business.phone.number : null;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Visit', path: '/visit/' },
  ];

  return (
    <>
      <section
        aria-labelledby="find-us-heading"
        className="site-container grid gap-6 pt-6 lg:grid-cols-12 lg:gap-16 lg:pt-16"
      >
        <div className="min-w-0 lg:col-span-5">
          <header>
            <p className="eyebrow text-xs">Visit the showroom</p>
            <h1 className="mt-3 break-words text-balance text-[clamp(1.8rem,5vw,3.6rem)] font-light leading-tight">
              {business.name}
            </h1>
          </header>
          <h2 id="find-us-heading" className="sr-only scroll-mt-24">
            Find us
          </h2>
          <address className="mt-4 break-words text-base not-italic leading-relaxed">
            <p className="font-semibold">{business.address.street}</p>
            <p>
              {business.address.locality}, {business.address.city}
            </p>
          </address>
          <div className="mt-3 text-base leading-relaxed text-ink-2">
            <h3 className="font-semibold">Opening hours</h3>
            {hoursLines ? (
              <>
                <ul className="mt-1 space-y-1">
                  {hoursLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {hours.note ? <p className="mt-2">{hours.note}</p> : null}
                {hours.closedDates.length > 0 ? (
                  <p className="mt-2">Special closures are shown when you choose a booking date.</p>
                ) : null}
              </>
            ) : (
              <p>Opening hours are confirmed when booking your visit.</p>
            )}
          </div>
          <div className="mt-5 flex flex-col gap-3 [&>a]:min-h-11 [&>a]:w-full">
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-6 py-3">
              Get directions
            </a>
            {phone ? (
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="btn-ghost px-6 py-3">
                Call
              </a>
            ) : null}
            <TLink href="/book-visit/" className="btn-ghost px-6 py-3">
              Book a visit
            </TLink>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <LazyMap
            title={`Map of ${business.address.street}, ${business.address.locality}`}
            src={mapsEmbedUrl(business.address)}
          />
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline mt-3 min-h-11 min-w-11 text-base text-maroon"
          >
            Open in Maps
          </a>
          <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-ink-2">
            Try the sofas, compare fabrics and talk through the size, colour and layout with the team.
          </p>
          {!business.address.confirmed ? (
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Please confirm the showroom address with the team when booking, before you set off.
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-label="Directions and parking"
        className="site-container mt-10 grid gap-6 lg:mt-24 lg:grid-cols-2"
      >
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
        body={
          'Book a day and time that suits you. The team confirms your appointment before you set off.'
        }
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
