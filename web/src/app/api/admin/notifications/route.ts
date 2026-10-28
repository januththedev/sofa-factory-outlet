import { NextResponse } from 'next/server';
import { type ApiResult, notificationsGet, notificationsPost } from '@/lib/auth/notifications';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// An API answers 401 JSON when the session has lapsed (requireRole() would redirect
// to the login page, which a polling fetch cannot use). Everything else about the
// request is decided in lib/auth/notifications.ts.
const reply = ({ status, body }: ApiResult) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  return reply(await notificationsGet(await getSession()));
}

export async function POST(request: Request) {
  const session = await getSession();
  return reply(
    await notificationsPost(session, {
      // Only read the body of a signed-in caller.
      bodyText: session ? await request.text() : '',
      origin: request.headers.get('origin'),
      host: request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    }),
  );
}
