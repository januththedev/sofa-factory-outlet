import { upsertSearchConsoleRows } from '@/lib/admin/seo';
import { isCronAuthorized } from '@/lib/analytics/server';
import { fetchRecentRows } from '@/lib/seo/gsc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Pulls the last three days of Search Console rows (query and page) into
// search_console_daily. Running it twice for the same days changes nothing.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const pulled = await fetchRecentRows();
    if (!pulled.configured) return Response.json({ ok: true, skipped: true });
    const saved = await upsertSearchConsoleRows(pulled.rows);
    return Response.json({
      ok: true,
      from: pulled.range.startDate,
      to: pulled.range.endDate,
      rows: saved,
      skippedRows: pulled.skipped,
    });
  } catch (error) {
    console.error('[cron/search-console] failed:', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
