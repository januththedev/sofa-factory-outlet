import { getBookingByReference } from '@/lib/bookings/api';
import { buildIcs } from '@/lib/bookings/ics';
import { getSettings } from '@/lib/settings/get';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const summary = await getBookingByReference(ref);
  if (!summary) return new Response('Booking not found', { status: 404 });
  const { business } = await getSettings();
  return new Response(buildIcs(summary, business), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${summary.reference}.ics"`, 'Cache-Control': 'no-store',
  } });
}
