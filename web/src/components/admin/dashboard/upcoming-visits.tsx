import Link from 'next/link';
import { NoData } from '@/components/admin/visitors/no-data';
import { Badge } from '@/components/ui/badge';
import type { UpcomingVisit } from '@/lib/admin/stats';
import { formatDay } from './format';

export function UpcomingVisits({ visits, today }: { visits: UpcomingVisit[]; today: string }) {
  if (visits.length === 0) return <NoData label="No visits booked yet" />;
  return (
    <ul className="divide-y divide-line">
      {visits.map((visit) => (
        <li key={visit.id}>
          <Link
            href={`/admin/bookings/${visit.id}/`}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 hover:text-maroon"
          >
            <span className="min-w-0">
              <span className="block font-medium">{visit.customerName}</span>
              <span className="block text-xs text-mute">{visit.reference}</span>
            </span>
            <span className="text-right text-sm">
              {visit.visitDate === today ? <Badge tone="maroon">Today</Badge> : null}{' '}
              {formatDay(visit.visitDate)}
              <span className="block text-xs text-mute">{visit.slotLabel}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
