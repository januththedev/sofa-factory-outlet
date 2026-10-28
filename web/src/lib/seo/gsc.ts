import 'server-only';

import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { env } from '@/lib/env';
import { addDays, isIsoDate } from './report';

// Google Search Console client. It signs a service-account JWT with `jose`,
// swaps it for an access token, then asks the Search Analytics API for the
// latest rows. Credentials come from GSC_SERVICE_ACCOUNT_JSON (the key file,
// base64 encoded) and GSC_SITE_URL. With either missing nothing is called and
// every function reports `{ configured: false }`.
//
// Network and signing are injectable (GscDeps), so tests never reach Google.

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const GSC_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GSC_API_ROOT = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
export const GSC_ROW_LIMIT = 5000;
export const GSC_PULL_DAYS = 3;

const JWT_LIFETIME_SECONDS = 3600;

export class GscError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GscError';
  }
}

// ---------------------------------------------------------------------------
// Configuration

export type GscSource = { GSC_SERVICE_ACCOUNT_JSON?: string; GSC_SITE_URL?: string };
export type GscConfig = { clientEmail: string; privateKey: string; siteUrl: string };
export type NotConfigured = { configured: false; problem?: string };
export type GscSettings = { configured: true; config: GscConfig } | NotConfigured;

const serviceAccountSchema = z.object({
  client_email: z.string().min(3),
  private_key: z.string().min(20),
});

function decodeServiceAccount(value: string): unknown {
  const text = value.trim().startsWith('{') ? value : Buffer.from(value.trim(), 'base64').toString('utf8');
  return JSON.parse(text);
}

/** Reads the credentials. Missing values are "not configured"; unreadable ones say what is wrong. */
export function resolveGscConfig(source: GscSource = env): GscSettings {
  const raw = source.GSC_SERVICE_ACCOUNT_JSON?.trim();
  const siteUrl = source.GSC_SITE_URL?.trim();
  if (!raw && !siteUrl) return { configured: false };
  if (!raw) return { configured: false, problem: 'GSC_SERVICE_ACCOUNT_JSON is not set.' };
  if (!siteUrl) return { configured: false, problem: 'GSC_SITE_URL is not set.' };
  let parsed: z.infer<typeof serviceAccountSchema>;
  try {
    parsed = serviceAccountSchema.parse(decodeServiceAccount(raw));
  } catch {
    return {
      configured: false,
      problem: 'GSC_SERVICE_ACCOUNT_JSON must be the service account key file, base64 encoded.',
    };
  }
  // A key pasted through a shell or dashboard can arrive with the line breaks written as "\n".
  const privateKey = parsed.private_key.replace(/\\n/g, '\n');
  return { configured: true, config: { clientEmail: parsed.client_email, privateKey, siteUrl } };
}

export type GscStatus = { configured: true; siteUrl: string; clientEmail: string } | NotConfigured;

/** What the admin page may show: never the private key. */
export function getGscStatus(source: GscSource = env): GscStatus {
  const settings = resolveGscConfig(source);
  if (!settings.configured) return settings;
  return { configured: true, siteUrl: settings.config.siteUrl, clientEmail: settings.config.clientEmail };
}

// ---------------------------------------------------------------------------
// Signing in

export type JwtClaims = { iss: string; scope: string; aud: string; iat: number; exp: number };
export type JwtSigner = (claims: JwtClaims, privateKey: string) => Promise<string>;
export type GscDeps = {
  fetch?: typeof fetch;
  sign?: JwtSigner;
  /** Milliseconds since the epoch. */
  now?: () => number;
};

/** The claims Google expects in a service-account assertion. */
export function buildJwtClaims(clientEmail: string, nowSeconds: number): JwtClaims {
  return {
    iss: clientEmail,
    scope: GSC_SCOPE,
    aud: GSC_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + JWT_LIFETIME_SECONDS,
  };
}

/** Signs the claims with the service account's RSA key. */
export const signAssertion: JwtSigner = async (claims, privateKey) => {
  const key = await importPKCS8(privateKey, 'RS256');
  return new SignJWT({ scope: claims.scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .sign(key);
};

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });
const googleErrorSchema = z.object({
  error: z.union([z.string(), z.object({ message: z.string().optional() })]).optional(),
  error_description: z.string().optional(),
});

/** Google's own explanation of a failed call, kept short and free of credentials. */
async function explain(response: Response): Promise<string> {
  try {
    const parsed = googleErrorSchema.safeParse(await response.json());
    if (!parsed.success) return '';
    const { error, error_description: description } = parsed.data;
    const detail = typeof error === 'string' ? error : error?.message;
    return [detail, description].filter(Boolean).join(': ').slice(0, 300);
  } catch {
    return '';
  }
}

