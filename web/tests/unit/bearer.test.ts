import { describe, expect, it } from 'vitest';
import { bearerMatches, isUsableSecret } from '@/lib/security/bearer';

const req = (authorization?: string) => new Request('http://x.test/', { headers: authorization ? { authorization } : {} });

describe('bearerMatches', () => {
  const secret = 's'.repeat(24);
  it('accepts only the exact bearer secret', () => {
    expect(bearerMatches(req(`Bearer ${secret}`), secret)).toBe(true);
    expect(bearerMatches(req(`Bearer ${secret}x`), secret)).toBe(false);
    expect(bearerMatches(req(secret), secret)).toBe(false);
    expect(bearerMatches(req(), secret)).toBe(false);
  });
  it('never authorises with a missing, short or example secret', () => {
    for (const bad of [undefined, '', 'short', 'replace-with-a-random-string']) {
      expect(isUsableSecret(bad)).toBe(false);
      expect(bearerMatches(req(`Bearer ${bad ?? ''}`), bad)).toBe(false);
    }
  });
});
