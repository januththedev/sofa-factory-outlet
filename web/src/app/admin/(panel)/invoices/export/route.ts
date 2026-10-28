import { requireRole } from '@/lib/auth/session';
import {
  minorForCsv,
  sourceLabel,
  statusBadge,
  toCsv,
  type CsvColumn,
} from '@/lib/admin/invoices';
import { colomboToday } from '@/lib/bookings/rules';
import type { InvoiceRow } from '@/lib/invoices/api';
import {
  collectInvoiceRows,
  parseDate,
  parseSearch,
  parseSource,
  parseStatus,
  parseType,
} from '../query';

export const dynamic = 'force-dynamic';

const columns: CsvColumn<InvoiceRow>[] = [
  { header: 'Number', value: (row) => row.number ?? 'Draft' },
  { header: 'Customer', value: (row) => row.customerName },
  { header: 'Phone', value: (row) => row.customerPhone },
  { header: 'Source', value: (row) => sourceLabel(row.source) },
  { header: 'Status', value: (row) => statusBadge(row.status).label },
  { header: 'Total (LKR)', value: (row) => minorForCsv(row.totalMinor) },
  { header: 'Paid (LKR)', value: (row) => minorForCsv(row.paidMinor) },
  { header: 'Balance (LKR)', value: (row) => minorForCsv(row.balanceMinor) },
  { header: 'Issued', value: (row) => (row.issuedAt ? row.issuedAt.slice(0, 10) : '') },
];

export async function GET(request: Request) {
  await requireRole();
  try {
    const params = new URL(request.url).searchParams;
    const type = parseType(params.get('type') ?? undefined) ?? 'invoice';
    const rows = await collectInvoiceRows({
      type,
      status: parseStatus(params.get('status') ?? undefined),
      source: parseSource(params.get('source') ?? undefined),
      q: parseSearch(params.get('q') ?? undefined),
      from: parseDate(params.get('from') ?? undefined),
      to: parseDate(params.get('to') ?? undefined),
    });
    const csv = toCsv(rows, columns);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}s-${colomboToday()}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[invoices] list export failed:', error);
    return new Response('We could not export the invoice list. Please try again.', { status: 500 });
  }
}
