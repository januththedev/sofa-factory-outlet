import { notImplemented } from '../not-implemented';
import type { AdminRole } from '../db/schema/types';

// CONTRACT STUB. Owner: "auth-shell" agent. Keep these exports and signatures.
// Admin pages, server actions and route handlers call requireRole() themselves:
// the proxy can only check that a session cookie exists, never that it is valid.

export type AdminSession = { userId: number; email: string; name: string; role: AdminRole };

/** The signed-in admin, or null. */
export const getSession: () => Promise<AdminSession | null> = async () => notImplemented('getSession');

/**
 * Returns the session or redirects to /admin/login/. 'owner' also rejects staff
 * (settings, users and deletes are owner-only). Use at the top of every admin
 * page, action and route handler.
 */
export const requireRole: (minimum?: AdminRole | 'any') => Promise<AdminSession> = async () => notImplemented('requireRole');
