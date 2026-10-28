import { CalendarPlus, MapPin, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  const whatsappHref = bookingWhatsappLink(booking, business.whatsapp.number);
  const address = [business.address.street, business.address.locality, business.address.city].filter(Boolean).join(', ');
  const calendarHref = `/api/bookings/${encodeURIComponent(booking.reference)}/ics/`;

  return (
    <div className="site-container pb-24 pt-32 lg:pb-32 lg:pt-44">
      {active ? <ConfirmationEffects reference={booking.reference} pieces={booking.items.length} /> : null}
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow">{active ? 'Visit booked' : 'Booking closed'}</p>
        <h1 className="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-light leading-[1]">{active ? 'Your visit is booked.' : 'This booking is no longer active.'}</h1>

        <Card className="mt-10 p-6 sm:p-10">
          <p className="eyebrow">Booking reference</p>
          <p className="mt-3 break-all font-display text-[clamp(2.2rem,7vw,4.2rem)] font-light leading-none tracking-tight text-maroon">{booking.reference}</p>
          <p className="mt-4 text-sm text-mute">{active ? 'Keep this reference and quote it if you message us.' : 'Message us on WhatsApp with this reference if you would like to book again.'}</p>

          <dl className="mt-8 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Date</dt>
              <dd className="mt-2 text-lg">{formatVisitDate(booking.visitDate)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Time</dt>
              <dd className="mt-2 text-lg tabular-nums">{booking.slotLabel}</dd>
            </div>
            <div>
              <dt className="eyebrow">Showroom</dt>
              <dd className="mt-2 text-lg">{address}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            {active ? (
              <a href={calendarHref} className="btn-primary px-7 py-4">
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Add to calendar
              </a>
            ) : null}
            <a href={mapsDirectionsUrl(business.address)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-7 py-4">
              <MapPin className="h-4 w-4" aria-hidden />
              Get directions
            </a>
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-ghost px-7 py-4">
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp the showroom
              </a>
            ) : null}
          </div>
        </Card>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <section aria-labelledby="done-pieces">
            <h2 id="done-pieces" className="text-2xl font-light">
              Your pieces
            </h2>
            {booking.items.length ? (
              <ul className="mt-6 divide-y divide-line">
                {booking.items.map((item, index) => (
                  <li key={`${item.slug ?? item.name}-${index}`} className="flex items-center gap-4 py-4 first:pt-0">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-bone-2">
                      {item.image ? (
                        <Picture
                          data={item.image}
                          alt=""
                          sizes="64px"
                          imgClassName={cn('h-full w-full', item.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover')}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      {item.slug ? (
                        <TLink href={`/product/${item.slug}/`} className="font-display text-lg leading-snug hover:underline">
                          {item.name}
                        </TLink>
                      ) : (
                        <p className="font-display text-lg leading-snug">{item.name}</p>
                      )}
                      <p className="text-sm text-mute">
                        {[item.colourName, `Quantity ${item.quantity}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-ink-2">No pieces chosen yet. That is fine: you can look around and choose at the showroom.</p>
            )}
          </section>

          <section aria-labelledby="done-next">
            <h2 id="done-next" className="text-2xl font-light">
              What happens next
            </h2>
            <ol className="mt-6 list-decimal space-y-4 pl-5 text-ink-2 marker:font-semibold marker:text-maroon">
              <li>Your visit is saved under the reference above.</li>
              <li>Come at your chosen time. Photos or measurements of your room are handy to bring, if you have them.</li>
              <li>Prices, fabrics and delivery are confirmed at your visit. Nothing is paid online.</li>
              {whatsappHref ? <li>Need to change the time? Message us on WhatsApp with your reference.</li> : null}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
