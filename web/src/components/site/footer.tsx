import { mapsDirectionsUrl, whatsappLink } from '@/lib/settings/get';
import type { BusinessSettings } from '@/lib/settings/types';
import { FooterWordmark } from './footer-wordmark';
import { TLink } from './transition';

const SHOP = [
  { href: '/sofas/', label: 'Sofas' },
  { href: '/beds/', label: 'Beds' },
  { href: '/chairs/', label: 'Chairs' },
  { href: '/tables/', label: 'Tables' },
  { href: '/shop/', label: 'Everything' },
];
const COMPANY = [
  { href: '/factory/', label: 'The factory' },
  { href: '/about-us/', label: 'About us' },
  { href: '/visit/', label: 'Visit the showroom' },
  { href: '/book-visit/', label: 'Book a visit' },
  { href: '/privacy/', label: 'Privacy' },
];

export function Footer({ business }: { business: BusinessSettings }) {
  const whatsapp = whatsappLink(business.whatsapp.number, 'Hi, I would like to know more about your sofas.');
  const { address } = business;
  const socials = [
    { label: 'Instagram', href: business.social.instagram },
    { label: 'Facebook', href: business.social.facebook },
    { label: 'TikTok', href: business.social.tiktok },
    { label: 'YouTube', href: business.social.youtube },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  return (
    <footer className="relative overflow-hidden bg-ink text-bone">
      <div className="site-container pb-6 pt-24 lg:pt-32">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow text-clay">See it before you buy it</p>
            <h2 className="mt-5 max-w-xl font-display text-4xl leading-[1.05] sm:text-6xl">Come and sit on the sofa that made it onto your shortlist.</h2>
            <div className="mt-9 flex flex-wrap gap-3">
              <TLink href="/book-visit/" className="btn-primary">
                Book a showroom visit
              </TLink>
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn border border-bone/25 text-bone hover:bg-bone hover:text-ink">
                  Chat on WhatsApp
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:pl-10">
            <nav aria-label="Shop">
              <p className="eyebrow text-clay">Shop</p>
              <ul className="mt-5 space-y-3">
                {SHOP.map((l) => (
                  <li key={l.href}>
                    <TLink href={l.href} className="link-underline">
                      {l.label}
                    </TLink>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Company">
              <p className="eyebrow text-clay">Company</p>
              <ul className="mt-5 space-y-3">
                {COMPANY.map((l) => (
                  <li key={l.href}>
                    <TLink href={l.href} className="link-underline">
                      {l.label}
                    </TLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="col-span-2 sm:col-span-1">
              <p className="eyebrow text-clay">Showroom</p>
              <address className="mt-5 space-y-1 not-italic text-bone/80">
                <p>{address.street}</p>
                <p>
                  {address.locality}, {address.city}
                </p>
              </address>
              <a href={mapsDirectionsUrl(address)} target="_blank" rel="noopener noreferrer" className="link-underline mt-3 inline-block">
                Get directions
              </a>
              {socials.length ? (
                <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="link-underline">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <FooterWordmark />

        <div className="mt-6 flex flex-col justify-between gap-2 border-t border-bone/10 pt-6 text-sm text-bone/55 sm:flex-row">
          <p>© {new Date().getFullYear()} Sofa Factory Outlet. Made in Colombo.</p>
          <p>Prices are confirmed at your visit.</p>
        </div>
      </div>
    </footer>
  );
}
