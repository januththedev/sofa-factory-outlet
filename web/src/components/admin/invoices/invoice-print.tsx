import Image from 'next/image';
import { formatInvoiceDate, paymentMethodLabel, sourceLabel, statusBadge } from '@/lib/admin/invoices';
import type { InvoiceView } from '@/lib/invoices/api';
import { formatLkr } from '@/lib/money';
import type { SettingsMap } from '@/lib/settings/types';

function addressLines(address: SettingsMap['business']['address']): string[] {
  return [
    address.street,
    address.locality,
    address.city,
    address.postalCode,
    address.country,
  ].filter((part): part is string => Boolean(part));
}

export function InvoicePrint({ invoice, settings }: { invoice: InvoiceView; settings: SettingsMap }) {
  const business = settings.business;
  const invoiceSettings = settings.invoice;
  const bank = invoiceSettings.bank;
  const bankLines = [bank.bank, bank.branch, bank.accountName, bank.accountNumber]
    .filter((part): part is string => Boolean(part));
  const terms = invoice.terms || invoiceSettings.terms;
  const title = invoice.type === 'quotation' ? 'QUOTATION' : 'INVOICE';

  return (
    <article className="invoice-print mx-auto w-full max-w-[210mm] bg-white p-6 text-ink sm:p-10">
      {invoice.status === 'draft' ? (
        <p className="mb-6 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm font-semibold text-warn">
          DRAFT — not yet issued
        </p>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
        <Image
          src="/brand/logo.png"
          alt={business.name}
          width={180}
          height={72}
          className="h-14 w-auto object-contain"
          priority
        />
        <div className="text-right">
          <p className="font-display text-3xl">{title}</p>
          <p className="mt-1 font-semibold">{invoice.number ?? 'Draft'}</p>
          <p className="text-sm text-mute">Status: {statusBadge(invoice.status).label}</p>
          <p className="text-sm text-mute">
            {invoice.issuedAt ? formatInvoiceDate(invoice.issuedAt) : 'Not issued'}
          </p>
          <p className="text-sm text-mute">Source: {sourceLabel(invoice.source)}</p>
          <p className="text-sm text-mute">
            {invoice.booking ? `Booking ${invoice.booking.reference}` : 'No booking'}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">From</h2>
          <p className="mt-2 font-semibold">{business.name}</p>
          <p className="text-sm text-ink-2">{addressLines(business.address).join(', ')}</p>
          {business.phone.number ? <p className="text-sm text-ink-2">{business.phone.number}</p> : null}
          {business.email.address ? <p className="text-sm text-ink-2">{business.email.address}</p> : null}
          {invoiceSettings.vatNumber ? (
            <p className="text-sm text-ink-2">VAT no. {invoiceSettings.vatNumber}</p>
          ) : null}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">Bill to</h2>
          <p className="mt-2 font-semibold">{invoice.customer.name}</p>
          <p className="text-sm text-ink-2">{invoice.customer.phone}</p>
          {invoice.customer.address ? <p className="text-sm text-ink-2">{invoice.customer.address}</p> : null}
          {invoice.customer.city ? <p className="text-sm text-ink-2">{invoice.customer.city}</p> : null}
          {invoice.customer.email ? <p className="text-sm text-ink-2">{invoice.customer.email}</p> : null}
        </div>
      </section>

      {bankLines.length ? (
        <section className="mt-6 rounded-md border border-line bg-bone/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">Bank details</h2>
          <p className="mt-2 text-sm text-ink-2">{bankLines.join(' · ')}</p>
        </section>
      ) : null}

      <section className="mt-6">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-y border-line bg-bone/50 text-xs uppercase tracking-wider text-mute">
            <tr>
              <th className="px-2 py-2 font-semibold">Description</th>
              <th className="px-2 py-2 font-semibold">Colour</th>
              <th className="px-2 py-2 text-right font-semibold">Qty</th>
              <th className="px-2 py-2 text-right font-semibold">Unit</th>
              <th className="px-2 py-2 text-right font-semibold">Discount</th>
              <th className="px-2 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-2 py-2">{line.description}</td>
                <td className="px-2 py-2 text-ink-2">{line.colourName ?? '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatLkr(line.unitMinor, { decimals: true })}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatLkr(line.discountMinor ?? 0, { decimals: true })}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatLkr(line.lineMinor, { decimals: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 ml-auto w-full max-w-sm space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatLkr(invoice.subtotalMinor, { decimals: true })}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Discount</span>
          <span className="tabular-nums">− {formatLkr(invoice.discountMinor, { decimals: true })}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Delivery</span>
          <span className="tabular-nums">{formatLkr(invoice.deliveryMinor, { decimals: true })}</span>
        </div>
        {invoice.taxMinor ? (
          <div className="flex justify-between gap-4">
            <span>{invoiceSettings.taxLabel}</span>
            <span className="tabular-nums">{formatLkr(invoice.taxMinor, { decimals: true })}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
          <span>Total</span><span className="tabular-nums">{formatLkr(invoice.totalMinor, { decimals: true })}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Paid</span>
          <span className="tabular-nums">{formatLkr(invoice.paidMinor, { decimals: true })}</span>
        </div>
        <div className="flex justify-between gap-4 font-semibold text-warn">
          <span>Balance</span>
          <span className="tabular-nums">{formatLkr(invoice.balanceMinor, { decimals: true })}</span>
        </div>
      </section>

      {invoice.payments.length ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">Payments</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {invoice.payments.map((payment) => (
              <li key={payment.id}>
                {formatInvoiceDate(payment.paidOn)} · {paymentMethodLabel(payment.method)} ·{' '}
                {formatLkr(payment.amountMinor, { decimals: true })}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invoice.deliveryDate ? (
        <p className="mt-6 text-sm">
          <span className="font-semibold">Delivery date:</span>{' '}
          {formatInvoiceDate(invoice.deliveryDate)}
        </p>
      ) : null}
      {invoice.notes ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{invoice.notes}</p>
        </section>
      ) : null}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">Warranty</h2>
        <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{invoiceSettings.warranty}</p>
      </section>
      <section className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-mute">Terms</h2>
        <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{terms}</p>
      </section>

      <section className="mt-12 flex flex-wrap justify-between gap-8 text-sm">
        <div className="w-56 border-t border-ink/40 pt-2 text-center text-mute">Authorised signature</div>
        <div className="w-56 border-t border-ink/40 pt-2 text-center text-mute">Customer signature</div>
      </section>
    </article>
  );
}
