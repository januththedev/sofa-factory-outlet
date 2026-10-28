import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { bookingContacts } from '@/components/admin/bookings/card-model';
import { ContactActions } from '@/components/admin/bookings/contact-actions';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { NoData } from '@/components/admin/visitors/no-data';
import { Badge } from '@/components/ui/badge';
import type { UpcomingVisit } from '@/lib/admin/stats';
import { formatDay } from './format';

export async function UpcomingVisits({ visits, today }: { visits: UpcomingVisit[]; today: string }) {
  if (visits.length === 0) return <NoData label="No visits booked yet" />;
  const db = await getDb();
  const contacts = await db.select({
    id: s.bookings.id,
    phone: s.customers.phone,
    whatsapp: s.customers.whatsapp,
    pieces: sql<number>`coalesce(sum(${s.bookingItems.quantity}), 0)::int`,
  })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .leftJoin(s.bookingItems, eq(s.bookingItems.bookingId, s.bookings.id))
    .where(inArray(s.bookings.id, visits.map((visit) => visit.id)))
    .groupBy(s.bookings.id, s.customers.phone, s.customers.whatsapp);
  const byBooking = new Map(contacts.map((contact) => [contact.id, contact]));
  return (
    <ul className="space-y-3 py-2">
      {visits.map((visit) => {
        const contact = byBooking.get(visit.id);
        const links = bookingContacts(contact?.phone ?? '', contact?.whatsapp);
        return (
          <li key={visit.id} className="rounded-xl border border-line p-3">
            <Link
              href={`/admin/bookings/${visit.id}/`}
              className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 gap-y-2 hover:text-maroon"
            >
              <span className="min-w-0 break-words">
                <span className="block font-medium">{visit.customerName}</span>
                <span className="block text-xs text-mute">{visit.reference}</span>
              </span>
              <span className="text-right text-base sm:text-sm">
                {visit.visitDate === today ? <Badge tone="maroon">Today</Badge> : null}{' '}
                {formatDay(visit.visitDate)}
                <span className="block text-xs text-mute">{visit.slotLabel}</span>
              </span>
            </Link>
            <p className="my-3 text-base text-mute">
              {contact?.pieces ?? 0} {contact?.pieces === 1 ? 'piece' : 'pieces'}
            </p>
            <ContactActions callHref={links.callHref} whatsappHref={links.whatsappHref} />
          </li>
        );
      })}
    </ul>
  );
}
