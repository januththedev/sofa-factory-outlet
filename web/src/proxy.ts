import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminGate } from '@/lib/auth/gate';
import { env, siteUrl } from '@/lib/env';
import { RedirectCache, type RedirectEntry } from '@/lib/seo/redirects';

async function loadRedirects(): Promise<RedirectEntry[]> {
  const response = await fetch(new URL('/api/internal/redirects/', `${siteUrl()}/`), {
    headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`Redirect service returned ${response.status}`);
  const data = await response.json() as { redirects?: RedirectEntry[] };
  return data.redirects ?? [];
}

const redirects = new RedirectCache(loadRedirects);

export async function composeProxy(request: NextRequest, redirectMap: RedirectCache): Promise<NextResponse> {
  const gated = adminGate(request);
  if (gated) return gated;
  // Redirects describe public pages. APIs authenticate in their own handlers.
  const path = request.nextUrl.pathname;
  if (path === '/api' || path.startsWith('/api/') || path === '/admin' || path.startsWith('/admin/')) return NextResponse.next();
  if (request.nextUrl.pathname === '/' && ['265', '267'].includes(request.nextUrl.searchParams.get('p') ?? '')) {
    return NextResponse.redirect(new URL('/', request.url), 301);
  }
  try {
    const match = await redirectMap.get(request.nextUrl.pathname);
    if (match?.status === 301 && match.to) {
      return NextResponse.redirect(new URL(match.to, request.url), 301);
    }
    if (match?.status === 410) {
      const body = '<!doctype html><html><head><title>Page removed</title></head>'
        + '<body><h1>This page has been removed</h1></body></html>';
      return new NextResponse(body, {
        status: 410,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
  } catch {
    // Redirect lookup must fail open.
  }
  return NextResponse.next();
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  return composeProxy(request, redirects);
}

export const config = {
  matcher: ['/((?!_next/|blob/|api(?:/|$)|.*\\.[^/]+$).*)'],
};
