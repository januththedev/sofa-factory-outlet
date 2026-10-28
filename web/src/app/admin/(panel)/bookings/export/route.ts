import { parseBookingFilters, streamBookingsCsv } from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';
import { colomboToday } from '@/lib/bookings/rules';

export const dynamic = 'force-dynamic';

// The same filters as the list (status, dates, product, search, sort), minus the page: the file
// holds every booking that matches. Rows are written to the response a batch at a time.
export async function GET(request: Request) {
  await requireRole();
  const params = new URL(request.url).searchParams;
  const filter = parseBookingFilters(Object.fromEntries(params));
  const encoder = new TextEncoder();
  const chunks = streamBookingsCsv(filter);
  // The byte-order mark makes Excel read names and notes as UTF-8.
  let prefix = '﻿';
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) {
          controller.close();
        } else {
          controller.enqueue(encoder.encode(prefix + next.value));
          prefix = '';
        }
      } catch (error) {
        console.error('[admin-bookings] CSV export failed:', error);
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${colomboToday()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
