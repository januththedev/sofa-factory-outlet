import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Pagination } from '@/components/admin/bookings/pagination';
import { CustomerList } from '@/components/admin/customers/customer-list';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { buttonStyles } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Label } from '@/components/ui/field';
import { listCustomers } from '@/lib/admin/customers';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Customers' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? '').trim();
}

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole();
  const params = await searchParams;
  const q = first(params.q).slice(0, 100);
  const requestedPage = Number(first(params.page));
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? Math.min(requestedPage, 10_000) : 1;
  const result = await listCustomers({ q, page });
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (target > 1) query.set('page', String(target));
    const text = query.toString();
    return `/admin/customers/${text ? `?${text}` : ''}`;
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has booked a visit or been invoiced, matched by phone number."
        actions={
          <Link href="/admin/customers/new/" className={buttonStyles({ variant: 'primary', size: 'md' })}>
            <UserPlus className="size-4" aria-hidden />
            New customer
          </Link>
        }
      />

      <form
        key={q}
        method="get"
        action="/admin/customers/"
        role="search"
        aria-label="Search customers"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4"
      >
        <div className="min-w-0 flex-1 basis-64">
          <Label htmlFor="customer-search">Search</Label>
          <Input
            id="customer-search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            name="q"
            defaultValue={q}
            placeholder="Name, phone, city or email"
            maxLength={100}
          />
        </div>
        <Button type="submit" size="md">
          Search
        </Button>
        {q ? (
          <Link href="/admin/customers/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            Clear
          </Link>
        ) : null}
      </form>

      <CustomerList rows={result.rows} searching={q !== ''} />
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={result.total === 1 ? 'customer' : 'customers'}
        hrefFor={pageHref}
      />
    </div>
  );
}
