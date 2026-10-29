import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { type DbOrTx, getDb } from '@/lib/db';
import { rateBuckets } from '@/lib/db/schema';
import { tokenHash } from './access';
/** Atomic fixed-window counter shared by every app instance. Keys contain hashes, never raw phones/IPs. */
export async function consumeLimit(
  key: string,
  limit: number,
  windowMs: number,
  database?: DbOrTx,
): Promise<boolean> {
  const db = database ?? (await getDb());
  const now = new Date();
  const [row] = await db
    .insert(rateBuckets)
    .values({
      key: tokenHash(key),
      count: 1,
      expiresAt: new Date(now.getTime() + windowMs),
    })
    .onConflictDoUpdate({
      target: rateBuckets.key,
      set: {
        count: sql`case when ${rateBuckets.expiresAt} <= ${now} then 1 else ${rateBuckets.count} + 1 end`,
        expiresAt: sql`case when ${rateBuckets.expiresAt} <= ${now} then ${new Date(now.getTime() + windowMs)} else ${rateBuckets.expiresAt} end`,
      },
    })
    .returning({ count: rateBuckets.count });
  return row.count <= limit;
}
export async function resetSharedLimit(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(rateBuckets).where(eq(rateBuckets.key, tokenHash(key)));
}
