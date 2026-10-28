import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BookingSheet } from '@/components/admin/bookings/booking-sheet';
import { PRINT_CSS } from '@/components/admin/bookings/booking-sheet';
import { PrintButton } from '@/components/admin/bookings/print-button';
import { buttonStyles } from '@/components/ui/button';
import { getBookingSheet } from '@/lib/admin/bookings';
import { parseRecordId } from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';
import { getSettings } from '@/lib/settings/get';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Booking sheet' };

export default async function BookingPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole();
  const bookingId = parseRecordId((await params).id);
  if (bookingId === null) notFound();
  const sheet = await getBookingSheet(bookingId);
  if (!sheet) notFound();
  const settings = await getSettings();

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <div data-print="hide" className="mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/bookings/${bookingId}/`} className={buttonStyles({ variant: 'ghost', size: 'md' })}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to the booking
        </Link>
        <PrintButton />
      </div>
      <BookingSheet sheet={sheet} businessName={settings.business.name} />
    </div>
  );
}
