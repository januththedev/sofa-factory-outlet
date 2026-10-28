import { runGoldenSet } from '@/lib/chat/eval';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  const authorised = env.CRON_SECRET
    && request.headers.get('authorization') === `Bearer ${env.CRON_SECRET}`;
  if (!authorised) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json(await runGoldenSet());
}
