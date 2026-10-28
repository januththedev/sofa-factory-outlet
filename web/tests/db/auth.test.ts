import { Auth, type AuthConfig, raw, skipCSRFCheck } from '@auth/core';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

// next/headers, next/navigation and next-auth's own entry (which needs Next's
// bundler to load) are replaced; everything else here is the real code on a real
// in-memory Postgres. Auth.js itself runs for real through @auth/core in the
// "Auth.js pipeline" block.
const mocks = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public readonly to: string) {
      super(`redirect:${to}`);
    }
  }
  return {
    RedirectSignal,
    headers: vi.fn(),
    cookies: vi.fn(),
    redirect: vi.fn((to: string): never => {
      throw new RedirectSignal(to);
    }),
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});
vi.mock('next/headers', () => ({ headers: mocks.headers, cookies: mocks.cookies }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth/auth', () => ({ auth: mocks.auth, signIn: mocks.signIn, signOut: mocks.signOut, handlers: {} }));
vi.mock('@/lib/auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/password')>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import { signInAction, signOutAction } from '@/lib/auth/actions';
import { authConfig } from '@/lib/auth/config';
import { authorizeCredentials, verifyCredentials } from '@/lib/auth/credentials';
import { notificationsGet, notificationsPost, unreadBookingsCount } from '@/lib/auth/notifications';
import { DUMMY_HASH, verifyPassword } from '@/lib/auth/password';
import { loginLimiter, resetLoginLimiter } from '@/lib/auth/rate-limit';
import { type AdminSession, getSession, requireRole } from '@/lib/auth/session';
import { createNotification } from '@/lib/notify/bell';

const OWNER_EMAIL = 'owner@test.local';
const OWNER_PASSWORD = 'test-password-123';
const verify = vi.mocked(verifyPassword);

let db: Db;
let ownerId: number;

beforeAll(async () => {
  db = await getDb(); // memory:// — migrated and seeded, owner from OWNER_EMAIL / OWNER_PASSWORD
  const [owner] = await db.select().from(s.adminUsers).where(eq(s.adminUsers.email, OWNER_EMAIL));
  ownerId = owner.id;
});

afterAll(async () => {
  await closeDb();
});

beforeEach(() => {
  resetLoginLimiter();
  verify.mockClear();
  mocks.redirect.mockClear();
  mocks.signIn.mockReset();
  mocks.signOut.mockReset();
  mocks.auth.mockReset();
  mocks.headers.mockReset();
  mocks.cookies.mockReset();
  mocks.headers.mockResolvedValue(new Headers());
});

/** Inserts an account with a cheap hash (the tests only need the check to work, not to be slow). */
async function addUser(email: string, password: string, extra: Partial<typeof s.adminUsers.$inferInsert> = {}) {
  const [row] = await db
    .insert(s.adminUsers)
    .values({ name: 'Test user', email, passwordHash: bcrypt.hashSync(password, 4), role: 'staff', ...extra })
    .returning();
  return row;
}

const request = (ip: string) => ({ headers: new Headers({ 'x-forwarded-for': ip }) });
const lastLogin = async (id: number) => (await db.select({ at: s.adminUsers.lastLoginAt }).from(s.adminUsers).where(eq(s.adminUsers.id, id)))[0].at;

describe('verifyCredentials', () => {
  it('signs in the seeded owner and stamps lastLoginAt', async () => {
    expect(await lastLogin(ownerId)).toBeNull();
    const session = await verifyCredentials(OWNER_EMAIL, OWNER_PASSWORD);
    expect(session).toEqual({ userId: ownerId, email: OWNER_EMAIL, name: 'Owner', role: 'owner' });
    const stamped = await lastLogin(ownerId);
    expect(stamped).toBeInstanceOf(Date);
    expect(Date.now() - (stamped as Date).getTime()).toBeLessThan(60_000);
  });

  it('rejects a wrong password and leaves lastLoginAt alone', async () => {
    const before = await lastLogin(ownerId);
    expect(await verifyCredentials(OWNER_EMAIL, 'not-the-password')).toBeNull();
    expect(await lastLogin(ownerId)).toEqual(before);
  });

  it('still runs a bcrypt comparison, against the dummy hash, for an unknown email', async () => {
    expect(await verifyCredentials('nobody@test.local', OWNER_PASSWORD)).toBeNull();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenLastCalledWith(OWNER_PASSWORD, DUMMY_HASH);
  });

  it('treats an inactive account like an unknown one, even with the right password', async () => {
    const user = await addUser('gone@test.local', 'right-password-1', { active: false });
    expect(await verifyCredentials('gone@test.local', 'right-password-1')).toBeNull();
    expect(verify).toHaveBeenLastCalledWith('right-password-1', DUMMY_HASH);
    expect(await lastLogin(user.id)).toBeNull();
  });

  it('matches the email case-insensitively', async () => {
    const session = await verifyCredentials('OWNER@Test.LOCAL', OWNER_PASSWORD);
    expect(session?.userId).toBe(ownerId);
  });

  it('returns the staff role for staff accounts', async () => {
    await addUser('staff@test.local', 'staff-password-1');
    expect(await verifyCredentials('staff@test.local', 'staff-password-1')).toMatchObject({ email: 'staff@test.local', role: 'staff' });
  });
});

describe('authorizeCredentials (Zod + rate limit)', () => {
  it('rejects malformed input without ever reaching bcrypt', async () => {
    for (const bad of [undefined, null, {}, { email: 'not-an-email', password: 'x' }, { email: OWNER_EMAIL, password: '' }, { email: OWNER_EMAIL }, { email: ['a@b.co'], password: 'x' }, { email: OWNER_EMAIL, password: 'x'.repeat(257) }]) {
      expect(await authorizeCredentials(bad, request('203.0.113.1'))).toBeNull();
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it('accepts surrounding spaces and capitals in the email and returns an Auth.js user', async () => {
    const user = await authorizeCredentials({ email: '  Owner@Test.Local ', password: OWNER_PASSWORD, csrfToken: 'ignored' }, request('203.0.113.2'));
    expect(user).toEqual({ id: String(ownerId), name: 'Owner', email: OWNER_EMAIL });
  });

  it('refuses a blocked email+address pair without a bcrypt comparison, other addresses and emails are unaffected', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 5; i++) loginLimiter.recordFailure(OWNER_EMAIL, ip);

    expect(await authorizeCredentials({ email: OWNER_EMAIL, password: OWNER_PASSWORD }, request(ip))).toBeNull();
    expect(verify).not.toHaveBeenCalled();

    expect(await authorizeCredentials({ email: OWNER_EMAIL, password: OWNER_PASSWORD }, request('203.0.113.8'))).not.toBeNull();
    expect(await authorizeCredentials({ email: 'other@test.local', password: 'whatever' }, request(ip))).toBeNull();
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('counts failures for unknown emails exactly like known ones', async () => {
    const ip = '203.0.113.9';
    for (let i = 0; i < 4; i++) loginLimiter.recordFailure('ghost@test.local', ip);
    expect(loginLimiter.isBlocked('ghost@test.local', ip)).toBe(false);
    expect(await authorizeCredentials({ email: 'ghost@test.local', password: 'guess' }, request(ip))).toBeNull();
    expect(loginLimiter.isBlocked('ghost@test.local', ip)).toBe(true);
  });

  it('clears the counter after a good sign-in', async () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 4; i++) loginLimiter.recordFailure(OWNER_EMAIL, ip);
    expect(await authorizeCredentials({ email: OWNER_EMAIL, password: OWNER_PASSWORD }, request(ip))).not.toBeNull();
    loginLimiter.recordFailure(OWNER_EMAIL, ip);
    expect(loginLimiter.isBlocked(OWNER_EMAIL, ip)).toBe(false);
  });
});

describe('Auth.js pipeline (real @auth/core with the app config, trailing-slash URLs)', () => {
  const origin = 'http://localhost:3000';
  const call = (path: string, init?: RequestInit) => Auth(new Request(`${origin}${path}`, init), authConfig as AuthConfig);
  const cookiePairs = (response: Response) => response.headers.getSetCookie().map((header) => header.split(';')[0]);

  async function signInOverHttp(email: string, password: string, ip: string) {
    const csrf = await call('/api/auth/csrf/');
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    return call('/api/auth/callback/credentials/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookiePairs(csrf).join('; '), 'x-forwarded-for': ip },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: '/admin/' }),
    });
  }

  it('signs in, sets an HttpOnly SameSite=Lax cookie that lasts 12 hours, and reads the session back', async () => {
    const response = await signInOverHttp(OWNER_EMAIL, OWNER_PASSWORD, '203.0.113.20');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${origin}/admin/`);

    const setCookie = response.headers.getSetCookie().find((header) => header.startsWith('authjs.session-token='));
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).not.toMatch(/Secure/i); // plain http locally; __Secure- cookies are used over https
    const expires = Date.parse(/Expires=([^;]+)/i.exec(setCookie as string)?.[1] ?? '');
    const hours = (expires - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThan(12.1);

    const session = await call('/api/auth/session/', { headers: { cookie: (setCookie as string).split(';')[0] } });
    const body = (await session.json()) as { user: { id: string; email: string }; expires: string };
    expect(body.user).toMatchObject({ id: String(ownerId), email: OWNER_EMAIL });
    expect(new Date(body.expires).getTime()).toBeGreaterThan(Date.now());
  });

  it('answers a wrong password and an unknown email identically, and sets no session cookie', async () => {
    const wrongPassword = await signInOverHttp(OWNER_EMAIL, 'nope-nope-nope', '203.0.113.21');
    const unknownEmail = await signInOverHttp('nobody@test.local', 'nope-nope-nope', '203.0.113.21');
    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(`${origin}/admin/login/?error=CredentialsSignin&code=credentials`);
      expect(cookiePairs(response).some((pair) => pair.startsWith('authjs.session-token='))).toBe(false);
    }
  });

  it('applies the rate limit to the HTTP callback too, not only to the form action', async () => {
    const ip = '203.0.113.22';
    for (let i = 0; i < 5; i++) loginLimiter.recordFailure(OWNER_EMAIL, ip);
    verify.mockClear();
    const response = await signInOverHttp(OWNER_EMAIL, OWNER_PASSWORD, ip);
    expect(response.headers.get('location')).toContain('/admin/login/?error=CredentialsSignin');
    expect(cookiePairs(response).some((pair) => pair.startsWith('authjs.session-token='))).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it('ignores a session cookie that has been tampered with', async () => {
    const response = await signInOverHttp(OWNER_EMAIL, OWNER_PASSWORD, '203.0.113.23');
    const pair = cookiePairs(response).find((p) => p.startsWith('authjs.session-token=')) as string;
    const flipped = `${pair.slice(0, -3)}${pair.endsWith('AAA') ? 'BBB' : 'AAA'}`;
    const session = await call('/api/auth/session/', { headers: { cookie: flipped } });
    expect(await session.json()).toBeNull();
  });

  // This is how next-auth's server-side signIn() calls Auth.js (see next-auth/lib/actions.js).
  it('works the way the server action drives it: raw result on success, a thrown CredentialsSignin on failure', async () => {
    const asAction = (email: string, password: string) =>
      Auth(
        new Request(`${origin}/api/auth/callback/credentials?`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.24' },
          body: new URLSearchParams({ email, password, callbackUrl: '/admin/' }),
        }),
        { ...(authConfig as AuthConfig), raw, skipCSRFCheck },
      );

    const ok = (await asAction(OWNER_EMAIL, OWNER_PASSWORD)) as unknown as { redirect: string; cookies: Array<{ name: string; options: Record<string, unknown> }> };
    expect(ok.redirect).toBe(`${origin}/admin/`);
    const sessionCookie = ok.cookies.find((cookie) => cookie.name === 'authjs.session-token');
    expect(sessionCookie?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });

    await expect(asAction(OWNER_EMAIL, 'wrong-wrong-wrong')).rejects.toMatchObject({ type: 'CredentialsSignin' });
  });
});

describe('getSession and requireRole', () => {
  const signedInAs = (id: number | string) => mocks.auth.mockResolvedValue({ user: { id: String(id) }, expires: new Date(Date.now() + 3_600_000).toISOString() });
  const redirectTarget = async (run: () => Promise<unknown>) => {
    const error = await run().then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(mocks.RedirectSignal);
    return (error as InstanceType<typeof mocks.RedirectSignal>).to;
  };

  it('returns the admin read fresh from the database', async () => {
    signedInAs(ownerId);
    expect(await getSession()).toEqual({ userId: ownerId, email: OWNER_EMAIL, name: 'Owner', role: 'owner' });
  });

  it('is null without a cookie session or with a nonsense id', async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
    for (const id of ['', 'abc', '0', '-3', '1.5', '99999999999999999999', '999999']) {
      signedInAs(id);
      expect(await getSession()).toBeNull();
    }
  });

  it('stops honouring a session the moment the account is deactivated', async () => {
    const user = await addUser('leaver@test.local', 'leaver-password-1');
    signedInAs(user.id);
    expect(await getSession()).toMatchObject({ email: 'leaver@test.local' });
    await db.update(s.adminUsers).set({ active: false }).where(eq(s.adminUsers.id, user.id));
    expect(await getSession()).toBeNull();
  });

  it('uses the role in the database, not the one the cookie was issued with', async () => {
    const user = await addUser('promoted@test.local', 'promoted-password-1', { role: 'owner' });
    signedInAs(user.id);
    expect((await getSession())?.role).toBe('owner');
    await db.update(s.adminUsers).set({ role: 'staff' }).where(eq(s.adminUsers.id, user.id));
    expect((await getSession())?.role).toBe('staff');
  });

  it('redirects to the login page, remembering a safe current path', async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(new Headers({ 'x-sfo-admin-path': '/admin/bookings/12/?tab=items' }));
    expect(await redirectTarget(() => requireRole())).toBe('/admin/login/?next=%2Fadmin%2Fbookings%2F12%2F%3Ftab%3Ditems');
  });

  it('does not carry over a missing or unsafe current path', async () => {
    mocks.auth.mockResolvedValue(null);
    for (const value of [null, '//evil.example/admin/', 'https://evil.example/', '/shop/', '/admin/login/']) {
      mocks.headers.mockResolvedValue(value === null ? new Headers() : new Headers({ 'x-sfo-admin-path': value }));
      expect(await redirectTarget(() => requireRole('owner'))).toBe('/admin/login/');
    }
  });

  it('lets staff through for "any" but sends them to the dashboard notice for "owner"', async () => {
    const staff = await addUser('desk@test.local', 'desk-password-1');
    signedInAs(staff.id);
    expect(await requireRole()).toMatchObject({ role: 'staff' });
    expect(await requireRole('staff')).toMatchObject({ role: 'staff' });
    expect(await redirectTarget(() => requireRole('owner'))).toBe('/admin/?notice=owner-only');
  });

  it('lets the owner into owner-only pages', async () => {
    signedInAs(ownerId);
    const session: AdminSession = await requireRole('owner');
    expect(session.role).toBe('owner');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe('signInAction and signOutAction', () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  const credentialsError = () => Object.assign(new Error('CredentialsSignin'), { type: 'CredentialsSignin' });
  const redirectedTo = async (data: FormData) => {
    const error = await signInAction(undefined, data).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(mocks.RedirectSignal);
    return (error as InstanceType<typeof mocks.RedirectSignal>).to;
  };

  it('answers bad input with a message and never calls Auth.js', async () => {
    const badInputs: Array<Record<string, string>> = [{}, { email: 'nope', password: 'x' }, { email: OWNER_EMAIL, password: '' }];
    for (const bad of badInputs) {
      expect(await signInAction(undefined, form(bad))).toEqual({ error: 'Enter your email address and your password.' });
    }
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('gives one generic message for every failed check', async () => {
    mocks.signIn.mockRejectedValue(credentialsError());
    const result = await signInAction(undefined, form({ email: ' Owner@Test.Local ', password: 'wrong-password' }));
    expect(result).toEqual({ error: 'Email or password is wrong' });
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', { email: OWNER_EMAIL, password: 'wrong-password', redirect: false, redirectTo: '/admin/' });
  });

  it('says "Too many attempts" once the pair is blocked, without asking Auth.js', async () => {
    const ip = '198.51.100.30';
    mocks.headers.mockResolvedValue(new Headers({ 'x-forwarded-for': ip }));
    for (let i = 0; i < 5; i++) loginLimiter.recordFailure(OWNER_EMAIL, ip);
    const result = await signInAction(undefined, form({ email: OWNER_EMAIL, password: OWNER_PASSWORD }));
    expect(result?.error).toMatch(/too many attempts/i);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('redirects to the validated next page, or to /admin/', async () => {
    mocks.signIn.mockResolvedValue('http://localhost:3000/admin/');
    const login = { email: OWNER_EMAIL, password: OWNER_PASSWORD };
    expect(await redirectedTo(form({ ...login, next: '/admin/bookings/12/' }))).toBe('/admin/bookings/12/');
    expect(await redirectedTo(form(login))).toBe('/admin/');
    for (const evil of ['//evil.example', 'https://evil.example/admin/', '/\\evil.example', '/shop/', '/admin/../shop/', 'javascript:alert(1)']) {
      expect(await redirectedTo(form({ ...login, next: evil }))).toBe('/admin/');
    }
  });

  it('refuses to treat a response that created no session as success', async () => {
    mocks.signIn.mockResolvedValue('http://localhost:3000/api/auth/callback/credentials?');
    const result = await signInAction(undefined, form({ email: OWNER_EMAIL, password: OWNER_PASSWORD }));
    expect(result?.error).toMatch(/not available/i);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('reports other Auth.js faults generically and lets unrelated errors surface', async () => {
    mocks.signIn.mockRejectedValue(Object.assign(new Error('boom'), { type: 'CallbackRouteError' }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'p4ssw0rd-that-must-never-be-logged';
    expect((await signInAction(undefined, form({ email: OWNER_EMAIL, password: secret })))?.error).toMatch(/not available/i);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    log.mockRestore();

    mocks.signIn.mockRejectedValue(new Error('database is down'));
    await expect(signInAction(undefined, form({ email: OWNER_EMAIL, password: 'x' }))).rejects.toThrow('database is down');
  });

  it('signs out through Auth.js, expires any session cookie itself and returns to the login page', async () => {
    const jar = { has: vi.fn((name: string) => name === 'authjs.session-token'), set: vi.fn() };
    mocks.cookies.mockResolvedValue(jar);
    mocks.signOut.mockResolvedValue(undefined);
    await expect(signOutAction()).rejects.toMatchObject({ to: '/admin/login/' });
    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false, redirectTo: '/admin/login/' });
    expect(jar.set).toHaveBeenCalledTimes(1);
    expect(jar.set).toHaveBeenCalledWith('authjs.session-token', '', expect.objectContaining({ maxAge: 0, httpOnly: true, sameSite: 'lax', secure: false }));
  });
});

describe('notifications route logic', () => {
  const session: AdminSession = { userId: 1, email: OWNER_EMAIL, name: 'Owner', role: 'owner' };
  const post = (body: string, extra: Partial<{ origin: string | null; host: string | null }> = {}, as: AdminSession | null = session) =>
    notificationsPost(as, { bodyText: body, origin: null, host: 'localhost:3000', ...extra });
  type Payload = { unread: number; unreadBookings: number; items: Array<{ id: number; type: string; title: string; read: boolean; link: string | null; createdAt: string }> };

  let ids: { bookingA: number; bookingB: number; handoff: number };

  beforeEach(async () => {
    await db.delete(s.notifications);
    ids = {
      bookingA: await createNotification({ type: 'booking', title: 'Booking A', link: '/admin/bookings/1/' }),
      bookingB: await createNotification({ type: 'booking', title: 'Booking B', link: '/admin/bookings/2/' }),
      handoff: await createNotification({ type: 'handoff', title: 'Talk to a person', body: 'Wants a call back' }),
    };
  });

  it('counts only unread booking notifications for the sidebar badge', async () => {
    expect(await unreadBookingsCount()).toBe(2);
    await post(JSON.stringify({ ids: [ids.bookingA] }));
    expect(await unreadBookingsCount()).toBe(1);
  });

  it('GET returns the counts and the latest items, newest first, 401 without a session', async () => {
    expect(await notificationsGet(null)).toMatchObject({ status: 401 });
    const { status, body } = await notificationsGet(session);
    const payload = body as Payload;
    expect(status).toBe(200);
    expect(payload).toMatchObject({ unread: 3, unreadBookings: 2 });
    expect(payload.items.map((item) => item.title)).toEqual(['Talk to a person', 'Booking B', 'Booking A']);
    expect(payload.items[1]).toMatchObject({ id: ids.bookingB, type: 'booking', read: false, link: '/admin/bookings/2/' });
    expect(Number.isNaN(Date.parse(payload.items[0].createdAt))).toBe(false);
  });

  it('marks the given ids read and answers with fresh counts', async () => {
    const { status, body } = await post(JSON.stringify({ ids: [ids.bookingA, ids.handoff] }));
    expect(status).toBe(200);
    expect(body).toMatchObject({ unread: 1, unreadBookings: 1 });
    expect((body as Payload).items.filter((item) => item.read).map((item) => item.title).sort()).toEqual(['Booking A', 'Talk to a person']);
  });

  it('marks everything read when no ids are sent (empty body or {})', async () => {
    expect((await post('{}')).body).toMatchObject({ unread: 0, unreadBookings: 0 });
    await createNotification({ type: 'system', title: 'Another' });
    expect((await post('')).body).toMatchObject({ unread: 0 });
  });

  it('treats an empty ids list as "nothing", not as "everything"', async () => {
    const { status, body } = await post(JSON.stringify({ ids: [] }));
    expect(status).toBe(200);
    expect(body).toMatchObject({ unread: 3 });
  });

  it('ignores ids that do not exist', async () => {
    expect((await post(JSON.stringify({ ids: [987654] }))).body).toMatchObject({ unread: 3 });
  });

  it('rejects invalid bodies with 400 and changes nothing', async () => {
    for (const bad of ['{"ids":"1"}', '{"ids":[0]}', '{"ids":[-1]}', '{"ids":[1.5]}', '{"ids":[2147483648]}', '{"ids":["1"]}', '{"ids":[null]}', `{"ids":[${Array.from({ length: 101 }, (_, i) => i + 1).join(',')}]}`, '[]', 'null', '"all"', '42', '{oops']) {
      expect(await post(bad), bad).toMatchObject({ status: 400 });
    }
    expect((await notificationsGet(session)).body).toMatchObject({ unread: 3 });
  });

  it('rejects an oversized body with 413', async () => {
    expect(await post(JSON.stringify({ ids: [1], padding: 'x'.repeat(6000) }))).toMatchObject({ status: 413 });
  });

  it('requires a session to mark anything read', async () => {
    expect(await post('{}', {}, null)).toMatchObject({ status: 401 });
    expect((await notificationsGet(session)).body).toMatchObject({ unread: 3 });
  });

  it('refuses a POST that comes from another site', async () => {
    expect(await post('{}', { origin: 'https://evil.example' })).toMatchObject({ status: 403 });
    expect(await post('{}', { origin: 'null' })).toMatchObject({ status: 403 });
    expect(await post('{}', { origin: 'http://localhost:3000', host: 'localhost:3000' })).toMatchObject({ status: 200 });
  });
});
