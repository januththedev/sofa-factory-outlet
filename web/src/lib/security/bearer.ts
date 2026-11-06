import { createHash, timingSafeEqual } from 'node:crypto';

/** A secret that is missing, short or still the `.env.example` placeholder never authorises anything. */
export function isUsableSecret(secret: string | undefined | null): secret is string {
  const value = secret?.trim() ?? '';
  return value.length >= 16 && !/^replace/i.test(value);
}

/**
 * `Authorization: Bearer <secret>` check in constant time (both sides hashed first, so the
 * comparison does not leak the secret's length either).
 */
export function bearerMatches(request: Request, secret: string | undefined | null): boolean {
  if (!isUsableSecret(secret)) return false;
  const header = request.headers.get('authorization') ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret.trim()}`));
}
