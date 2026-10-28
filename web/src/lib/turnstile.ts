import 'server-only';

import { z } from 'zod';
import { env } from '@/lib/env';

// Cloudflare Turnstile verification for public forms. Server only: the secret
// key must never reach the browser (only TURNSTILE_SITE_KEY is public).

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8000;
const MAX_TOKEN_LENGTH = 2048;

export type TurnstileVerdict =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: 'missing' | 'rejected' | 'unavailable' };

const responseSchema = z.object({ success: z.boolean(), 'error-codes': z.array(z.string()).optional() });

/**
 * Local mode: no secret and no remote database, so the check is skipped.
 * With a remote database but no secret the check is NOT skipped (the site is
 * live and must not accept unverified submissions); it fails closed instead.
 */
export const isTurnstileSkipped = (): boolean => !env.TURNSTILE_SECRET_KEY && !env.DATABASE_URL;

/**
 * Verifies the token the widget produced. Fails closed: a missing token, a
 * rejected token, a network error or an unreadable answer all return
 * `{ ok: false }`. Never throws.
 */
export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string | null): Promise<TurnstileVerdict> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (isTurnstileSkipped()) return { ok: true, skipped: true };
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not set while DATABASE_URL is: refusing submissions until it is configured.');
    return { ok: false, reason: 'unavailable' };
  }

  const response = (token ?? '').trim();
  if (!response) return { ok: false, reason: 'missing' };
  if (response.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'rejected' };

  try {
    const body = new URLSearchParams({ secret, response });
    if (remoteIp) body.set('remoteip', remoteIp);
    const answer = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!answer.ok) {
      console.error(`[turnstile] siteverify answered HTTP ${answer.status}`);
      return { ok: false, reason: 'unavailable' };
    }
    const parsed = responseSchema.safeParse(await answer.json());
    if (!parsed.success) {
      console.error('[turnstile] siteverify sent an unexpected answer');
      return { ok: false, reason: 'unavailable' };
    }
    return parsed.data.success ? { ok: true, skipped: false } : { ok: false, reason: 'rejected' };
  } catch (error) {
    console.error('[turnstile] siteverify request failed:', error);
    return { ok: false, reason: 'unavailable' };
  }
}
