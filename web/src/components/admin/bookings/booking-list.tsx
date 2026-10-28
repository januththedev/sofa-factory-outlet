import Link from 'next/link';
import { inArray } from 'drizzle-orm';
import { changeStatusAction } from '@/app/admin/(panel)/bookings/[id]/actions';
import { bookingCardModel } from './card-model';
import { ContactActions } from './contact-actions';
import { QuickStatus } from './quick-status';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { ArrowDown } from 'lucide-react';
import { ArrowUp } from 'lucide-react';
import { ItemStack } from '@/components/admin/bookings/item-thumb';
import { StatusBadge } from '@/components/admin/bookings/status-badge';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { bookingsQuery } from '@/lib/admin/bookings';
import { formatColomboDateTime } from '@/lib/admin/bookings';
import { formatVisitDate } from '@/lib/admin/bookings';
import { type BookingFilter } from '@/lib/admin/bookings';
import { type BookingListRow } from '@/lib/admin/bookings';
import { formatLkPhone } from '@/lib/phone';

const detailHref = (row: BookingListRow) => `/admin/bookings/${row.id}/`;

function Source({ row }: { row: BookingListRow }) {
  return (
    <>
      <span className="block">{row.source.origin}</span>
      {row.source.detail ? (
        <span className="block max-w-[16rem] truncate text-xs text-mute">{row.source.detail}</span>
      ) : null}
    </>
  );
}

function Phone({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex min-h-11 min-w-11 items-center text-ink-2 hover:text-maroon hover:underline"
    >
      {formatLkPhone(phone)}
    </a>
  );
}

/** The booking list: a table from wide screens up, stacked cards below, so nothing scrolls sideways. */
export async function BookingList({ rows, filter }: { rows: BookingListRow[]; filter: BookingFilter }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-10 text-center">
        <p className="font-display text-xl">No bookings match</p>
        <p className="mt-2 text-base sm:text-sm text-mute">Try a different search, or clear the filters.</p>
      </div>
    );
  }
  const ascending = filter.sort === 'asc';
  const db = await getDb();
  const customers = await db.select({ id: s.customers.id, whatsapp: s.customers.whatsapp })
    .from(s.customers)
    .where(inArray(s.customers.id, rows.map((row) => row.customerId)));
  const whatsappByCustomer = new Map(customers.map((customer) => [customer.id, customer.whatsapp]));
  const sortHref = `/admin/bookings/?${bookingsQuery(filter, { sort: ascending ? 'desc' : 'asc', page: null })}`;
  const SortIcon = ascending ? ArrowUp : ArrowDown;
  return (
    <>
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper lg:block">
        <Table>
          <THead>
            <tr>
              <TH scope="col">Reference</TH>
              <TH scope="col">Customer</TH>
              <TH scope="col" aria-sort={ascending ? 'ascending' : 'descending'}>
                <Link
                  href={sortHref}
                  className="inline-flex min-h-11 min-w-11 items-center gap-1 uppercase hover:text-ink"
                >
                  Visit
                  <SortIcon className="size-3.5" aria-hidden />
                  <span className="sr-only">, change sort order</span>
                </Link>
              </TH>
              <TH scope="col">Products</TH>
              <TH scope="col">Status</TH>
              <TH scope="col">Found us via</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={detailHref(row)}
                    className={
                      'inline-flex min-h-11 min-w-11 items-center break-words font-semibold text-maroon ' +
                      'hover:underline'
                    }
                  >
                    {row.reference}
                  </Link>
                  <span className="block text-xs text-mute">Booked {formatColomboDateTime(row.createdAt)}</span>
                </TD>
                <TD>
                  <span className="block font-medium">{row.customerName}</span>
                  <Phone phone={row.phone} />
                </TD>
                <TD>
                  <span className="block">{formatVisitDate(row.visitDate)}</span>
                  <span className="block text-mute">{row.slotLabel}</span>
                </TD>
                <TD>
                  <ItemStack items={row.items} pieces={row.pieces} />
                </TD>
                <TD>
                  <StatusBadge status={row.status} />
                </TD>
                <TD>
                  <Source row={row} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
        {rows.map((row) => {
          const card = bookingCardModel(row, whatsappByCustomer.get(row.customerId));
          return (
            <li key={row.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={card.href}
                    className="inline-flex min-h-11 min-w-11 items-center font-semibold text-maroon hover:underline"
                  >
                    {row.reference}
                  </Link>
                  <p className="truncate font-medium">{row.customerName}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-base">
                <div>
                  <dt className="eyebrow">Visit</dt>
                  <dd>
                    {formatVisitDate(row.visitDate)}
                    <span className="block text-mute">{row.slotLabel}</span>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Phone</dt>
                  <dd>
                    <Phone phone={row.phone} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="eyebrow mb-1">Products</dt>
                  <dd>
                    <ItemStack items={row.items} pieces={row.pieces} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="eyebrow">Found us via</dt>
                  <dd>
                    <Source row={row} />
                  </dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2">
                <ContactActions callHref={card.callHref} whatsappHref={card.whatsappHref} />
                {card.primaryAction ? (
                  <QuickStatus
                    action={changeStatusAction.bind(null, row.id)}
                    target={card.primaryAction.value}
                    label={card.primaryAction.label}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
