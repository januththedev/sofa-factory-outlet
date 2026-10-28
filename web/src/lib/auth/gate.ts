import { type NextRequest, NextResponse } from 'next/server';
import { hasSessionCookie, isAdminPath, isLoginPath, LOGIN_PATH, PATH_HEADER, ROBOTS_VALUE, safeAdminPath } from './paths';

// Called by src/proxy.ts for every request. Must not import the database (the
// proxy runs in its own bundle), so this only looks at the URL and the cookie.
//
// It is a cheap first check for the browser, not the security boundary: anyone
// can send a cookie with the right name. Every admin page, action and route
// handler still calls requireRole(), which verifies the session for real.

/**
 * - Not under /admin, or the login page: returns undefined and does nothing.
 * - Under /admin without a session cookie: redirects to /admin/login/?next=<page>.
 * - Under /admin with one: continues, adding `X-Robots-Tag: noindex, nofollow` and
 *   telling server code which page was asked for (see requireRole).
 */
export const adminGate = (request: NextRequest): NextResponse | undefined => {
  const { pathname, searchParams } = request.nextUrl;
  if (!isAdminPath(pathname) || isLoginPath(pathname)) return undefined;

  // `_rsc` is Next's own cache-busting parameter on in-app navigations: not part of the page the person asked for.
  const query = new URLSearchParams(searchParams);
  query.delete('_rsc');
  const requested = safeAdminPath(query.size > 0 ? `${pathname}?${query}` : pathname);
  // A server action is a POST to the page's own URL. Let it through even with no
  // cookie: its requireRole() redirect is the one Next's client knows how to follow.
  const isServerAction = request.headers.has('next-action');

  if (!isServerAction && !hasSessionCookie((name) => request.cookies.get(name)?.value)) {
    // A plain URL, not nextUrl.clone(): NextURL drops the trailing slash when the
    // original path (say "/admin") had none.
    const target = new URL(LOGIN_PATH, request.nextUrl.origin);
    if (requested) target.searchParams.set('next', requested);
    // 303 turns a POST into a GET of the login page; 307 keeps GET and HEAD as they are.
    const redirect = NextResponse.redirect(target, request.method === 'GET' || request.method === 'HEAD' ? 307 : 303);
    redirect.headers.set('X-Robots-Tag', ROBOTS_VALUE);
    return redirect;
  }

  const forwarded = new Headers(request.headers);
  // Always overwrite: a client must not be able to choose this value.
  if (requested) forwarded.set(PATH_HEADER, requested);
  else forwarded.delete(PATH_HEADER);
  const response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set('X-Robots-Tag', ROBOTS_VALUE);
  return response;
};
