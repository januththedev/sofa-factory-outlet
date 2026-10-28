'use client';

import { Modal } from '@/components/admin/knowledge/modal';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cancelInvoiceAction } from '@/app/admin/(panel)/invoices/actions';
import { convertQuotationAction } from '@/app/admin/(panel)/invoices/actions';
import { PaymentDialog } from '@/components/admin/invoices/payment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonStyles } from '@/components/ui/button';
import { invoiceWhatsappLink } from '@/lib/admin/invoices';
import type { InvoiceView } from '@/lib/invoices/api';

export function InvoiceActions({
  invoice,
  canCancel,
  shareUrl,
  convertedInvoice,
  today,
}: {
  invoice: InvoiceView;
  canCancel: boolean;
  shareUrl: string | null;
  convertedInvoice: { id: number; number: string | null } | null;
  today: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [converting, setConverting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const customerNumber = invoice.customer.whatsapp || invoice.customer.phone;
  const whatsapp = shareUrl
    ? invoiceWhatsappLink(customerNumber, {
      customerName: invoice.customer.name,
      kind: invoice.type,
      reference: invoice.number ?? 'Draft',
      totalMinor: invoice.totalMinor,
      pdfUrl: shareUrl,
    })
    : null;
  const shareable = shareUrl !== null && invoice.status !== 'draft' && invoice.status !== 'cancelled';

  async function cancelInvoice() {
    setCancelling(true);
    setError(null);
    try {
      const response = await cancelInvoiceAction(invoice.id);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch (error) {
      console.error('[invoices] could not cancel invoice:', error);
      setError('We could not cancel this invoice. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  async function convertQuotation() {
    setConverting(true);
    setError(null);
    try {
      const response = await convertQuotationAction(invoice.id);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      router.push(`/admin/invoices/${response.invoiceId}/edit/`);
    } catch (error) {
      console.error('[invoices] could not convert quotation:', error);
      setError('We could not convert this quotation. Please try again.');
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="no-print space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => window.print()}>Print</Button>
        {invoice.status !== 'draft' ? (
          <Link
            href={`/api/invoices/${invoice.id}/pdf/`}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            Download PDF
          </Link>
        ) : (
          <Link
            href={`/admin/invoices/${invoice.id}/edit/`}
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
          >
            Edit draft
          </Link>
        )}
        {shareable && shareUrl ? (
          <Button size="sm" variant="ghost" onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setNotice('Share link copied.');
            } catch {
              setNotice('The link could not be copied. Touch and hold the share link below to copy it.');
            }
          }}>Copy share link</Button>
        ) : null}
        {shareable && whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            Share on WhatsApp
          </a>
        ) : null}
        {shareable && !whatsapp ? (
          <span className={`${buttonStyles({ variant: 'ghost', size: 'sm' })} opacity-50`} aria-disabled="true">
            Share on WhatsApp
          </span>
        ) : null}
        {invoice.type === 'invoice' && (invoice.status === 'issued' || invoice.status === 'partially_paid') ? (
          <PaymentDialog invoiceId={invoice.id} balanceMinor={invoice.balanceMinor} today={today} />
        ) : null}
        {invoice.type === 'quotation' && invoice.status === 'issued' && !convertedInvoice ? (
          <Button variant="primary" size="sm" onClick={convertQuotation} disabled={converting}>
            {converting ? 'Converting…' : 'Convert to invoice'}
          </Button>
        ) : null}
        {canCancel && invoice.status !== 'cancelled' ? (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Cancel invoice</Button>
        ) : null}
        {convertedInvoice ? (
          <Badge tone="good">
            Converted to{' '}
            <Link href={`/admin/invoices/${convertedInvoice.id}/`} className="underline underline-offset-2">
              {convertedInvoice.number ?? `invoice #${convertedInvoice.id}`}
            </Link>
          </Badge>
        ) : null}
      </div>
      <p role="status" aria-live="polite">{notice}</p>
      {shareable && shareUrl ? <a href={shareUrl}
        className="inline-flex min-h-11 min-w-11 items-center break-all text-maroon underline">Share link</a> : null}
      {error ? <p role="status" aria-live="polite" className="text-base sm:text-sm text-bad">{error}</p> : null}
      {shareable && !whatsapp ? (
        <p className="text-xs text-mute">Add a WhatsApp or phone number to the customer to share this invoice.</p>
      ) : null}

      <Modal open={confirming} onClose={() => {
        if (!cancelling) setConfirming(false);
      }} title="Cancel this invoice?">
            <p className="mt-2 text-base sm:text-sm text-ink-2">
              The invoice is kept with its number and marked cancelled. This cannot be undone.
            </p>
      {error ? <p role="status" aria-live="polite" className="mt-3 text-base sm:text-sm text-bad">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="danger" onClick={cancelInvoice} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Yes, cancel invoice'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={cancelling}>
                Keep invoice
              </Button>
            </div>
      </Modal>
    </div>
  );
}
