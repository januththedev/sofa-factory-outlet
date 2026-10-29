import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type DbOrTx, getDb } from '../db';
import * as s from '../db/schema';

export type NotificationType = (typeof s.notifications.$inferInsert)['type'];
export type NotificationInput = {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

/** Writes a bell notification. Pass a transaction to make it part of a larger write. */
export async function createNotification(
  input: NotificationInput,
  tx?: DbOrTx,
): Promise<number> {
  const db = tx ?? (await getDb());
  const [row] = await db
    .insert(s.notifications)
    .values({
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })
    .returning({ id: s.notifications.id });
  return row.id;
}

/** Like createNotification, but never throws: a failed alert must not fail the booking or chat that caused it. */
export async function notify(input: NotificationInput): Promise<void> {
  try {
    await createNotification(input);
  } catch (error) {
    console.error('[notify] could not write notification:', error);
  }
}

export async function unreadNotificationCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.notifications)
    .where(isNull(s.notifications.readAt));
  return row.n;
}

export async function listNotifications(
  options: { limit?: number; unreadOnly?: boolean } = {},
) {
  const db = await getDb();
  return db
    .select()
    .from(s.notifications)
    .where(options.unreadOnly ? isNull(s.notifications.readAt) : undefined)
    .orderBy(desc(s.notifications.createdAt), desc(s.notifications.id))
    .limit(options.limit ?? 30);
}

/** Marks the given notifications (or all unread ones when no ids are passed) as read. */
export async function markNotificationsRead(ids?: number[]): Promise<void> {
  const db = await getDb();
  await db
    .update(s.notifications)
    .set({ readAt: new Date() })
    .where(
      ids?.length
        ? and(inArray(s.notifications.id, ids), isNull(s.notifications.readAt))
        : isNull(s.notifications.readAt),
    );
}

export async function deleteNotification(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(s.notifications).where(eq(s.notifications.id, id));
}
