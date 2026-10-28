import { runRollup } from '@/lib/analytics/rollup';
import { isCronAuthorized } from '@/lib/analytics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await runRollup();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/rollup] failed:', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
