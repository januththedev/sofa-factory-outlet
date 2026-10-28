import { requireRole } from '@/lib/auth/session';
import { minorForCsv, monthLabel, toCsv, type CsvColumn } from '@/lib/admin/invoices';
import { colomboToday } from '@/lib/bookings/rules';
import { revenueReport, type RevenueReport } from '@/lib/invoices/api';
import { parseDate } from '../../query';

export const dynamic = 'force-dynamic';

type MonthRow = RevenueReport['months'][number];

const columns: CsvColumn<MonthRow>[] = [
  { header: 'Month', value: (row) => monthLabel(row.month) },
  { header: 'Invoiced (LKR)', value: (row) => minorForCsv(row.invoicedMinor) },
  { header: 'Paid (LKR)', value: (row) => minorForCsv(row.paidMinor) },
  { header: 'Website (LKR)', value: (row) => minorForCsv(row.websiteMinor) },
  { header: 'Walk-in (LKR)', value: (row) => minorForCsv(row.walkInMinor) },
];

export async function GET(request: Request) {
  await requireRole();
  try {
    const params = new URL(request.url).searchParams;
    const report = await revenueReport({
      from: parseDate(params.get('from') ?? undefined),
      to: parseDate(params.get('to') ?? undefined),
    });
    const csv = toCsv(report.months, columns);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="revenue-report-${colomboToday()}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[invoices] report export failed:', error);
    return new Response('We could not export the report. Please try again.', { status: 500 });
  }
}
