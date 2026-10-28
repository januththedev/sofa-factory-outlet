import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Download } from 'lucide-react';
import { BookingFilters } from '@/components/admin/bookings/filters';
import { BookingList } from '@/components/admin/bookings/booking-list';
import { Pagination } from '@/components/admin/bookings/pagination';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { bookingsQuery } from '@/lib/admin/bookings';
import { BOOKING_STATUSES } from '@/lib/admin/bookings';
import { STATUS_LABELS } from '@/lib/admin/bookings';
import { countNewBookings } from '@/lib/admin/bookings';
import { listBookedProducts } from '@/lib/admin/bookings';
import { listBookings } from '@/lib/admin/bookings';
import { parseBookingFilters } from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Bookings' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole();
  const filter = parseBookingFilters(await searchParams);
  const [result, newCount, products] = await Promise.all([
    listBookings(filter),
    countNewBookings(),
    listBookedProducts(),
  ]);
  const hasFilter = Boolean(filter.q || filter.status || filter.from || filter.to || filter.productId);
  const exportQuery = bookingsQuery(filter, { page: null });
  const pageHref = (page: number) => `/admin/bookings/?${bookingsQuery(filter, { page })}`;

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Showroom visits booked on the website, with the pieces each customer chose."
        actions={
          <>
            <Link href="/admin/bookings/calendar/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
              <CalendarDays className="size-4" aria-hidden />
              Calendar
            </Link>
            <details className="relative">
              <summary className="min-h-11 min-w-11 cursor-pointer rounded-full border border-line px-5 py-3">
                More actions
              </summary>
              <div className="mt-2 rounded-xl border border-line bg-paper p-2">
                <Link
                  href={`/admin/bookings/export/${exportQuery ? `?${exportQuery}` : ''}`}
                  download
                  prefetch={false}
                  className={buttonStyles({ variant: 'ghost', size: 'md' })}
                >
                  <Download className="size-4" aria-hidden />
                  Export CSV
                  <span className="sr-only">{hasFilter ? ' of the current filters' : ' of all bookings'}</span>
                </Link>
              </div>
            </details>
          </>
        }
      />

      <p className="mb-6 text-base sm:text-sm" role="status">
        <Link
          href="/admin/bookings/?status=new&sort=asc"
          className={
            'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-maroon/10 px-4 font-semibold ' +
            'text-maroon ' +
            'hover:bg-maroon/15'
          }
        >
          {newCount} new
          <span className="sr-only">
            {' '}
            {newCount === 1 ? 'booking' : 'bookings'} waiting for a first contact. Show them.
          </span>
        </Link>
      </p>

      <BookingFilters
        key={bookingsQuery(filter)}
        filter={filter}
        products={products}
        statuses={BOOKING_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
      />
      <BookingList rows={result.rows} filter={filter} />
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={result.total === 1 ? 'booking' : 'bookings'}
        hrefFor={pageHref}
      />
    </div>
  );
}
