import { cookies } from 'next/headers';
import { bookingCookie, canReadBooking } from '@/lib/security/access';
import { getBookingByReference } from '@/lib/bookings/api';
import { buildIcs } from '@/lib/bookings/ics';
import { getSettings } from '@/lib/settings/get';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  if (
    !(await canReadBooking(
      ref,
      (await cookies()).get(bookingCookie(ref))?.value,
    ))
  )
    return new Response('Booking not found', { status: 404 });
  const summary = await getBookingByReference(ref);
  if (!summary) return new Response('Booking not found', { status: 404 });
  const { business } = await getSettings();
  return new Response(buildIcs(summary, business), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${summary.reference}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
