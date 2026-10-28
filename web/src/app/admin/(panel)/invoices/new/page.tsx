import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { InvoiceBuilder } from '@/components/admin/invoices/invoice-builder';
import { buttonStyles } from '@/components/ui/button';
import { requireRole } from '@/lib/auth/session';
import { createInvoiceFromBooking } from '@/lib/invoices/api';
import { getSettings } from '@/lib/settings/get';
import { firstParam } from '../query';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New invoice',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const bookingSchema = z.coerce.number().int().positive();
const typeSchema = z.enum(['invoice', 'quotation']);

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole();
  const params = await searchParams;
  const bookingValue = firstParam(params.booking);
  const bookingId = bookingValue ? bookingSchema.safeParse(bookingValue) : null;
  const typeResult = typeSchema.safeParse(firstParam(params.type));
  const type = typeResult.success ? typeResult.data : 'invoice';
  let startError: string | null = null;
  let startedInvoiceId: number | null = null;

  if (bookingValue && !bookingId?.success) {
    startError = 'That booking could not be found.';
  }

  if (bookingId?.success) {
    try {
      const result = await createInvoiceFromBooking(bookingId.data);
      startedInvoiceId = result.invoiceId;
    } catch (error) {
      console.error('[invoices] could not start from booking:', error);
      startError = error instanceof Error && error.message === 'Booking not found'
        ? 'That booking could not be found.'
        : 'We could not start an invoice from that booking. Please try again.';
    }
  }

  if (startedInvoiceId !== null) redirect(`/admin/invoices/${startedInvoiceId}/edit/`);

  const settings = await getSettings();
  const title = type === 'quotation' ? 'New quotation' : 'New invoice';

  return (
    <div>
      <PageHeader
        title={title}
        description="Start with the customer, add catalogue lines or extras, then save a draft or issue it."
        actions={(
          <Link href="/admin/invoices/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            All invoices
          </Link>
        )}
      />
      {startError ? (
        <p role="alert" className="mb-6 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
          {startError}
        </p>
      ) : null}
      <InvoiceBuilder invoice={null} type={type} settings={settings.invoice} />
    </div>
  );
}
