// Pure helpers shared by the proxy gate, server code and client components.
// Keep this file free of database, next-auth and server-only imports: the proxy
// bundle imports it (through gate.ts), and so does the notification bell.

export const ADMIN_HOME = '/admin/';
export const LOGIN_PATH = '/admin/login/';

/** Where a staff account is sent when it opens an owner-only page; the shell shows the notice. */
export const NOTICE_PARAM = 'notice';
export const OWNER_ONLY_NOTICE = 'owner-only';
export const OWNER_ONLY_PATH = `${ADMIN_HOME}?${NOTICE_PARAM}=${OWNER_ONLY_NOTICE}`;

/** Request header the proxy sets so server code knows which admin page was asked for. */
export const PATH_HEADER = 'x-sfo-admin-path';
export const ROBOTS_VALUE = 'noindex, nofollow';

/** Auth.js session cookie names: plain over http, `__Secure-` over https. Large tokens are chunked as `<name>.0`, `<name>.1`. */
export const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

/** True when any session cookie carries a value. Says nothing about whether it is valid. */
export function hasSessionCookie(read: (name: string) => string | undefined): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(read(name)) || Boolean(read(`${name}.0`)));
}

/** Lower-cased, percent-decoded path with repeated slashes and backslashes folded, so `/%41dmin//x` is judged like `/admin/x`. */
export function normalisePath(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // A malformed escape: judge the raw text instead.
  }
  return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
}

export function isAdminPath(pathname: string): boolean {
  const path = normalisePath(pathname);
  return path === '/admin' || path.startsWith('/admin/');
}

export function isLoginPath(pathname: string): boolean {
  const path = normalisePath(pathname);
  return path === '/admin/login' || path === '/admin/login/';
}

const MAX_NEXT_LENGTH = 1000;

/**
 * Accepts only same-origin `/admin/...` paths (query allowed) and returns them
 * normalised, otherwise null. Rejects `//host`, `/\host`, absolute URLs,
 * `javascript:`, control characters, dot-segment escapes out of /admin, encoded
 * slashes and the login page itself (it would loop).
 */
export function safeAdminPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > MAX_NEXT_LENGTH) return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return null;

  const base = 'http://admin.invalid';
  let url: URL;
  try {
    url = new URL(candidate, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  if (/%2f|%5c/i.test(url.pathname)) return null;
  if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return null;
  if (isLoginPath(url.pathname)) return null;
  const pathname = url.pathname === '/admin' ? ADMIN_HOME : url.pathname;
  return `${pathname}${url.search}`;
}

/** A `next` value that is safe to redirect to: the validated path, or the admin home. */
export function sanitiseNext(value: unknown): string {
  return safeAdminPath(value) ?? ADMIN_HOME;
}

/** `/admin/login/` with the page to return to, when there is a safe one. */
export function loginUrl(next?: unknown): string {
  const target = safeAdminPath(next);
  return target ? `${LOGIN_PATH}?next=${encodeURIComponent(target)}` : LOGIN_PATH;
}
