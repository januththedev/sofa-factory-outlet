import Link from 'next/link';
import { CopyReportButton } from '@/components/admin/seo/copy-report-button';
import { EmptyNote } from '@/components/admin/seo/ui';
import { ScoreBadge } from '@/components/admin/seo/ui';
import { StatGrid } from '@/components/admin/seo/ui';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { getMonthlyReport } from '@/lib/admin/seo';
import { colomboToday } from '@/lib/bookings/rules';
import { formatCount } from '@/lib/seo/report';
import { formatPosition } from '@/lib/seo/report';
import type { MonthlyReport } from '@/lib/seo/report';
import { monthLabel } from '@/lib/seo/report';
import { monthOptions } from '@/lib/seo/report';
import type { RankingRow } from '@/lib/seo/report';
import { reportToText } from '@/lib/seo/report';

function changeText(row: RankingRow): string {
  if (row.change === null) return '—';
  if (row.change === 0) return 'No change';
  return row.change > 0 ? `Up ${row.change.toFixed(1)}` : `Down ${Math.abs(row.change).toFixed(1)}`;
}

export async function ReportTab({ month }: { month: string }) {
  const report = await getMonthlyReport(month);
  const options = monthOptions(colomboToday());
  if (!options.some((option) => option.value === report.month)) {
    options.push({ value: report.month, label: monthLabel(report.month) });
  }
  const csvHref = `/admin/seo/report/?month=${report.month}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form method="get" action="/admin/seo/" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="report" />
          <div>
            <label htmlFor="report-month" className="mb-1.5 block text-base sm:text-sm font-medium text-ink-2">
              Month
            </label>
            <Select id="report-month" name="month" defaultValue={report.month} className="min-w-52">
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonStyles({ variant: 'dark' })}>
            Show report
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <CopyReportButton text={reportToText(report)} />
          <Link href={csvHref} download prefetch={false} className={buttonStyles({ variant: 'ghost' })}>
            Download CSV
          </Link>
        </div>
      </div>
      <ReportBody report={report} />
      <details className="rounded-[var(--radius-card)] border border-line bg-paper p-4 text-base sm:text-sm">
        <summary className="min-h-11 cursor-pointer font-medium text-ink-2">Plain text version</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-ink-2">{reportToText(report)}</pre>
      </details>
    </div>
  );
}

function ReportBody({ report }: { report: MonthlyReport }) {
  const { totals, previousTotals, reviews, productsBelowGreen, contentDue } = report;
  return (
    <>
      {report.hasSearchData ? (
        <StatGrid
          stats={[
            {
              label: 'Clicks',
              value: formatCount(totals.clicks),
              hint: `Month before: ${formatCount(previousTotals.clicks)}`,
            },
            {
              label: 'Impressions',
              value: formatCount(totals.impressions),
              hint: `Month before: ${formatCount(previousTotals.impressions)}`,
            },
            {
              label: 'Average position',
              value: formatPosition(totals.position),
              hint: `Month before: ${formatPosition(previousTotals.position)}`,
            },
          ]}
        />
      ) : (
        <p role="status" className="rounded-xl bg-bone-2 px-4 py-3 text-base sm:text-sm text-ink-2">
          Search Console has no data for {report.label} yet, so the ranking figures below are empty.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Priority searches</CardTitle>
        </CardHeader>
        <Table>
          <caption className="sr-only">
            Position of each priority search in {report.label}, with the change on the month before
          </caption>
          <THead>
            <TR>
              <TH scope="col">Search</TH>
              <TH scope="col" className="text-right">
                Position
              </TH>
              <TH scope="col">Change</TH>
              <TH scope="col" className="text-right">
                Clicks
              </TH>
              <TH scope="col" className="text-right">
                Impressions
              </TH>
            </TR>
          </THead>
          <TBody>
            {report.rankings.map((row) => (
              <TR key={row.query}>
                <TD className="font-medium">{row.query}</TD>
                <TD className="text-right tabular-nums">{formatPosition(row.position)}</TD>
                <TD className="text-mute">{changeText(row)}</TD>
                <TD className="text-right tabular-nums">{formatCount(row.clicks)}</TD>
                <TD className="text-right tabular-nums">{formatCount(row.impressions)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New reviews</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-base sm:text-sm text-ink-2">
            <p>
              <strong className="font-semibold text-ink">{reviews.total}</strong> arrived in {report.label}:{' '}
              {reviews.approved} approved, {reviews.pending} waiting, {reviews.rejected} rejected.
            </p>
            <p>
              {reviews.averageRating === null
                ? 'No approved review yet, so there is no average.'
                : `Average of the approved ones: ${reviews.averageRating.toFixed(1)} out of 5.`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next content due</CardTitle>
          </CardHeader>
          {contentDue.length === 0 ? (
            <EmptyNote>The keyword map has nothing left to write.</EmptyNote>
          ) : (
            <ul className="divide-y divide-line">
              {contentDue.map((item) => (
                <li key={`${item.kind}:${item.title}`} className="px-6 py-4 text-base sm:text-sm">
                  <p className="font-medium">
                    {item.title}
                    {item.later ? <span className="font-normal text-mute"> (planned for later)</span> : null}
                  </p>
                  <p className="text-mute">
                    {item.kind === 'guide' ? 'A guide' : 'The page'} for {item.searches.join('; ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products below green</CardTitle>
        </CardHeader>
        {productsBelowGreen === null ? (
          <EmptyNote>— The SEO checklist could not be read.</EmptyNote>
        ) : productsBelowGreen.length === 0 ? (
          <EmptyNote>Every published product is green.</EmptyNote>
        ) : (
          <ul className="divide-y divide-line">
            {productsBelowGreen.map((product) => (
              <li key={product.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 text-base sm:text-sm">
                <ScoreBadge score={product.score} />
                <Link href={`/admin/products/${product.id}/`} className="font-medium text-maroon hover:underline">
                  {product.name}
                </Link>
                <span className="text-mute">{product.failing.join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
