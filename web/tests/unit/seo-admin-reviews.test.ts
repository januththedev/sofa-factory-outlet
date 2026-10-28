import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { reviewStatus } from '@/lib/admin/reviews';
import { createReviewLink, REVIEW_LINK_DAYS, reviewSecret, verifyReviewToken } from '@/lib/seo/reviews';

const secrets = { AUTH_SECRET: 'test-auth-secret-with-enough-length-0123456789' };
const DAY_MS = 86_400_000;

const tokenOf = (link: string): string => link.replace(/^\/review\//, '').replace(/\/$/, '');
const decodePayload = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

/** Flips one character in the chosen part (0 header, 1 payload, 2 signature). */
function tamper(token: string, part: 0 | 1 | 2): string {
  const parts = token.split('.');
  const value = parts[part];
  const middle = Math.floor(value.length / 2);
  parts[part] = `${value.slice(0, middle)}${value[middle] === 'A' ? 'B' : 'A'}${value.slice(middle + 1)}`;
  return parts.join('.');
}

describe('the secret that signs review links', () => {
  it('uses AUTH_SECRET, and CRON_SECRET when there is none', () => {
    const decode = (key: Uint8Array) => new TextDecoder().decode(key);
    expect(decode(reviewSecret({ AUTH_SECRET: 'auth', CRON_SECRET: 'cron' }))).toBe('auth');
    expect(decode(reviewSecret({ CRON_SECRET: 'cron' }))).toBe('cron');
    expect(decode(reviewSecret({ AUTH_SECRET: '  ', CRON_SECRET: 'cron' }))).toBe('cron');
  });

  it('stops with a clear message when neither is set', () => {
    expect(() => reviewSecret({})).toThrow('Review links need AUTH_SECRET or CRON_SECRET to be set.');
    expect(() => reviewSecret({ AUTH_SECRET: '', CRON_SECRET: ' ' })).toThrow('AUTH_SECRET or CRON_SECRET');
  });
});

describe('creating a review link', () => {
  it('returns /review/<token>/ with the ids inside, valid for 60 days', async () => {
    const now = new Date('2026-10-28T09:00:00Z');
    const link = await createReviewLink({ bookingId: 12, productId: 34 }, { secrets, now });
    expect(link).toMatch(/^\/review\/[\w-]+\.[\w-]+\.[\w-]+\/$/);
    const payload = decodePayload(tokenOf(link));
    expect(payload).toMatchObject({ bookingId: 12, productId: 34 });
    expect(payload).not.toHaveProperty('invoiceId');
    expect(payload.exp).toBe(Number(payload.iat) + REVIEW_LINK_DAYS * 86_400);
    expect(REVIEW_LINK_DAYS).toBe(60);
  });

  it('can carry an invoice instead of a booking, or both', async () => {
    const invoiceOnly = decodePayload(tokenOf(await createReviewLink({ invoiceId: 5, productId: 9 }, { secrets })));
    expect(invoiceOnly).toMatchObject({ invoiceId: 5, productId: 9 });
    const link = await createReviewLink({ bookingId: 1, invoiceId: 2, productId: 3 }, { secrets });
    const both = decodePayload(tokenOf(link));
    expect(both).toMatchObject({ bookingId: 1, invoiceId: 2, productId: 3 });
  });

  it('needs a booking or an invoice, and sensible ids', async () => {
    await expect(createReviewLink({ productId: 3 }, { secrets })).rejects.toThrow('needs a booking or an invoice');
    await expect(createReviewLink({ bookingId: 0, productId: 3 }, { secrets })).rejects.toThrow();
    await expect(createReviewLink({ bookingId: 1.5, productId: 3 }, { secrets })).rejects.toThrow();
    await expect(createReviewLink({ bookingId: 1, productId: -3 }, { secrets })).rejects.toThrow();
  });

  it('refuses to create a link when there is no secret to sign it with', async () => {
    await expect(createReviewLink({ bookingId: 1, productId: 2 }, { secrets: {} })).rejects.toThrow(
      'Review links need AUTH_SECRET or CRON_SECRET to be set.',
    );
  });
});

describe('checking a review link', () => {
  it('gives back the ids it was made with', async () => {
    const link = await createReviewLink({ bookingId: 12, invoiceId: 7, productId: 34 }, { secrets });
    expect(await verifyReviewToken(tokenOf(link), { secrets })).toEqual({
      ok: true,
      claims: { bookingId: 12, invoiceId: 7, productId: 34 },
    });
  });

  it('is still valid on day 59 and expired after day 60', async () => {
    const made = new Date('2026-10-28T09:00:00Z');
    const token = tokenOf(await createReviewLink({ bookingId: 1, productId: 2 }, { secrets, now: made }));
    const at = (days: number) => ({ secrets, now: new Date(made.getTime() + days * DAY_MS) });
    expect((await verifyReviewToken(token, at(59))).ok).toBe(true);
    expect(await verifyReviewToken(token, at(61))).toEqual({ ok: false, reason: 'expired' });
  });

  it('calls a link made long ago expired', async () => {
    const old = new Date(Date.now() - 90 * DAY_MS);
    const token = tokenOf(await createReviewLink({ bookingId: 1, productId: 2 }, { secrets, now: old }));
    expect(await verifyReviewToken(token, { secrets })).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a link that was changed', async () => {
    const token = tokenOf(await createReviewLink({ bookingId: 1, productId: 2 }, { secrets }));
    for (const part of [0, 1, 2] as const) {
      expect(await verifyReviewToken(tamper(token, part), { secrets })).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('rejects a link signed with another secret', async () => {
    const token = tokenOf(await createReviewLink({ bookingId: 1, productId: 2 }, { secrets }));
    const other = { AUTH_SECRET: 'a-completely-different-secret-9876543210' };
    expect(await verifyReviewToken(token, { secrets: other })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a token that was not made for reviews, even when the secret is right', async () => {
    const key = reviewSecret(secrets);
    const sign = (payload: Record<string, unknown>, audience?: string) => {
      const jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h');
      return (audience ? jwt.setAudience(audience) : jwt).sign(key);
    };
    const token = await sign({ bookingId: 1, productId: 2 });
    expect(await verifyReviewToken(token, { secrets })).toMatchObject({ ok: false });
    expect(
      await verifyReviewToken(await sign({ bookingId: 1, productId: 2 }, 'something-else'), { secrets }),
    ).toMatchObject({ ok: false });
    const noExpiry = await new SignJWT({ bookingId: 1, productId: 2 })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('sofa-factory-outlet:review')
      .sign(key);
    expect(await verifyReviewToken(noExpiry, { secrets })).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('rejects a genuine token that names no booking or invoice', async () => {
    const key = reviewSecret(secrets);
    const token = await new SignJWT({ productId: 2 })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('sofa-factory-outlet:review')
      .setExpirationTime('1h')
      .sign(key);
    expect(await verifyReviewToken(token, { secrets })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects an unsigned token', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = { bookingId: 1, productId: 2, aud: 'sofa-factory-outlet:review' };
    const unsigned = `${encode({ alg: 'none' })}.${encode(claims)}.`;
    expect(await verifyReviewToken(unsigned, { secrets })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects rubbish without throwing', async () => {
    for (const token of ['', 'abc', 'a.b.c', '....', `${'x'.repeat(3000)}`, ' ']) {
      expect(await verifyReviewToken(token, { secrets })).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('calls every link invalid, rather than failing, when no secret is set', async () => {
    const token = tokenOf(await createReviewLink({ bookingId: 1, productId: 2 }, { secrets }));
    expect(await verifyReviewToken(token, { secrets: {} })).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('what the team has decided about a review', () => {
  it('reads the state from approved and the decision time', () => {
    expect(reviewStatus({ approved: true, approvedAt: new Date() })).toBe('approved');
    expect(reviewStatus({ approved: true, approvedAt: null })).toBe('approved');
    expect(reviewStatus({ approved: false, approvedAt: null })).toBe('pending');
    expect(reviewStatus({ approved: false, approvedAt: new Date() })).toBe('rejected');
    expect(reviewStatus({ approved: false, approvedAt: '2026-10-28T00:00:00.000Z' })).toBe('rejected');
  });
});
