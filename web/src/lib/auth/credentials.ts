import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { DUMMY_HASH, verifyPassword } from './password';
import { consumeLimit, resetSharedLimit } from '@/lib/security/shared-limit';
import { clientIp, loginLimiter } from './rate-limit';
import type { AdminSession } from './session';

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // bcrypt only reads the first 72 bytes; the cap just stops absurd payloads.
  password: z.string().min(1).max(256),
});

/**
 * Checks an email and password against `admin_users` (email matched through
 * `lower(email)`, only active accounts). A bcrypt comparison always runs, against
 * DUMMY_HASH when there is nothing to compare with, and every failure returns the
 * same null, so neither the answer nor its timing says whether an email exists.
 * Stamps `lastLoginAt` on success.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AdminSession | null> {
  const db = await getDb();
  const [user] = await db
    .select({
      id: s.adminUsers.id,
      name: s.adminUsers.name,
      email: s.adminUsers.email,
      passwordHash: s.adminUsers.passwordHash,
      role: s.adminUsers.role,
      active: s.adminUsers.active,
    })
    .from(s.adminUsers)
    .where(sql`lower(${s.adminUsers.email}) = lower(${email})`)
    .limit(1);

  const usable = user?.active ? user : null;
  const matches = await verifyPassword(
    password,
    usable?.passwordHash ?? DUMMY_HASH,
  );
  if (!usable || !matches) return null;

  await db
    .update(s.adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(s.adminUsers.id, usable.id));
  return {
    userId: usable.id,
    email: usable.email,
    name: usable.name,
    role: usable.role,
  };
}

/**
 * What the Auth.js Credentials provider calls. Everything sign-in related lives
 * here, not in the form action, because /api/auth/callback/credentials reaches it
 * too and must be rate-limited just the same. Returns null for every kind of failure.
 */
export async function authorizeCredentials(
  raw: unknown,
  request?: Pick<Request, 'headers'>,
): Promise<{ id: string; name: string; email: string } | null> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  const ip = request ? clientIp(request.headers) : 'unknown';

  if (loginLimiter.isBlocked(email, ip)) return null;
  const pairKey = `login:${email}:${ip}`;
  try {
    if (
      !(await consumeLimit(pairKey, 5, 15 * 60000)) ||
      !(await consumeLimit(`login-ip:${ip}`, 20, 15 * 60000))
    )
      return null;
  } catch {
    return null;
  }
  const session = await verifyCredentials(email, password);
  if (!session) {
    loginLimiter.recordFailure(email, ip);
    return null;
  }
  loginLimiter.recordSuccess(email, ip);
  await resetSharedLimit(pairKey);
  return {
    id: String(session.userId),
    name: session.name,
    email: session.email,
  };
}
