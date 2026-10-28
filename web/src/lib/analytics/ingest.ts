import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { type DbOrTx, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { type IngestContext, referrerHost, sourceBucket, type TrackPayloadInput } from './server';
import { classifyUserAgent } from './ua';

// Writes one tracked event with the fields derived on the server. Raw user
// agents, IP addresses and full referrer URLs never reach the table.

/** Soft ceiling per visitor, per rolling hour. */
export const MAX_EVENTS_PER_VISITOR_PER_HOUR = 300;

export type IngestResult = 'inserted' | 'bot' | 'rate_limited';

export type IngestOptions = {
  db?: DbOrTx;
  /** Overridable in tests so the limit can be exercised without 301 rows. */
  limit?: number;
};

export async function ingestEvent(
  payload: TrackPayloadInput,
  context: IngestContext,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const db = options.db ?? (await getDb());
  const limit = options.limit ?? MAX_EVENTS_PER_VISITOR_PER_HOUR;
  const now = context.now ?? new Date();

  const agent = classifyUserAgent(context.userAgent);
  if (agent.bot) return 'bot';

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.events)
    .where(
      and(
        eq(s.events.visitorId, payload.visitorId),
        gte(s.events.createdAt, hourAgo),
        lte(s.events.createdAt, now),
      ),
    );
  if ((recent?.count ?? 0) >= Math.max(0, limit)) return 'rate_limited';

  const referrer = referrerHost(payload.referrer);
  const utmSource = payload.utm?.source?.trim() || null;
  const utmMedium = payload.utm?.medium?.trim() || null;
  const utmCampaign = payload.utm?.campaign?.trim() || null;

  await db.insert(s.events).values({
    visitorId: payload.visitorId,
    sessionId: payload.sessionId,
    type: payload.type,
    path: payload.path,
    productId: payload.productId ?? null,
    variantId: payload.variantId ?? null,
    value: (payload.value as Record<string, unknown> | undefined) ?? null,
    country: context.country ?? null,
    region: context.region ?? null,
    city: context.city ?? null,
    device: agent.device,
    browser: agent.browser,
    os: agent.os,
    referrer,
    source: sourceBucket(payload.referrer, utmSource),
    utmSource,
    utmMedium,
    utmCampaign,
    createdAt: now,
  });

  return 'inserted';
}
