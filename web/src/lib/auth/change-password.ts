import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { hashPassword, verifyPassword } from './password';

export const MIN_PASSWORD_LENGTH = 10;
// bcrypt only reads the first 72 bytes, so a longer password would silently be cut short.
export const MAX_PASSWORD_LENGTH = 72;

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/** Pure rules, so the form and the tests agree. Returns an error message or null. */
export function passwordProblem(next: string, current: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(next).length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (next === current) return 'Choose a password different from the current one.';
  return null;
}

/** An admin changing their own password: the current one must be right. */
export async function changeOwnPassword(
  db: Db,
  userId: number,
  current: string,
  next: string,
): Promise<ChangePasswordResult> {
  const [user] = await db
    .select({ hash: s.adminUsers.passwordHash, active: s.adminUsers.active })
    .from(s.adminUsers)
    .where(eq(s.adminUsers.id, userId))
    .limit(1);
  if (!user || !user.active) return { ok: false, error: 'This account can no longer sign in.' };
  if (!(await verifyPassword(current, user.hash))) return { ok: false, error: 'The current password is not right.' };
  const problem = passwordProblem(next, current);
  if (problem) return { ok: false, error: problem };
  await db.update(s.adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(s.adminUsers.id, userId));
  return { ok: true };
}
