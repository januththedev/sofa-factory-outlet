import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CustomerForm, EMPTY_CUSTOMER } from '@/components/admin/customers/customer-form';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createCustomerAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  await requireRole();
  return (
    <div>
      <PageHeader
        title="New customer"
        description="For a walk-in or a phone enquiry. Bookings and invoices add customers by themselves."
        actions={
          <Link href="/admin/customers/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            <ArrowLeft className="size-4" aria-hidden />
            All customers
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <CardBody>
          <CustomerForm action={createCustomerAction} initial={EMPTY_CUSTOMER} submitLabel="Add customer" />
        </CardBody>
      </Card>
    </div>
  );
}
