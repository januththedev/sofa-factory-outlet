import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
export const newAccessToken = () => randomBytes(32).toString('hex');
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const validAccessToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export const bookingCookie = (reference: string) => `sfo-visit-${reference}`;
export async function canReadBooking(
  reference: string,
  token: string | undefined,
): Promise<boolean> {
  if (!validAccessToken(token)) return false;
  const db = await getDb();
  const [found] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.reference, reference),
        eq(bookings.accessHash, tokenHash(token)),
        gt(bookings.accessExpiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(found);
}