export async function requestAccessToken(config: GscConfig, deps: GscDeps = {}): Promise<string> {
  const sign = deps.sign ?? signAssertion;
  const send = deps.fetch ?? fetch;
  const nowSeconds = Math.floor((deps.now ?? Date.now)() / 1000);
  const assertion = await sign(buildJwtClaims(config.clientEmail, nowSeconds), config.privateKey);
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const response = await send(GSC_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const detail = await explain(response);
    throw new GscError(`Google sign-in failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new GscError('Google sign-in returned no access token.');
  return parsed.data.access_token;
}

// ---------------------------------------------------------------------------
// Asking for rows

export type DateRange = { startDate: string; endDate: string };

/** The last `days` days up to and including yesterday (UTC). */
export function recentRange(now: Date, days = GSC_PULL_DAYS): DateRange {
  const endDate = addDays(now.toISOString().slice(0, 10), -1);
  return { startDate: addDays(endDate, -(days - 1)), endDate };
}

export function searchAnalyticsUrl(siteUrl: string): string {
  return `${GSC_API_ROOT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
}

export function buildQueryBody(range: DateRange, rowLimit = GSC_ROW_LIMIT) {
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ['date', 'query', 'page'],
    rowLimit,
    startRow: 0,
    // Includes the newest days; the daily re-pull of the last three days settles them.
    dataState: 'all',
  };
}

/** A row ready for the search_console_daily table. */
export type DailyRow = {
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const apiRowSchema = z.object({
  keys: z.array(z.string()).length(3),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});

const apiResponseSchema = z.object({ rows: z.array(z.unknown()).optional() });

/** Reads a Search Analytics response. Google leaves `rows` out when there is no data. */
export function parseSearchAnalyticsResponse(json: unknown): { rows: DailyRow[]; skipped: number } {
  const response = apiResponseSchema.safeParse(json);
  if (!response.success) throw new GscError('Search Console returned an unexpected response.');
  const rows: DailyRow[] = [];
  let skipped = 0;
  for (const item of response.data.rows ?? []) {
    const parsed = apiRowSchema.safeParse(item);
    if (!parsed.success || !isIsoDate(parsed.data.keys[0])) {
      skipped += 1;
      continue;
    }
    const [date, query, page] = parsed.data.keys;
    const { clicks, impressions, ctr, position } = parsed.data;
    rows.push({ date, query, page, clicks, impressions, ctr, position });
  }
  return { rows, skipped };
}

/**
 * Shapes rows for the upsert: whole numbers, trimmed text, and one row per
 * (date, query, page) so a single INSERT never touches the same row twice.
 * Duplicates add up, with the position averaged by impressions.
 */
export function toDailyRows(rows: DailyRow[]): DailyRow[] {
  const merged = new Map<string, { row: DailyRow; weighted: number }>();
  for (const input of rows) {
    const query = input.query.trim();
    const page = input.page.trim();
    const clicks = Math.max(0, Math.round(input.clicks));
    const impressions = Math.max(0, Math.round(input.impressions));
    const position = Math.max(0, input.position);
    const key = JSON.stringify([input.date, query, page]);
    const entry = merged.get(key);
    if (!entry) {
      const row = { date: input.date, query, page, clicks, impressions, ctr: 0, position };
      merged.set(key, { row, weighted: position * impressions });
      continue;
    }
    entry.row.clicks += clicks;
    entry.row.impressions += impressions;
    entry.weighted += position * impressions;
    entry.row.position = entry.row.impressions > 0 ? entry.weighted / entry.row.impressions : position;
  }
  return [...merged.values()].map(({ row }) => ({
    ...row,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
  }));
}

export type FetchOptions = { source?: GscSource; now?: Date; days?: number; deps?: GscDeps };
export type FetchResult =
  | { configured: true; range: DateRange; rows: DailyRow[]; skipped: number }
  | NotConfigured;

/** Pulls the last few days of query + page rows. Unconfigured: returns at once, no network. */
export async function fetchRecentRows(options: FetchOptions = {}): Promise<FetchResult> {
  const settings = resolveGscConfig(options.source ?? env);
  if (!settings.configured) return settings;
  const { config } = settings;
  const deps = options.deps ?? {};
  const send = deps.fetch ?? fetch;
  const now = options.now ?? new Date((deps.now ?? Date.now)());
  const range = recentRange(now, options.days);
  const token = await requestAccessToken(config, deps);
  const response = await send(searchAnalyticsUrl(config.siteUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(buildQueryBody(range)),
  });
  if (!response.ok) {
    const detail = await explain(response);
    throw new GscError(`Search Console request failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const { rows, skipped } = parseSearchAnalyticsResponse(await response.json());
  return { configured: true, range, rows: toDailyRows(rows), skipped };
}
