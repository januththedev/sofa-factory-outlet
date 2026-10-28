import { randomInt } from 'node:crypto';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import type { Db, Tx } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { AdminRole } from '@/lib/db/schema/types';

// Staff account rules for the Settings page. Kept apart from actions.ts (a
// 'use server' file may export only async functions) so they can be tested.

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: Date | null;
};

export type StaffResult =
  | { ok: true; message: string; tempPassword?: string }
  | { ok: false; error: string };

// No 0/O, 1/l/I: the password is read off the screen and typed or sent on WhatsApp.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTempPassword(length = 14): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

const LAST_OWNER = 'There must always be at least one active owner.';

export async function listStaff(db: Db): Promise<StaffMember[]> {
  return db
    .select({
      id: s.adminUsers.id,
      name: s.adminUsers.name,
      email: s.adminUsers.email,
      role: s.adminUsers.role,
      active: s.adminUsers.active,
      lastLoginAt: s.adminUsers.lastLoginAt,
    })
    .from(s.adminUsers)
    .orderBy(asc(s.adminUsers.name), asc(s.adminUsers.id));
}

async function findUser(db: Db, id: number) {
  const [user] = await db
    .select({ id: s.adminUsers.id, name: s.adminUsers.name, role: s.adminUsers.role, active: s.adminUsers.active })
    .from(s.adminUsers)
    .where(eq(s.adminUsers.id, id))
    .limit(1);
  return user ?? null;
}

/** Other owners who can still sign in. Rows are locked so two requests cannot both remove the last one. */
async function otherActiveOwners(tx: Tx, excludeId: number) {
  const rows = await tx
    .select({ id: s.adminUsers.id })
    .from(s.adminUsers)
    .where(and(eq(s.adminUsers.role, 'owner'), eq(s.adminUsers.active, true), ne(s.adminUsers.id, excludeId)))
    .for('update');
  return rows.length;
}

export async function createStaff(
  db: Db,
  input: { name: string; email: string; role: AdminRole },
): Promise<StaffResult> {
  const email = input.email.trim().toLowerCase();
  const [taken] = await db
    .select({ id: s.adminUsers.id })
    .from(s.adminUsers)
    .where(sql`lower(${s.adminUsers.email}) = ${email}`)
    .limit(1);
  if (taken) return { ok: false, error: 'An account with that email address already exists.' };

  const tempPassword = generateTempPassword();
  try {
    await db.insert(s.adminUsers).values({
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(tempPassword),
      role: input.role,
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return { ok: false, error: 'An account with that email address already exists.' };
    }
    throw error;
  }
  return { ok: true, message: `Account created for ${input.name.trim()}.`, tempPassword };
}

export async function changeStaffRole(db: Db, id: number, role: AdminRole): Promise<StaffResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: s.adminUsers.id, name: s.adminUsers.name, role: s.adminUsers.role, active: s.adminUsers.active })
      .from(s.adminUsers)
      .where(eq(s.adminUsers.id, id))
      .limit(1);
    if (!user) return { ok: false, error: 'That account no longer exists.' };
    const label = role === 'owner' ? 'an owner' : 'staff';
    if (user.role === role) return { ok: true, message: `${user.name} is already ${label}.` };
    if (user.role === 'owner' && user.active && (await otherActiveOwners(tx, id)) === 0) {
      return { ok: false, error: LAST_OWNER };
    }
    await tx.update(s.adminUsers).set({ role }).where(eq(s.adminUsers.id, id));
    return { ok: true, message: `${user.name} is now ${label}.` };
  });
}

/** Switching an account off ends its access at once: every page re-reads `active` from the database. */
export async function setStaffActive(db: Db, actorId: number, id: number, active: boolean): Promise<StaffResult> {
  if (!active && id === actorId) return { ok: false, error: 'You cannot deactivate your own account.' };
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: s.adminUsers.id, name: s.adminUsers.name, role: s.adminUsers.role, active: s.adminUsers.active })
      .from(s.adminUsers)
      .where(eq(s.adminUsers.id, id))
      .limit(1);
    if (!user) return { ok: false, error: 'That account no longer exists.' };
    if (user.active === active) {
      return { ok: true, message: `${user.name} is already ${active ? 'active' : 'deactivated'}.` };
    }
    if (!active && user.role === 'owner' && (await otherActiveOwners(tx, id)) === 0) {
      return { ok: false, error: LAST_OWNER };
    }
    await tx.update(s.adminUsers).set({ active }).where(eq(s.adminUsers.id, id));
    return { ok: true, message: `${user.name} was ${active ? 'reactivated' : 'deactivated'}.` };
  });
}

export async function resetStaffPassword(db: Db, id: number): Promise<StaffResult> {
  const user = await findUser(db, id);
  if (!user) return { ok: false, error: 'That account no longer exists.' };
  const tempPassword = generateTempPassword();
  await db
    .update(s.adminUsers)
    .set({ passwordHash: await hashPassword(tempPassword) })
    .where(eq(s.adminUsers.id, id));
  return { ok: true, message: `New temporary password set for ${user.name}.`, tempPassword };
}
