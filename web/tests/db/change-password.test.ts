import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changeOwnPassword, passwordProblem } from '@/lib/auth/change-password';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { roleLabel } from '@/lib/auth/roles';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

let db: Db;
let userId = 0;
let inactiveId = 0;

beforeAll(async () => {
  db = await getDb();
  const [user] = await db
    .insert(s.adminUsers)
    .values({ name: 'Pw Tester', email: 'pw-tester@example.lk', passwordHash: await hashPassword('old-password-1'), role: 'staff' })
    .returning({ id: s.adminUsers.id });
  userId = user.id;
  const [off] = await db
    .insert(s.adminUsers)
    .values({
      name: 'Gone',
      email: 'pw-gone@example.lk',
      passwordHash: await hashPassword('old-password-1'),
      role: 'staff',
      active: false,
    })
    .returning({ id: s.adminUsers.id });
  inactiveId = off.id;
});

afterAll(async () => {
  await closeDb();
});

const hashOf = async (id: number) =>
  (await db.select({ hash: s.adminUsers.passwordHash }).from(s.adminUsers).where(eq(s.adminUsers.id, id)))[0].hash;

describe('passwordProblem', () => {
  it('asks for at least ten characters', () => {
    expect(passwordProblem('short', 'old')).toMatch(/at least 10/);
    expect(passwordProblem('exactly-10', 'old')).toBeNull();
  });
  it('refuses a password bcrypt would silently cut short', () => {
    expect(passwordProblem('a'.repeat(73), 'old')).toMatch(/at most 72/);
    expect(passwordProblem('é'.repeat(37), 'old')).toMatch(/at most 72/);
  });
  it('refuses reusing the current password', () => {
    expect(passwordProblem('same-password-1', 'same-password-1')).toMatch(/different/);
  });
});

describe('changeOwnPassword', () => {
  it('needs the current password to be right and leaves the old one working when it is not', async () => {
    const result = await changeOwnPassword(db, userId, 'wrong-guess-123', 'brand-new-pass-9');
    expect(result).toEqual({ ok: false, error: 'The current password is not right.' });
    expect(await verifyPassword('old-password-1', await hashOf(userId))).toBe(true);
  });

  it('sets the new password, stored only as a hash', async () => {
    const result = await changeOwnPassword(db, userId, 'old-password-1', 'brand-new-pass-9');
    expect(result).toEqual({ ok: true });
    const hash = await hashOf(userId);
    expect(hash).not.toContain('brand-new-pass-9');
    expect(await verifyPassword('brand-new-pass-9', hash)).toBe(true);
    expect(await verifyPassword('old-password-1', hash)).toBe(false);
  });

  it('refuses a weak new password without changing anything', async () => {
    const before = await hashOf(userId);
    const result = await changeOwnPassword(db, userId, 'brand-new-pass-9', 'tiny');
    expect(result.ok).toBe(false);
    expect(await hashOf(userId)).toBe(before);
  });

  it('refuses a deactivated account and a missing one', async () => {
    expect(await changeOwnPassword(db, inactiveId, 'old-password-1', 'brand-new-pass-9')).toMatchObject({ ok: false });
    expect(await changeOwnPassword(db, 999_999, 'x', 'brand-new-pass-9')).toMatchObject({ ok: false });
  });
});

describe('roleLabel', () => {
  it('shows people the names Super admin and Admin', () => {
    expect(roleLabel('owner')).toBe('Super admin');
    expect(roleLabel('staff')).toBe('Admin');
  });
});
