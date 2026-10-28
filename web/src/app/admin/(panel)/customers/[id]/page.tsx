import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BookingLinks } from '@/components/admin/bookings/history';
import { InvoiceLinks } from '@/components/admin/bookings/history';
import { CustomerForm } from '@/components/admin/customers/customer-form';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { formatColomboDateTime } from '@/lib/admin/bookings';
import { parseRecordId } from '@/lib/admin/bookings';
import { getCustomerDetail } from '@/lib/admin/customers';
import { requireRole } from '@/lib/auth/session';
import { updateCustomerAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole();
  const customerId = parseRecordId((await params).id);
  if (customerId === null) notFound();
  const detail = await getCustomerDetail(customerId);
  if (!detail) notFound();
  const { customer, bookings, invoices } = detail;

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={`${customer.phoneLabel} · customer since ${formatColomboDateTime(customer.createdAt)}`}
        actions={
          <Link href="/admin/customers/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            <ArrowLeft className="size-4" aria-hidden />
            All customers
          </Link>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="min-w-0">
          <CardHeader className="flex-wrap">
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardBody>
            <CustomerForm
              action={updateCustomerAction.bind(null, customerId)}
              submitLabel="Save customer"
              initial={{
                name: customer.name,
                phone: customer.phoneLabel,
                whatsapp: customer.whatsapp ?? '',
                email: customer.email ?? '',
                city: customer.city ?? '',
                address: customer.address ?? '',
                notes: customer.notes ?? '',
              }}
            />
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0">
            <CardHeader className="flex-wrap">
              <CardTitle>Bookings</CardTitle>
              <span className="text-base sm:text-sm text-mute">{bookings.length}</span>
            </CardHeader>
            <CardBody>
              <BookingLinks bookings={bookings} empty="No bookings yet." />
            </CardBody>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex-wrap">
              <CardTitle>Invoices</CardTitle>
              <span className="text-base sm:text-sm text-mute">{invoices.length}</span>
            </CardHeader>
            <CardBody>
              <InvoiceLinks invoices={invoices} empty="No invoices yet." />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
