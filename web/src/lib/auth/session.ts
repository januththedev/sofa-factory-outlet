import 'server-only';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { AdminRole } from '@/lib/db/schema/types';
import { auth } from './auth';
import { loginUrl, OWNER_ONLY_PATH, PATH_HEADER } from './paths';

// Admin pages, server actions and route handlers call requireRole() themselves:
// the proxy (gate.ts) can only check that a session cookie exists, never that it
// is valid, and a layout's redirect does not stop its page from running.

export type AdminSession = { userId: number; email: string; name: string; role: AdminRole };

// Memoised for the length of one render, so a layout, a page and the bell route
// asking in the same request cost a single database read.
const loadSession = cache(async (): Promise<AdminSession | null> => {
  const current = await auth();
  const userId = Number(current?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;

  // The cookie only proves who signed in. Name, email and role come from the
  // database every time, so deactivating or demoting someone takes effect at once.
  const db = await getDb();
  const [user] = await db
    .select({ id: s.adminUsers.id, email: s.adminUsers.email, name: s.adminUsers.name, role: s.adminUsers.role })
    .from(s.adminUsers)
    .where(and(eq(s.adminUsers.id, userId), eq(s.adminUsers.active, true)))
    .limit(1);
  return user ? { userId: user.id, email: user.email, name: user.name, role: user.role } : null;
});

/** The signed-in admin, or null. */
export const getSession: () => Promise<AdminSession | null> = () => loadSession();

/**
 * Returns the session or redirects to /admin/login/ (remembering the page asked
 * for). 'owner' also rejects staff: they are sent to the dashboard, where the
 * shell shows a notice. (Next's forbidden() would be a proper 403 page but needs
 * `experimental.authInterrupts` in next.config.ts.) Use at the top of every
 * admin page, action and route handler.
 */
export const requireRole: (minimum?: AdminRole | 'any') => Promise<AdminSession> = async (minimum = 'any') => {
  const session = await getSession();
  if (!session) redirect(loginUrl((await headers()).get(PATH_HEADER)));
  if (minimum === 'owner' && session.role !== 'owner') redirect(OWNER_ONLY_PATH);
  return session;
};
