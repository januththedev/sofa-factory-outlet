import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const rows = await db.select({ from: s.redirects.fromPath, to: s.redirects.toPath, status: s.redirects.status }).from(s.redirects);
  return Response.json({ redirects: rows });
}
