import Link from 'next/link';
import { StatusBadge } from '@/components/admin/bookings/status-badge';
import { Badge } from '@/components/ui/badge';
import { formatColomboDateTime } from '@/lib/admin/bookings';
import { formatVisitDate } from '@/lib/admin/bookings';
import { INVOICE_STATUS_LABELS } from '@/lib/admin/bookings';
import { invoiceTitle } from '@/lib/admin/bookings';
import { type InvoiceLink } from '@/lib/admin/bookings';
import { type PastBooking } from '@/lib/admin/bookings';
import { formatLkr } from '@/lib/money';

/** Bookings as a list of links: reference, visit date and status. */
export function BookingLinks({ bookings, empty }: { bookings: PastBooking[]; empty: string }) {
  if (bookings.length === 0) return <p className="text-base sm:text-sm text-mute">{empty}</p>;
  return (
    <ul className="divide-y divide-line text-base sm:text-sm">
      {bookings.map((booking) => (
        <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div>
            <Link
              href={`/admin/bookings/${booking.id}/`}
              className={
                'inline-flex min-h-11 min-w-11 items-center break-words font-semibold text-maroon ' +
                'hover:underline'
              }
            >
              {booking.reference}
            </Link>
            <span className="block text-mute">
              {formatVisitDate(booking.visitDate)}, {booking.slotLabel}
            </span>
          </div>
          <StatusBadge status={booking.status} />
        </li>
      ))}
    </ul>
  );
}

/** Invoices and quotations as a list of links to the invoice pages. */
export function InvoiceLinks({ invoices, empty }: { invoices: InvoiceLink[]; empty: string }) {
  if (invoices.length === 0) return <p className="text-base sm:text-sm text-mute">{empty}</p>;
  return (
    <ul className="divide-y divide-line text-base sm:text-sm">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div>
            <Link
              href={`/admin/invoices/${invoice.id}/`}
              className={
                'inline-flex min-h-11 min-w-11 items-center break-words font-semibold text-maroon ' +
                'hover:underline'
              }
            >
              {invoiceTitle(invoice)}
            </Link>
            <span className="block text-mute">
              {invoice.type === 'quotation' ? 'Quotation' : 'Invoice'} · {formatColomboDateTime(invoice.createdAt)}
            </span>
          </div>
          <div className="text-right">
            <Badge tone={invoice.status === 'cancelled' ? 'neutral' : invoice.status === 'paid' ? 'good' : 'warn'}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
            <span className="mt-1 block font-medium">{formatLkr(invoice.totalMinor)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
