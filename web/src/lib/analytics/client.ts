// Browser-side visitor tracking (Plan.md "Visitor analytics"): a random visitor id
// in localStorage and a session id in sessionStorage, neither holding personal
// data, sent with navigator.sendBeacon to /api/track/ (the server adds geo,
// device and referrer, and filters bots). Safe to call anywhere on the client;
// it never throws and does nothing on the server.

export type TrackEventType =
  | 'page_view'
  | 'product_view'
  | 'colour_pick'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'chat_open'
  | 'chat_message'
  | 'booking_start'
  | 'booking_submit'
  | 'whatsapp_click';

export type TrackData = { productId?: number; variantId?: number; value?: Record<string, string | number | boolean | null> };

export type TrackPayload = TrackData & {
  type: TrackEventType;
  visitorId: string;
  sessionId: string;
  path: string;
  referrer?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
};

function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function stored(storage: Storage, key: string): string {
  try {
    let value = storage.getItem(key);
    if (!value) {
      value = randomId();
      storage.setItem(key, value);
    }
    return value;
  } catch {
    return randomId();
  }
}

/** Staff pages and API routes are not visitors: they are never tracked. */
export function isTrackedPath(path: string): boolean {
  return !/^\/(admin|api)(\/|$)/.test(path);
}

export function getVisitorIds(): { visitorId: string; sessionId: string } {
  return { visitorId: stored(window.localStorage, 'sfo-vid'), sessionId: stored(window.sessionStorage, 'sfo-sid') };
}

export function trackEvent(type: TrackEventType, data: TrackData = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const payload: TrackPayload = {
      type,
      ...data,
      ...getVisitorIds(),
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      utm: { source: params.get('utm_source') ?? undefined, medium: params.get('utm_medium') ?? undefined, campaign: params.get('utm_campaign') ?? undefined },
    };
    const body = JSON.stringify(payload);
    if (!navigator.sendBeacon?.('/api/track/', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/track/', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch {
    // tracking must never break the page
  }
}
