import { z } from 'zod';
import { env } from '@/lib/env';
import type { TrackEventType } from './client';

// Everything the tracking endpoint derives from the request itself. Kept free of
// `server-only` so the pure parts can be unit-tested.

export const TRACK_EVENT_TYPES = [
  'page_view',
  'product_view',
  'colour_pick',
  'add_to_cart',
  'remove_from_cart',
  'chat_open',
  'chat_message',
  'booking_start',
  'booking_submit',
  'whatsapp_click',
] as const satisfies readonly TrackEventType[];

const MAX_VALUE_BYTES = 1024;
const MAX_BODY_CHARS = 4096;

// The whole object is capped by bytes rather than each field, so a single long
// note is fine as long as the payload stays under 1 KB.
const valueSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .refine((value) => new TextEncoder().encode(JSON.stringify(value)).length <= MAX_VALUE_BYTES, {
    message: 'value is larger than 1 KB',
  });

export const trackPayloadSchema = z.object({
  type: z.enum(TRACK_EVENT_TYPES),
  visitorId: z.string().min(8).max(64),
  sessionId: z.string().min(8).max(64),
  path: z.string().min(1).max(300),
  referrer: z.string().optional(),
  productId: z.number().int().positive().optional(),
  variantId: z.number().int().positive().optional(),
  value: valueSchema.optional(),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
    })
    .optional(),
});

export type TrackPayloadInput = z.infer<typeof trackPayloadSchema>;

export type ParseTrackResult = { ok: true; payload: TrackPayloadInput } | { ok: false; error: 'invalid' };

/** Parse a sendBeacon body (read as text because Beacon sends a JSON blob). */
export function parseTrackPayload(raw: string): ParseTrackResult {
  if (!raw || raw.length > MAX_BODY_CHARS) return { ok: false, error: 'invalid' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  const parsed = trackPayloadSchema.safeParse(json);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, error: 'invalid' };
}

export type SourceBucket = 'google' | 'facebook' | 'instagram' | 'whatsapp' | 'direct' | 'other';

export const SOURCE_BUCKETS = ['google', 'facebook', 'instagram', 'whatsapp', 'direct', 'other'] as const;

/** Hostname only: never keep the full referrer path or its query string. */
export function referrerHost(referrer?: string | null): string | null {
  const value = referrer?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '').slice(0, 200);
    return host || null;
  } catch {
    return null;
  }
}

/** Our own host, so moving between pages is not mistaken for an external referrer. */
const SELF_HOST = referrerHost(env.NEXT_PUBLIC_SITE_URL);

const SOURCE_HOSTS: ReadonlyArray<readonly [RegExp, SourceBucket]> = [
  [/(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/, 'google'],
  [/(^|\.)googleusercontent\.com$/, 'google'],
  [/(^|\.)googleadservices\.com$|(^|\.)googlesyndication\.com$|(^|\.)doubleclick\.net$/, 'google'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)facebook\.net$/, 'facebook'],
  [/(^|\.)fb\.me$|(^|\.)m\.me$|(^|\.)messenger\.com$/, 'facebook'],
  [/(^|\.)instagram\.com$|(^|\.)instagr\.am$/, 'instagram'],
  [/(^|\.)ig\.me$/, 'instagram'],
  [/(^|\.)whatsapp\.com$|(^|\.)whatsapp\.net$|(^|\.)wa\.me$|(^|\.)wa\.link$/, 'whatsapp'],
];

const SOURCE_UTM: ReadonlyArray<readonly [RegExp, SourceBucket]> = [
  [/google|adwords|addup|gads/, 'google'],
  [/facebook|^fb$|^meta$|messenger/, 'facebook'],
  [/instagram|^ig$/, 'instagram'],
  [/whatsapp|^wa$/, 'whatsapp'],
  [/^direct$|^none$/, 'direct'],
];

/** Referrer host (or UTM source) to one of the buckets the Visitors page groups by. */
export function sourceBucket(
  referrer?: string | null,
  utmSource?: string | null,
  selfHost: string | null = SELF_HOST,
): SourceBucket {
  const host = referrerHost(referrer);
  if (host) {
    if (selfHost && (host === selfHost || host.endsWith(`.${selfHost}`))) return 'direct';
    for (const [pattern, bucket] of SOURCE_HOSTS) if (pattern.test(host)) return bucket;
    return 'other';
  }
  const utm = utmSource?.trim().toLowerCase();
  if (utm) {
    for (const [pattern, bucket] of SOURCE_UTM) if (pattern.test(utm)) return bucket;
    return 'other';
  }
  return 'direct';
}

export type Geo = { country: string | null; region: string | null; city: string | null };

function headerValue(headers: Headers, name: string): string | null {
  const raw = headers.get(name);
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Vercel sends plain values locally; leave malformed escapes untouched.
  }
  const trimmed = value.trim().slice(0, 100);
  return trimmed || null;
}

/** Vercel geo headers, URL-decoded. All null locally. No IP is read or kept. */
export function geoFromHeaders(headers: Headers): Geo {
  const country = headerValue(headers, 'x-vercel-ip-country');
  return {
    country: country ? country.toUpperCase().slice(0, 2) : null,
    region: headerValue(headers, 'x-vercel-ip-country-region'),
    city: headerValue(headers, 'x-vercel-ip-city'),
  };
}

export type IngestContext = {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  userAgent?: string | null;
  now?: Date;
};

export function contextFromRequest(request: Request): IngestContext {
  return { ...geoFromHeaders(request.headers), userAgent: request.headers.get('user-agent'), now: new Date() };
}

/** `GET /api/cron/*` guard. A missing CRON_SECRET locks the jobs rather than opening them. */
export function isCronAuthorized(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
