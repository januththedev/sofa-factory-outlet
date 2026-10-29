import { mapsDirectionsUrl } from '@/lib/settings/get';
import { whatsappLink } from '@/lib/settings/get';
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
  { href: '/trade/', label: 'Trade' },
  { href: '/faq/', label: 'Questions' },
  { href: '/sofa-shop-colombo/', label: 'Sofa shop in Colombo' },
  { href: '/custom-sofas-sri-lanka/', label: 'Custom-made sofas' },
  { href: '/privacy/', label: 'Privacy' },
];

export function Footer({ business }: { business: BusinessSettings }) {
  const whatsapp = business.whatsapp.confirmed
    ? whatsappLink(business.whatsapp.number, 'Hi, I would like to know more about your sofas.')
    : null;
  const phone = business.phone.confirmed ? business.phone.number : null;
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
            <h2 className="mt-5 max-w-xl font-display text-4xl leading-[1.05] sm:text-6xl">
              Come and sit on the sofa that made it onto your shortlist.
            </h2>
            <div className="mt-9 flex flex-wrap gap-3">
              <TLink href="/book-visit/" className="btn-primary">
                Book a showroom visit
              </TLink>
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn border border-bone/25 text-bone hover:bg-bone hover:text-ink"
                >
                  Chat on WhatsApp
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-6 lg:col-span-6 lg:pl-10">
            <nav aria-label="Shop">
              <p className="eyebrow text-clay">Shop</p>
              <ul className="mt-5 space-y-2">
                {SHOP.map((l) => (
                  <li key={l.href}>
                    <TLink href={l.href} className="link-underline flex min-h-11 w-full items-center">
                      {l.label}
                    </TLink>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Company">
              <p className="eyebrow text-clay">Company</p>
              <ul className="mt-5 space-y-2">
                {COMPANY.map((l) => (
                  <li key={l.href}>
                    <TLink href={l.href} className="link-underline flex min-h-11 w-full items-center">
                      {l.label}
                    </TLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="col-span-2 min-w-0">
              <p className="eyebrow text-clay">Showroom</p>
              {address.confirmed ? (
                <address className="mt-5 not-italic text-bone/80">
                  <a
                    href={mapsDirectionsUrl(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 flex-col justify-center py-2"
                  >
                    <span>{address.street}</span>
                    <span>{address.locality}, {address.city}</span>
                    <span className="mt-2 underline underline-offset-4">Get directions</span>
                  </a>
                </address>
              ) : (
                <p className="mt-5 text-bone/80">Showroom details are confirmed when you book.</p>
              )}
              {phone ? (
                <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="mt-2 flex min-h-11 items-center">
                  {phone}
                </a>
              ) : null}
              {socials.length ? (
                <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-underline flex min-h-11 items-center"
                      >
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

        <div
          className="mt-6 flex flex-col justify-between gap-2 border-t border-bone/10 pt-6 text-sm
            text-bone/55 sm:flex-row"
        >
          <p>© {new Date().getFullYear()} Sofa Factory Outlet. Made in Colombo.</p>
          <p>Prices are confirmed at your visit.</p>
        </div>
      </div>
    </footer>
  );
}
