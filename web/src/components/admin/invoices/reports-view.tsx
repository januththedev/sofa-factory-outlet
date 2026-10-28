import Link from 'next/link';
import { RevenueChart } from '@/components/admin/invoices/revenue-chart';
import type { RevenueChartPoint } from '@/components/admin/invoices/revenue-chart';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { formatInvoiceDate } from '@/lib/admin/invoices';
import { minorToRupees } from '@/lib/admin/invoices';
import { monthLabel } from '@/lib/admin/invoices';
import type { RevenueReport } from '@/lib/invoices/api';
import { formatLkr } from '@/lib/money';

function exportHref(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return `/admin/invoices/reports/export/${query ? `?${query}` : ''}`;
}

function chartPoints(report: RevenueReport): RevenueChartPoint[] {
  return report.months.map((month) => ({
    month: month.month,
    label: monthLabel(month.month),
    invoiced: minorToRupees(month.invoicedMinor),
    paid: minorToRupees(month.paidMinor),
    website: minorToRupees(month.websiteMinor),
    walkIn: minorToRupees(month.walkInMinor),
  }));
}

export function ReportsView({
  report,
  from,
  to,
}: {
  report: RevenueReport;
  from: string;
  to: string;
}) {
  return (
    <div className="space-y-8">
      <form method="get" action="/admin/invoices/" className="grid gap-4 border-b border-line pb-6 sm:grid-cols-12">
        <input type="hidden" name="tab" value="reports" />
        <Field label="From" htmlFor="report-from" className="sm:col-span-3">
          <Input id="report-from" name="from" type="date" defaultValue={from} />
        </Field>
        <Field label="To" htmlFor="report-to" className="sm:col-span-3">
          <Input id="report-to" name="to" type="date" defaultValue={to} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-6 sm:self-end">
          <Button type="submit" size="sm">Apply</Button>
          <Link href="/admin/invoices/?tab=reports"
            className="text-base sm:text-sm text-mute underline-offset-4 hover:underline">
            Clear dates
          </Link>
          <Link href={exportHref(from, to)}
            className="text-base sm:text-sm text-maroon underline-offset-4 hover:underline">
            Export CSV
          </Link>
        </div>
      </form>

      <section aria-labelledby="monthly-revenue-heading" className="space-y-4">
        <div>
          <h2 id="monthly-revenue-heading" className="font-display text-2xl">Monthly revenue</h2>
          <p
            className="mt-1 text-base sm:text-sm text-mute">
            Invoiced and paid totals, split by where the sale came from.
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6">
          <RevenueChart points={chartPoints(report)} />
        </div>
        {report.months.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Month</TH>
                <TH className="text-right">Invoiced</TH>
                <TH className="text-right">Paid</TH>
                <TH className="text-right">Website</TH>
                <TH className="text-right">Walk-in</TH>
              </TR>
            </THead>
            <TBody>
              {report.months.map((month) => (
                <TR key={month.month}>
                  <TD className="font-medium">{monthLabel(month.month)}</TD>
                  <TD className="text-right tabular-nums">{formatLkr(month.invoicedMinor, { decimals: true })}</TD>
                  <TD className="text-right tabular-nums text-good">
                    {formatLkr(month.paidMinor, { decimals: true })}
                  </TD>
                  <TD className="text-right tabular-nums">{formatLkr(month.websiteMinor, { decimals: true })}</TD>
                  <TD className="text-right tabular-nums">{formatLkr(month.walkInMinor, { decimals: true })}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : <p className="text-base sm:text-sm text-mute">No invoices have been issued in this period.</p>}
      </section>

      <section aria-labelledby="outstanding-heading" className="space-y-4">
        <div>
          <h2 id="outstanding-heading" className="font-display text-2xl">Outstanding balances</h2>
          <p className="mt-1 text-base sm:text-sm text-mute">Issued invoices that still have money owing.</p>
        </div>
        {report.outstanding.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH>Customer</TH>
                <TH>Issued</TH>
                <TH className="text-right">Balance</TH>
              </TR>
            </THead>
            <TBody>
              {report.outstanding.map((row) => (
                <TR key={row.invoiceId} className="bg-warn/5">
                  <TD>
                    <Link
                      href={`/admin/invoices/${row.invoiceId}/`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {row.number}
                    </Link>
                  </TD>
                  <TD>{row.customerName}</TD>
                  <TD className="text-base sm:text-sm text-ink-2">{formatInvoiceDate(row.issuedAt)}</TD>
                  <TD className="text-right font-semibold tabular-nums text-warn">
                    {formatLkr(row.balanceMinor, { decimals: true })}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : <p className="text-base sm:text-sm text-mute">Every issued invoice is paid up.</p>}
      </section>
    </div>
  );
}
