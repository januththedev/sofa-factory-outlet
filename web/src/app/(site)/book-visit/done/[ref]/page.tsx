import { CalendarPlus, MapPin, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingReference } from '@/components/booking/booking-reference';
import { formatVisitDate } from '@/components/booking/calendar';
import { ConfirmationEffects } from '@/components/booking/confirmation-effects';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import { Card } from '@/components/ui/card';
import { getBookingByReference } from '@/lib/bookings/api';
import { bookingWhatsappLink } from '@/lib/bookings/whatsapp';
import { cn } from '@/lib/cn';
import { pageMetadata } from '@/lib/seo/metadata';
import { getSettings, mapsDirectionsUrl } from '@/lib/settings/get';

export const dynamic = 'force-dynamic';
const REFERENCE = /^SFO-B-\d{1,9}$/i;

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return pageMetadata({
    title: 'Your visit is booked',
    description: 'Your Sofa Factory Outlet showroom visit.',
    path: `/book-visit/done/${encodeURIComponent(ref)}/`,
    noindex: true,
  });
}

export default async function BookingDonePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!REFERENCE.test(ref)) notFound();
  const booking = await getBookingByReference(ref);
  if (!booking) notFound();
  const { business } = await getSettings();
  const active = booking.status !== 'cancelled' && booking.status !== 'lost';
  const whatsappHref = business.whatsapp.confirmed
    ? bookingWhatsappLink(booking, business.whatsapp.number)
    : null;
  const address = business.address.confirmed
    ? [business.address.street, business.address.locality, business.address.city].filter(Boolean).join(', ')
    : null;
  const directionsHref = business.map.confirmed
    ? business.map.placeUrl ?? (
      business.map.lat !== null && business.map.lng !== null
        ? `https://www.google.com/maps/dir/?api=1&destination=${business.map.lat},${business.map.lng}`
        : address ? mapsDirectionsUrl(business.address) : null
    )
    : address ? mapsDirectionsUrl(business.address) : null;
  const calendarHref = `/api/bookings/${encodeURIComponent(booking.reference)}/ics/`;

  return (
    <div className="site-container pb-24 pt-24 lg:pb-32 lg:pt-44">
      {active ? <ConfirmationEffects reference={booking.reference} pieces={booking.items.length} /> : null}
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow text-xs">{active ? 'Visit booked' : 'Booking closed'}</p>
        <h1 className="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-light leading-[1]">
          {active ? 'Your visit is booked.' : 'This booking is no longer active.'}
        </h1>
        <Card className="mt-10 min-w-0 p-4 sm:p-10">
          <p className="eyebrow text-xs">Booking reference</p>
          <BookingReference reference={booking.reference} />
          <p className="mt-2 text-base text-mute">Keep this reference and quote it when you contact us.</p>
          <dl className="mt-8 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
            <div>
              <dt className="eyebrow text-xs">Date</dt>
              <dd className="mt-2 text-lg">{formatVisitDate(booking.visitDate)}</dd>
            </div>
            <div>
              <dt className="eyebrow text-xs">Time</dt>
              <dd className="mt-2 text-lg tabular-nums">{booking.slotLabel}</dd>
            </div>
            <div>
              <dt className="eyebrow text-xs">Showroom</dt>
              <dd className="mt-2 text-lg">{address ?? 'Details confirmed when we contact you.'}</dd>
            </div>
          </dl>
          {active ? (
            <section aria-labelledby="done-next" className="mt-8 border-t border-line pt-6">
              <h2 id="done-next" className="font-display text-2xl">What happens next</h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-base text-ink-2">
                <li>We confirm your visit by WhatsApp or phone.</li>
                <li>Your showroom visit is by appointment, at the agreed time.</li>
                <li>Prices are confirmed at the showroom.</li>
              </ol>
            </section>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {active ? (
              <TLink
                href={calendarHref}
                prefetch={false}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary min-h-11 px-5 py-3"
              >
                <CalendarPlus className="size-4" aria-hidden />
                Add to calendar
              </TLink>
            ) : null}
            {directionsHref ? (
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost min-h-11 px-5 py-3"
              >
                <MapPin className="size-4" aria-hidden />
                Get directions
              </a>
            ) : null}
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost min-h-11 px-5 py-3"
              >
                <MessageCircle className="size-4" aria-hidden />
                Message us on WhatsApp
              </a>
            ) : null}
            <TLink href="/shop/" className="btn-ghost min-h-11 px-5 py-3">Back to the shop</TLink>
          </div>
        </Card>
        <section aria-labelledby="done-pieces" className="mt-10">
          <h2 id="done-pieces" className="text-2xl font-light">Your pieces</h2>
          {booking.items.length ? (
            <ul className="mt-6 divide-y divide-line">
              {booking.items.map((item, index) => (
                <li key={`${item.slug ?? item.name}-${index}`} className="flex min-w-0 items-center gap-4 py-4">
                  <div className="size-[72px] shrink-0 overflow-hidden rounded-lg bg-bone-2">
                    {item.image ? (
                      <Picture
                        data={item.image}
                        alt=""
                        sizes="72px"
                        imgClassName={cn(
                          'h-full w-full',
                          item.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover',
                        )}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    {item.slug ? (
                      <TLink
                        href={`/product/${item.slug}/`}
                        className="line-clamp-2 min-h-11 break-words font-display text-lg leading-snug underline"
                      >
                        {item.name}
                      </TLink>
                    ) : <p className="break-words font-display text-lg">{item.name}</p>}
                    <p className="text-base text-mute">
                      {[item.colourName, `Quantity ${item.quantity}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-6 text-base text-ink-2">No pieces chosen yet. You can choose at the showroom.</p>}
        </section>
      </div>
    </div>
  );
}
