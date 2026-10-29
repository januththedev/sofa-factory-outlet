import { CAMPAIGN_COOKIE, readCampaign } from './campaign';
const KEY = 'sfo-attribution-v1';
export function collectAttribution(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const cookie =
      typeof document === 'undefined'
        ? {}
        : readCampaign(
            document.cookie
              .split('; ')
              .find((part) => part.startsWith(`${CAMPAIGN_COOKIE}=`))
              ?.slice(CAMPAIGN_COOKIE.length + 1),
          );
    const cookieLast = Object.fromEntries(
      ['source', 'medium', 'campaign'].flatMap((key) =>
        cookie[key] ? [[key, cookie[key]]] : [],
      ),
    );
    const cookieFirst = Object.fromEntries(
      ['source', 'medium', 'campaign'].flatMap((key) =>
        cookie[`first_${key}`] ? [[key, cookie[`first_${key}`]]] : [],
      ),
    );
    const params = new URLSearchParams(window.location.search);
    const current: Record<string, string> = {};
    for (const key of ['source', 'medium', 'campaign']) {
      const value = params.get(`utm_${key}`)?.slice(0, 200);
      if (value) current[key] = value;
    }
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as {
      expires?: number;
      first?: Record<string, string>;
      last?: Record<string, string>;
      landing?: string;
    } | null;
    const previous =
      saved?.expires && saved.expires > Date.now() ? saved : null;
    const first =
      previous?.first ??
      (Object.keys(cookieFirst).length ? cookieFirst : current);
    const last = Object.keys(current).length
      ? current
      : Object.keys(cookieLast).length
        ? cookieLast
        : (previous?.last ?? {});
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        expires: previous?.expires ?? Date.now() + 30 * 86400000,
        first,
        last,
        landing:
          previous?.landing ??
          cookie.landing ??
          window.location.pathname.slice(0, 200),
      }),
    );
    return {
      ...last,
      ...Object.fromEntries(
        Object.entries(first).map(([k, v]) => [`first_${k}`, v]),
      ),
      landing:
        previous?.landing ??
        cookie.landing ??
        window.location.pathname.slice(0, 200),
    };
  } catch {
    return {};
  }
}
