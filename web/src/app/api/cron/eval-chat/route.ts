import { runGoldenSet } from '@/lib/chat/eval';
import { env } from '@/lib/env';
import { bearerMatches } from '@/lib/security/bearer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  if (!bearerMatches(request, env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json(await runGoldenSet());
}
