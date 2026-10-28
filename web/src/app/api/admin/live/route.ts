import { getLiveVisitors } from '@/lib/analytics/queries';
import { requireRole } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await requireRole('any');
  const count = await getLiveVisitors();
  return Response.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
}
