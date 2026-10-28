import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CalendarView } from '@/components/admin/bookings/calendar-view';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { calendarAgenda } from '@/components/admin/bookings/calendar-agenda';
import { getCalendar } from '@/lib/admin/bookings';
import { parseCalendarParams } from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Booking calendar' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole();
  const requested = parseCalendarParams(await searchParams);
  const calendar = await getCalendar(requested);
  const dayCalendar = calendarAgenda(calendar);
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
      <CalendarView calendar={calendar} dayCalendar={dayCalendar} />
    </div>
  );
}
