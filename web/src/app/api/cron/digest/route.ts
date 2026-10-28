import { runDigest } from '@/lib/analytics/digest';
import { isCronAuthorized } from '@/lib/analytics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response('Unauthorized', { status: 401 });
  const result = await runDigest();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
