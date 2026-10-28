import Link from 'next/link';
import { StatusBadge } from '@/components/admin/invoices/status-badge';
import { SourceBadge } from '@/components/admin/invoices/source-badge';
import { Badge } from '@/components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  formatInvoiceDate,
  isInvoiceOverdue,
  type InvoiceRowTotals,
} from '@/lib/admin/invoices';
import type { InvoiceRow } from '@/lib/invoices/api';
import { formatLkr } from '@/lib/money';

type FilterValues = {
  q: string;
  status: string;
  source: string;
  from: string;
  to: string;
};

const blank = '—';

function pageHref(tab: 'invoices' | 'quotations', values: FilterValues, page: number): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (values.q) params.set('q', values.q);
  if (values.status) params.set('status', values.status);
  if (values.source) params.set('source', values.source);
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  if (page > 1) params.set('page', String(page));
  return `/admin/invoices/?${params.toString()}`;
}

function balanceClass(row: InvoiceRow): string {
  if (row.status === 'paid' || row.status === 'cancelled') return 'text-mute';
  return row.balanceMinor > 0 ? 'font-semibold text-warn' : 'text-ink-2';
}

function InvoiceTotals({ totals }: { totals: InvoiceRowTotals }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-line bg-paper px-4 py-3">
        <dt className="text-xs uppercase tracking-wider text-mute">Invoices</dt>
        <dd className="mt-1 text-xl font-semibold">{totals.count}</dd>
      </div>
      <div className="rounded-xl border border-line bg-paper px-4 py-3">
        <dt className="text-xs uppercase tracking-wider text-mute">Total</dt>
        <dd className="mt-1 text-xl font-semibold">{formatLkr(totals.totalMinor, { decimals: true })}</dd>
      </div>
      <div className="rounded-xl border border-line bg-paper px-4 py-3">
        <dt className="text-xs uppercase tracking-wider text-mute">Paid</dt>
        <dd className="mt-1 text-xl font-semibold text-good">{formatLkr(totals.paidMinor, { decimals: true })}</dd>
      </div>
      <div className="rounded-xl border border-line bg-paper px-4 py-3">
        <dt className="text-xs uppercase tracking-wider text-mute">Outstanding</dt>
        <dd className="mt-1 text-xl font-semibold text-warn">
          {formatLkr(totals.balanceMinor, { decimals: true })}
        </dd>
        <p className="text-xs text-mute">{totals.outstanding} with a balance</p>
      </div>
    </dl>
  );
}

function EmptyState({ tab }: { tab: 'invoices' | 'quotations' }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-10 text-center">
      <p className="font-display text-2xl">Nothing here yet</p>
      <p className="mt-2 text-sm text-mute">
        {tab === 'quotations'
          ? 'Create a quotation from the catalogue and convert it when the customer agrees.'
          : 'Create an invoice from a booking or for a walk-in customer.'}
      </p>
    </div>
  );
}

export function InvoiceList({
  rows,
  totals,
  tab,
  values,
  page,
  pageSize,
  total,
}: {
  rows: readonly InvoiceRow[];
  totals: InvoiceRowTotals;
  tab: 'invoices' | 'quotations';
  values: FilterValues;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="space-y-5">
      <InvoiceTotals totals={totals} />
      {rows.length === 0 ? <EmptyState tab={tab} /> : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Number</TH>
                  <TH>Customer</TH>
                  <TH>Source</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Paid</TH>
                  <TH className="text-right">Balance</TH>
                  <TH>Issued</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => {
                  const overdue = isInvoiceOverdue(row);
                  return (
                    <TR key={row.id} className={overdue ? 'bg-warn/5' : undefined}>
                      <TD>
                        <Link
                          href={`/admin/invoices/${row.id}/`}
                          className="font-semibold underline-offset-4 hover:underline"
                        >
                          {row.number ?? 'Draft'}
                        </Link>
                      </TD>
                      <TD>
                        <span className="font-medium">{row.customerName}</span>
                        <span className="block text-xs text-mute">{row.customerPhone}</span>
                      </TD>
                      <TD><SourceBadge source={row.source} /></TD>
                      <TD><StatusBadge status={row.status} /></TD>
                      <TD className="text-right tabular-nums">{formatLkr(row.totalMinor, { decimals: true })}</TD>
                      <TD className="text-right tabular-nums text-good">
                        {formatLkr(row.paidMinor, { decimals: true })}
                      </TD>
                      <TD className={`text-right tabular-nums ${balanceClass(row)}`}>
                        <span className="block">{formatLkr(row.balanceMinor, { decimals: true })}</span>
                        {overdue ? <Badge tone="bad" className="mt-1">Overdue</Badge> : null}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-ink-2">
                        {row.issuedAt ? formatInvoiceDate(row.issuedAt) : blank}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => {
              const overdue = isInvoiceOverdue(row);
              return (
                <li key={row.id} className={`rounded-xl border border-line bg-paper p-4 ${overdue ? 'bg-warn/5' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/invoices/${row.id}/`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {row.number ?? 'Draft'}
                    </Link>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-2 text-sm font-medium">{row.customerName}</p>
                  <p className="text-xs text-mute">{row.customerPhone}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SourceBadge source={row.source} />
                    {overdue ? <Badge tone="bad">Overdue</Badge> : null}
                    <span className="text-xs text-mute">
                      {row.issuedAt ? formatInvoiceDate(row.issuedAt) : 'Not issued'}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                    <div>
                      <dt className="text-xs text-mute">Total</dt>
                      <dd className="tabular-nums">{formatLkr(row.totalMinor, { decimals: true })}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-mute">Paid</dt>
                      <dd className="tabular-nums text-good">{formatLkr(row.paidMinor, { decimals: true })}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-mute">Balance</dt>
                      <dd className={`tabular-nums ${balanceClass(row)}`}>
                        {formatLkr(row.balanceMinor, { decimals: true })}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {total > 0 ? (
        <nav aria-label="Invoice pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-mute">Showing {from}–{to} of {total}</p>
          <div className="flex items-center gap-3">
            {page > 1 ? (
              <Link
                href={pageHref(tab, values, page - 1)}
                className="rounded-full border border-line px-4 py-2 hover:bg-bone"
              >
                Previous
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-full border border-line px-4 py-2 text-mute/50"
              >
                Previous
              </span>
            )}
            <span aria-current="page">Page {page} of {pages}</span>
            {page < pages ? (
              <Link
                href={pageHref(tab, values, page + 1)}
                className="rounded-full border border-line px-4 py-2 hover:bg-bone"
              >
                Next
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-full border border-line px-4 py-2 text-mute/50"
              >
                Next
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
