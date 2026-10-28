import Link from 'next/link';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatColomboDateTime } from '@/lib/admin/bookings';
import type { CustomerRow } from '@/lib/admin/customers';

const detailHref = (row: CustomerRow) => `/admin/customers/${row.id}/`;

function Phone({ row }: { row: CustomerRow }) {
  return (
    <a href={`tel:${row.phone}`} className="text-ink-2 hover:text-maroon hover:underline">
      {row.phoneLabel}
    </a>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The customer list: a table from medium screens up, stacked cards below, so nothing scrolls sideways. */
export function CustomerList({ rows, searching }: { rows: CustomerRow[]; searching: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-10 text-center">
        <p className="font-display text-xl">{searching ? 'No customers match' : 'No customers yet'}</p>
        <p className="mt-2 text-sm text-mute">
          {searching
            ? 'Try a name, a phone number or a city, written differently.'
            : 'Customers appear here when someone books a visit or an invoice is made. You can also add a walk-in.'}
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper md:block">
        <Table>
          <THead>
            <tr>
              <TH scope="col">Name</TH>
              <TH scope="col">Phone</TH>
              <TH scope="col">City</TH>
              <TH scope="col" className="text-right">
                Bookings
              </TH>
              <TH scope="col" className="text-right">
                Invoices
              </TH>
              <TH scope="col">Last activity</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link href={detailHref(row)} className="font-semibold text-maroon hover:underline">
                    {row.name}
                  </Link>
                  {row.email ? (
                    <span className="block max-w-[16rem] truncate text-xs text-mute">{row.email}</span>
                  ) : null}
                </TD>
                <TD>
                  <Phone row={row} />
                </TD>
                <TD>{row.city ?? <span className="text-mute">–</span>}</TD>
                <TD className="text-right tabular-nums">{row.bookings}</TD>
                <TD className="text-right tabular-nums">{row.invoices}</TD>
                <TD className="text-mute">{formatColomboDateTime(row.lastActivity)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
            <Link href={detailHref(row)} className="font-semibold text-maroon hover:underline">
              {row.name}
            </Link>
            <p className="mt-1 text-sm">
              <Phone row={row} />
              {row.city ? <span className="text-mute"> · {row.city}</span> : null}
            </p>
            <p className="mt-2 text-sm text-mute">
              {plural(row.bookings, 'booking', 'bookings')} · {plural(row.invoices, 'invoice', 'invoices')}
            </p>
            <p className="text-xs text-mute">Last activity {formatColomboDateTime(row.lastActivity)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
