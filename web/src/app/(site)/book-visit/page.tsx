import type { Metadata } from 'next';
import { BookingForm } from '@/components/booking/booking-form';
import { cellState } from '@/components/booking/calendar';
import { VisitTimesNotice } from '@/components/booking/unavailable';
import { type DayAvailability, getAvailability } from '@/lib/bookings/api';
import { pageMetadata } from '@/lib/seo/metadata';
import { getSettings, whatsappLink } from '@/lib/settings/get';

// Availability changes with every booking, so this page is never prerendered.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Book a showroom visit',
    description: 'Choose a day and a time to visit the Sofa Factory Outlet showroom.',
    path: '/book-visit/',
    noindex: true,
  });
}

async function loadAvailability(): Promise<DayAvailability[] | null> {
  try {
    return await getAvailability();
  } catch (error) {
    console.error('[book-visit] could not load availability:', error);
    return null;
  }
}

export default async function BookVisitPage() {
  const [availability, settings] = await Promise.all([loadAvailability(), getSettings()]);
  const { business } = settings;
  const whatsappHref = whatsappLink(business.whatsapp.number, 'Hi, I would like to book a showroom visit.');
  const hasOpenTimes = availability?.some((day) => cellState(day) === 'open') ?? false;

  return (
    <div className="site-container pb-24 pt-32 lg:pb-32 lg:pt-44">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <header className="lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
          <p className="eyebrow">Book a visit</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-light leading-[1]">Book a showroom visit</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
            Choose a day and a time that suits you. Nothing is paid online: prices, fabrics and delivery are confirmed when you visit.
          </p>
          {whatsappHref ? (
            <p className="mt-6 text-sm text-mute">
              Prefer to talk first?{' '}
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-maroon underline underline-offset-4">
                Message us on WhatsApp
              </a>
            </p>
          ) : null}
        </header>
        <div className="lg:col-span-8">
          {availability && hasOpenTimes ? (
            <BookingForm availability={availability} businessName={business.name} whatsappHref={whatsappHref} />
          ) : (
            <VisitTimesNotice kind={availability ? 'none' : 'error'} whatsappHref={whatsappHref} />
          )}
        </div>
      </div>
    </div>
  );
}
