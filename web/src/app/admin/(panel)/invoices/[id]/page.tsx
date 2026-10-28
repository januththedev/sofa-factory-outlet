import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { InvoiceActions } from '@/components/admin/invoices/invoice-actions';
import { InvoicePrint } from '@/components/admin/invoices/invoice-print';
import { SourceBadge } from '@/components/admin/invoices/source-badge';
import { StatusBadge } from '@/components/admin/invoices/status-badge';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  formatInvoiceDate,
  paymentMethodLabel,
  reviewRequestLink,
} from '@/lib/admin/invoices';
import { requireRole } from '@/lib/auth/session';
import { colomboToday } from '@/lib/bookings/rules';
import { createShareLink, getInvoice } from '@/lib/invoices/api';
import { formatLkr } from '@/lib/money';
import { getSettings } from '@/lib/settings/get';
import { findInvoiceConvertedFrom } from '../query';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoice',
};

type Params = Promise<{ id: string }>;
const idSchema = z.coerce.number().int().positive();

const printStyles = `
@page { size: A4; margin: 14mm; }
@media print {
  body { background: #fff; }
  body * { visibility: hidden; }
  .invoice-print, .invoice-print * { visibility: visible; }
  .invoice-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0; }
  .no-print { display: none !important; }
}
`;

export default async function InvoiceDetailPage({ params }: { params: Params }) {
  const session = await requireRole();
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  const invoice = await getInvoice(parsed.data);
  if (!invoice) notFound();
  const settings = await getSettings();
  const today = colomboToday();
  let shareUrl: string | null = null;

  if (invoice.status !== 'draft') {
    try {
      const path = await createShareLink(invoice.id);
      const requestHeaders = await headers();
      const host = requestHeaders.get('host');
      const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${protocol}://${host}` : 'http://localhost:3000');
      shareUrl = new URL(path, base).toString();
    } catch (error) {
      console.error('[invoices] could not create share link:', error);
    }
  }

  const convertedInvoice = invoice.type === 'quotation'
    ? await findInvoiceConvertedFrom(invoice.id)
    : null;
  const reviewUrl = settings.business.map.googleReviewUrl;
  const reviewLink = invoice.status === 'paid' && reviewUrl
    ? reviewRequestLink(invoice.customer.whatsapp || invoice.customer.phone, reviewUrl)
    : null;
  const heading = invoice.number
    ?? (invoice.type === 'quotation' ? 'Draft quotation' : 'Draft invoice');

  return (
    <div>
      <style>{printStyles}</style>
      <PageHeader
        title={heading}
        description={`${invoice.customerName} · ${formatLkr(invoice.totalMinor, { decimals: true })}`}
        actions={(
          <Link href="/admin/invoices/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            All invoices
          </Link>
        )}
      />
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={invoice.status} />
        <SourceBadge source={invoice.source} />
        <Badge tone="neutral">{invoice.type === 'quotation' ? 'Quotation' : 'Invoice'}</Badge>
        <span className="text-sm text-mute">Number: {invoice.number ?? 'Draft'}</span>
        {invoice.booking ? (
          <Link
            href={`/admin/bookings/${invoice.booking.id}/`}
            className="text-sm text-maroon underline-offset-4 hover:underline"
          >
            Booking {invoice.booking.reference}
          </Link>
        ) : <span className="text-sm text-mute">No originating booking</span>}
        {invoice.convertedFromId ? (
          <Link
            href={`/admin/invoices/${invoice.convertedFromId}/`}
            className="text-sm text-maroon underline-offset-4 hover:underline"
          >
            Converted from quotation #{invoice.convertedFromId}
          </Link>
        ) : null}
      </div>

      <div className="mb-6">
        <InvoiceActions
          invoice={invoice}
          canCancel={session.role === 'owner'}
          shareUrl={shareUrl}
          convertedInvoice={convertedInvoice}
          today={today}
        />
      </div>

      {invoice.status === 'paid' && reviewUrl ? (
        <section className="no-print mb-6 rounded-[var(--radius-card)] border border-good/30 bg-good/5 p-4">
          <h2 className="font-display text-xl">Ask for a Google review</h2>
          <p className="mt-1 text-sm text-ink-2">
            This invoice is paid. Send the customer a one-tap WhatsApp message with your review link.
          </p>
          <div className="mt-3">
            {reviewLink ? (
              <a
                href={reviewLink}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: 'primary', size: 'sm' })}
              >
                Send review request
              </a>
            ) : (
              <p className="text-sm text-mute">Add a mobile number to the customer to send a review request.</p>
            )}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="payment-history-heading" className="no-print mb-6 space-y-3">
        <h2 id="payment-history-heading" className="font-display text-2xl">Payment history</h2>
        {invoice.payments.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Method</TH>
                <TH>Reference</TH>
                <TH>Note</TH>
                <TH className="text-right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {invoice.payments.map((payment) => (
                <TR key={payment.id}>
                  <TD>{formatInvoiceDate(payment.paidOn)}</TD>
                  <TD>{paymentMethodLabel(payment.method)}</TD>
                  <TD className="text-sm text-ink-2">{payment.reference ?? '—'}</TD>
                  <TD className="text-sm text-ink-2">{payment.note ?? '—'}</TD>
                  <TD className="text-right font-semibold tabular-nums text-good">
                    {formatLkr(payment.amountMinor, { decimals: true })}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : <p className="text-sm text-mute">No payments recorded yet.</p>}
      </section>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-bone/30 p-2 sm:p-4">
        <InvoicePrint invoice={invoice} settings={settings} />
      </div>
    </div>
  );
}
