import { getMonthlyReport } from '@/lib/admin/seo';
import { requireRole } from '@/lib/auth/session';
import { reportToCsv } from '@/lib/seo/report';

export const dynamic = 'force-dynamic';

/** The monthly report's rankings as a CSV file: `/admin/seo/report/?month=2026-09`. */
export async function GET(request: Request) {
  await requireRole();
  try {
    const month = new URL(request.url).searchParams.get('month') ?? '';
    const report = await getMonthlyReport(month);
    return new Response(reportToCsv(report), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="seo-report-${report.month}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[admin/seo] report export failed:', error);
    return new Response('The report could not be created.', { status: 500 });
  }
}
