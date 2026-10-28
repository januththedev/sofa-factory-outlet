import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ItemStack } from '@/components/admin/bookings/item-thumb';
import { StatusBadge } from '@/components/admin/bookings/status-badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  bookingsQuery,
  formatColomboDateTime,
  formatVisitDate,
  type BookingFilter,
  type BookingListRow,
} from '@/lib/admin/bookings';
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
    <a href={`tel:${phone}`} className="text-ink-2 hover:text-maroon hover:underline">
      {formatLkPhone(phone)}
    </a>
  );
}

/** The booking list: a table from wide screens up, stacked cards below, so nothing scrolls sideways. */
export function BookingList({ rows, filter }: { rows: BookingListRow[]; filter: BookingFilter }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-10 text-center">
        <p className="font-display text-xl">No bookings match</p>
        <p className="mt-2 text-sm text-mute">Try a different search, or clear the filters.</p>
      </div>
    );
  }
  const ascending = filter.sort === 'asc';
  const sortHref = `/admin/bookings/?${bookingsQuery(filter, { sort: ascending ? 'desc' : 'asc', page: null })}`;
  const SortIcon = ascending ? ArrowUp : ArrowDown;
  return (
    <>
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper xl:block">
        <Table>
          <THead>
            <tr>
              <TH scope="col">Reference</TH>
              <TH scope="col">Customer</TH>
              <TH scope="col" aria-sort={ascending ? 'ascending' : 'descending'}>
                <Link href={sortHref} className="inline-flex items-center gap-1 uppercase hover:text-ink">
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
                  <Link href={detailHref(row)} className="font-semibold text-maroon hover:underline">
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

      <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={detailHref(row)} className="font-semibold text-maroon hover:underline">
                  {row.reference}
                </Link>
                <p className="truncate font-medium">{row.customerName}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
          </li>
        ))}
      </ul>
    </>
  );
}
