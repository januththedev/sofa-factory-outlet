import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { InvoiceFilters, type InvoiceFilterValues } from '@/components/admin/invoices/invoice-filters';
import { InvoiceList } from '@/components/admin/invoices/invoice-list';
import { ReportsView } from '@/components/admin/invoices/reports-view';
import { buttonStyles } from '@/components/ui/button';
import { sumInvoiceRows } from '@/lib/admin/invoices';
import { requireRole } from '@/lib/auth/session';
import { listInvoices, revenueReport } from '@/lib/invoices/api';
import {
  collectInvoiceRows,
  firstParam,
  parseDate,
  parsePage,
  parseSearch,
  parseSource,
  parseStatus,
} from './query';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoices',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Tab = 'invoices' | 'quotations' | 'reports';

const pageSize = 25;

function activeTab(value: string | undefined): Tab {
  if (value === 'quotations' || value === 'reports') return value;
  return 'invoices';
}

function tabHref(tab: Tab, values: InvoiceFilterValues): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (values.q) params.set('q', values.q);
  if (values.status) params.set('status', values.status);
  if (values.source) params.set('source', values.source);
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  return `/admin/invoices/?${params.toString()}`;
}

function listExportHref(tab: 'invoices' | 'quotations', values: InvoiceFilterValues): string {
  const params = new URLSearchParams();
  params.set('type', tab === 'quotations' ? 'quotation' : 'invoice');
  if (values.q) params.set('q', values.q);
  if (values.status) params.set('status', values.status);
  if (values.source) params.set('source', values.source);
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  return `/admin/invoices/export/?${params.toString()}`;
}

function reportExportHref(values: InvoiceFilterValues): string {
  const params = new URLSearchParams();
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  const query = params.toString();
  return `/admin/invoices/reports/export/${query ? `?${query}` : ''}`;
}

function Tabs({ active, values }: { active: Tab; values: InvoiceFilterValues }) {
  const items: Array<{ key: Tab; label: string }> = [
    { key: 'invoices', label: 'Invoices' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'reports', label: 'Reports' },
  ];
  return (
    <nav aria-label="Invoice sections" className="mb-6 flex flex-wrap gap-x-6 border-b border-line">
      {items.map((item) => (
        <Link
          key={item.key}
          href={tabHref(item.key, values)}
          aria-current={active === item.key ? 'page' : undefined}
          className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${
            active === item.key
              ? 'border-maroon text-ink'
              : 'border-transparent text-mute hover:text-ink'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole();
  const params = await searchParams;
  const tab = activeTab(firstParam(params.tab));
  const values: InvoiceFilterValues = {
    q: parseSearch(firstParam(params.q)) ?? '',
    status: parseStatus(firstParam(params.status)) ?? '',
    source: parseSource(firstParam(params.source)) ?? '',
    from: parseDate(firstParam(params.from)) ?? '',
    to: parseDate(firstParam(params.to)) ?? '',
  };

  if (tab === 'reports') {
    const report = await revenueReport({
      from: values.from || undefined,
      to: values.to || undefined,
    });
    return (
      <div>
        <PageHeader
          title="Reports"
          description="Monthly revenue, website versus walk-in sales, and the balances still owed."
          actions={(
            <Link href={reportExportHref(values)} className={buttonStyles({ variant: 'ghost', size: 'md' })}>
              Export CSV
            </Link>
          )}
        />
        <Tabs active={tab} values={values} />
        <ReportsView report={report} from={values.from} to={values.to} />
      </div>
    );
  }

  const page = parsePage(firstParam(params.page));
  const filter = {
    type: tab === 'quotations' ? 'quotation' as const : 'invoice' as const,
    status: parseStatus(values.status),
    source: parseSource(values.source),
    q: values.q || undefined,
    from: values.from || undefined,
    to: values.to || undefined,
  };
  const [result, allRows] = await Promise.all([
    listInvoices({ ...filter, limit: pageSize, offset: (page - 1) * pageSize }),
    collectInvoiceRows(filter),
  ]);
  const totals = sumInvoiceRows(allRows);

  return (
    <div>
      <PageHeader
        title={tab === 'quotations' ? 'Quotations' : 'Invoices'}
        description={tab === 'quotations'
          ? 'Quotes for customers, ready to convert when they agree.'
          : 'Website and walk-in invoices, with payments, balances and printable copies.'}
        actions={(
          <>
            <Link
              href={listExportHref(tab, values)}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
            >
              Export CSV
            </Link>
            <Link href="/admin/invoices/new/" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              New invoice
            </Link>
            <Link
              href="/admin/invoices/new/?type=quotation"
              className={buttonStyles({ variant: 'subtle', size: 'md' })}
            >
              New quotation
            </Link>
          </>
        )}
      />
      <Tabs active={tab} values={values} />
      <div className="space-y-6">
        <InvoiceFilters tab={tab} values={values} />
        <InvoiceList
          rows={result.rows}
          totals={totals}
          tab={tab}
          values={values}
          page={page}
          pageSize={pageSize}
          total={result.total}
        />
      </div>
    </div>
  );
}
