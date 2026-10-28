import 'server-only';

import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

// Spam brake for public forms. It needs no table of its own: it counts the rows
// the form has already produced. A key says what to count:
//   visitor:<id>   bookings made by one browser (bookings.visitor_id)
//   phone:<+94…>   bookings made with one phone number (customers.phone)

export type RateLimitKey = `visitor:${string}` | `phone:${string}`;
export const visitorKey = (visitorId: string): RateLimitKey => `visitor:${visitorId}`;
export const phoneKey = (e164: string): RateLimitKey => `phone:${e164}`;

export type RateLimitOptions = {
  key: RateLimitKey;
  /** The most rows allowed inside the window: the (limit + 1)th attempt is refused. */
  limit: number;
  windowMs: number;
  /** For tests; defaults to the current time. */
  now?: Date;
};

/** Number of rows for this key created inside the last `windowMs`. */
export async function countRecent({ key, windowMs, now = new Date() }: Pick<RateLimitOptions, 'key' | 'windowMs' | 'now'>): Promise<number> {
  const db = await getDb();
  const since = new Date(now.getTime() - windowMs);
  const separator = key.indexOf(':');
  const kind = key.slice(0, separator);
  const value = key.slice(separator + 1);

  if (kind === 'visitor') {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(s.bookings)
      .where(and(eq(s.bookings.visitorId, value), gt(s.bookings.createdAt, since)));
    return row.total;
  }
  if (kind === 'phone') {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(s.bookings)
      .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
      .where(and(eq(s.customers.phone, value), gt(s.bookings.createdAt, since)));
    return row.total;
  }
  throw new Error(`Unsupported rate-limit key: ${kind}`);
}

/** True when the key has already used up its allowance inside the window. */
export async function isRateLimited(options: RateLimitOptions): Promise<boolean> {
  return (await countRecent(options)) >= options.limit;
}
