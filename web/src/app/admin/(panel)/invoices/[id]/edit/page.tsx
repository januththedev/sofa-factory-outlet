import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { InvoiceBuilder } from '@/components/admin/invoices/invoice-builder';
import { buttonStyles } from '@/components/ui/button';
import { requireRole } from '@/lib/auth/session';
import { getInvoice } from '@/lib/invoices/api';
import { getSettings } from '@/lib/settings/get';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit invoice',
};

type Params = Promise<{ id: string }>;
const idSchema = z.coerce.number().int().positive();

export default async function EditInvoicePage({ params }: { params: Params }) {
  await requireRole();
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  const invoice = await getInvoice(parsed.data);
  if (!invoice) notFound();
  if (invoice.status !== 'draft') redirect(`/admin/invoices/${invoice.id}/`);
  const settings = await getSettings();
  const title = invoice.type === 'quotation' ? 'Edit quotation' : 'Edit invoice';
  const label = invoice.number ?? `#${invoice.id}`;

  return (
    <div>
      <PageHeader
        title={title}
        description={`Draft ${label} · ${invoice.customerName}. `
          + 'Changes are not saved until you choose an action.'}
        actions={(
          <>
            <Link href="/admin/invoices/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
              All invoices
            </Link>
            <Link href={`/admin/invoices/${invoice.id}/`} className={buttonStyles({ variant: 'subtle', size: 'md' })}>
              View draft
            </Link>
          </>
        )}
      />
      <InvoiceBuilder invoice={invoice} type={invoice.type} settings={settings.invoice} />
    </div>
  );
}
