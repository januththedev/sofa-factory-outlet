import { and, gte, lt, sql } from 'drizzle-orm';
import { type DbOrTx, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

// Daily roll-ups for the Visitors page. Sri Lanka has no daylight saving, so a
// Colombo day is always UTC+05:30. Metrics are keyed by (date, metric,
// dimension) and upserted, which makes rerunning the job harmless.

export const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const RAW_EVENT_RETENTION_DAYS = 90;

/** The Asia/Colombo calendar date for an instant. */
export function colomboDate(at: Date): string {
  return new Date(at.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instant at which a Colombo calendar date starts. */
export function colomboDayStart(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - COLOMBO_OFFSET_MS);
}

export function colomboDayEnd(date: string): Date {
  return new Date(colomboDayStart(date).getTime() + DAY_MS);
}

/** The last `count` Colombo dates, oldest first, ending on the day containing `now`. */
export function colomboDays(count: number, now: Date = new Date()): string[] {
  const today = colomboDate(now);
  const start = colomboDayStart(today).getTime();
  const dates: string[] = [];
  for (let offset = Math.max(0, count) - 1; offset >= 0; offset -= 1) {
    dates.push(colomboDate(new Date(start - offset * DAY_MS)));
  }
  return dates;
}

type EventRow = {
  visitorId: string;
  sessionId: string;
  type: string;
  path: string | null;
  productId: number | null;
  country: string | null;
  city: string | null;
  device: string | null;
  source: string | null;
  createdAt: Date;
};

type Cell = { date: string; metric: string; dimension: string; value: number };

type UniqueCell = { date: string; metric: string; dimension: string; seen: Set<string> };

const cellKey = (date: string, metric: string, dimension: string) => `${date}\u0000${metric}\u0000${dimension}`;

export type RebuildOptions = { days?: number; now?: Date; db?: DbOrTx };
export type RebuildResult = { dates: string[]; events: number; rows: number };

/**
 * Rebuild `daily_stats` for the last `days` Colombo days (default 3).
 *
 * Metrics: visitors, sessions, page_views, product_views, add_to_cart,
 * chat_opened, chat_messages, booking_started, booking_submitted,
 * whatsapp_clicks, source, device, city and top_page. Dimensioned metrics count
 * distinct visitors (product_views/top_page count events).
 */
export async function rebuildDailyStats(options: RebuildOptions = {}): Promise<RebuildResult> {
  const db = options.db ?? (await getDb());
  const now = options.now ?? new Date();
  const dates = colomboDays(options.days ?? 3, now);
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(dates[dates.length - 1]);

  const events: EventRow[] = await db
    .select({
      visitorId: s.events.visitorId,
      sessionId: s.events.sessionId,
      type: s.events.type,
      path: s.events.path,
      productId: s.events.productId,
      country: s.events.country,
      city: s.events.city,
      device: s.events.device,
      source: s.events.source,
      createdAt: s.events.createdAt,
    })
    .from(s.events)
    .where(and(gte(s.events.createdAt, from), lt(s.events.createdAt, to)));

  const counted = new Map<string, Cell>();
  const unique = new Map<string, UniqueCell>();

  const add = (date: string, metric: string, dimension = '', amount = 1) => {
    const key = cellKey(date, metric, dimension);
    const cell = counted.get(key);
    if (cell) cell.value += amount;
    else counted.set(key, { date, metric, dimension, value: amount });
  };
  const addUnique = (date: string, metric: string, dimension: string, visitorId: string) => {
    const key = cellKey(date, metric, dimension);
    const cell = unique.get(key);
    if (cell) cell.seen.add(visitorId);
    else unique.set(key, { date, metric, dimension, seen: new Set([visitorId]) });
  };

  for (const event of events) {
    const date = colomboDate(event.createdAt);
    addUnique(date, 'visitors', '', event.visitorId);
    addUnique(date, 'sessions', '', event.sessionId);
    if (event.path && event.type === 'page_view') add(date, 'top_page', event.path);
    if (event.productId !== null && event.type === 'product_view') add(date, 'product_views', String(event.productId));
    if (event.type === 'page_view') add(date, 'page_views');
    if (event.type === 'add_to_cart') add(date, 'add_to_cart');
    if (event.type === 'chat_open') add(date, 'chat_opened');
    if (event.type === 'chat_message') add(date, 'chat_messages');
    if (event.type === 'booking_start') add(date, 'booking_started');
    if (event.type === 'booking_submit') add(date, 'booking_submitted');
    if (event.type === 'whatsapp_click') add(date, 'whatsapp_clicks');

    addUnique(date, 'source', event.source || 'other', event.visitorId);
    addUnique(date, 'device', event.device || 'unknown', event.visitorId);
    // The Visitors page lists Sri Lankan cities only; local requests have no country.
    if (event.city && (!event.country || event.country === 'LK')) addUnique(date, 'city', event.city, event.visitorId);
  }

  for (const cell of unique.values()) {
    counted.set(cellKey(cell.date, cell.metric, cell.dimension), {
      date: cell.date,
      metric: cell.metric,
      dimension: cell.dimension,
      value: cell.seen.size,
    });
  }

  const rows = [...counted.values()];
  for (let start = 0; start < rows.length; start += 200) {
    const chunk = rows.slice(start, start + 200);
    if (!chunk.length) continue;
    const values = chunk.map((cell) => ({
      date: cell.date,
      metric: cell.metric,
      dimension: cell.dimension,
      value: cell.value,
    }));
    await db
      .insert(s.dailyStats)
      .values(values)
      .onConflictDoUpdate({
        target: [s.dailyStats.date, s.dailyStats.metric, s.dailyStats.dimension],
        set: { value: sql`excluded.value` },
      });
  }

  return { dates, events: events.length, rows: rows.length };
}

export type PurgeOptions = { now?: Date; days?: number; db?: DbOrTx };

/** Delete raw events older than the retention window. Returns how many went. */
export async function purgeOldEvents(options: PurgeOptions = {}): Promise<number> {
  const db = options.db ?? (await getDb());
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - (options.days ?? RAW_EVENT_RETENTION_DAYS) * DAY_MS);
  const removed = await db.delete(s.events).where(lt(s.events.createdAt, cutoff)).returning({ id: s.events.id });
  return removed.length;
}

export type RollupResult = RebuildResult & { purged: number };

/** The nightly job: rebuild the last three days, then drop events past retention. */
export async function runRollup(options: RebuildOptions = {}): Promise<RollupResult> {
  const db = options.db ?? (await getDb());
  const now = options.now ?? new Date();
  const rebuilt = await rebuildDailyStats({ ...options, now, db });
  const purged = await purgeOldEvents({ now, db });
  return { ...rebuilt, purged };
}
