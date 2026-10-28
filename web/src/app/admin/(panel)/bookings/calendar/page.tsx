import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CalendarView } from '@/components/admin/bookings/calendar-view';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { getCalendar, parseCalendarParams } from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Booking calendar' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole();
  const calendar = await getCalendar(parseCalendarParams(await searchParams));
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Each visit slot, how full it is and who is coming. Cancelled and lost bookings use no place."
        actions={
          <Link href="/admin/bookings/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            <ArrowLeft className="size-4" aria-hidden />
            Booking list
          </Link>
        }
      />
      <CalendarView calendar={calendar} />
    </div>
  );
}
