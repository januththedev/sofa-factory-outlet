import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { listNotifications, markNotificationsRead, unreadNotificationCount } from '@/lib/notify/bell';
import type { AdminSession } from './session';

// The logic behind GET/POST /api/admin/notifications/, kept out of route.ts so it
// can be tested without a server (a route file may only export HTTP handlers).

export type BellItem = {
  id: number;
  type: (typeof s.notifications.$inferSelect)['type'];
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type BellPayload = { unread: number; unreadBookings: number; items: BellItem[] };

/** Unread notifications of type "booking": the number on the sidebar's Bookings badge. */
export async function unreadBookingsCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.notifications)
    .where(and(eq(s.notifications.type, 'booking'), isNull(s.notifications.readAt)));
  return row.n;
}

export async function loadBellPayload(limit = 20): Promise<BellPayload> {
  const [unread, unreadBookings, rows] = await Promise.all([unreadNotificationCount(), unreadBookingsCount(), listNotifications({ limit })]);
  return {
    unread,
    unreadBookings,
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

// Serial ids are 32-bit; anything larger would make Postgres raise instead of matching nothing.
const markSchema = z.object({ ids: z.array(z.number().int().min(1).max(2_147_483_647)).max(100).optional() });

export type ApiResult = { status: number; body: unknown };

const MAX_BODY_CHARS = 5_000;

/** GET: the unread counts and the latest notifications. */
export async function notificationsGet(session: AdminSession | null): Promise<ApiResult> {
  if (!session) return { status: 401, body: { error: 'Sign in again.' } };
  return { status: 200, body: await loadBellPayload() };
}

/**
 * POST `{ ids?: number[] }`: marks those notifications read, or every unread one when
 * `ids` is left out. An empty `ids` list marks nothing (markNotificationsRead itself
 * would treat it as "all"). Replies with the fresh counts and list.
 */
export async function notificationsPost(
  session: AdminSession | null,
  input: { bodyText: string; origin: string | null; host: string | null },
): Promise<ApiResult> {
  if (!session) return { status: 401, body: { error: 'Sign in again.' } };
  if (!isSameOrigin(input.origin, input.host)) return { status: 403, body: { error: 'Cross-site request refused.' } };
  if (input.bodyText.length > MAX_BODY_CHARS) return { status: 413, body: { error: 'Request too large.' } };

  let json: unknown;
  try {
    json = input.bodyText.trim() === '' ? {} : JSON.parse(input.bodyText);
  } catch {
    return { status: 400, body: { error: 'Send a JSON body.' } };
  }
  const parsed = markSchema.safeParse(json);
  if (!parsed.success) return { status: 400, body: { error: 'Send { "ids": [numbers] } or {}.' } };

  const { ids } = parsed.data;
  if (!ids || ids.length > 0) await markNotificationsRead(ids);
  return { status: 200, body: await loadBellPayload() };
}

/** Browsers send Origin on POST; when it names another site the request is refused. A missing Origin (not a browser form or fetch) is let through: the SameSite cookie already keeps other sites out. */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
