import { describe, expect, it } from 'vitest';
import { BLOB_IMAGE_ORIGIN, buildContentSecurityPolicy, MAP_ORIGINS, TURNSTILE_ORIGIN } from '@/lib/security/csp';

function directive(policy: string, name: string): string[] {
  const found = policy.split('; ').find((part) => part === name || part.startsWith(`${name} `));
  return found ? found.split(' ').slice(1) : [];
}

describe('buildContentSecurityPolicy', () => {
  const policy = buildContentSecurityPolicy({ upgradeInsecure: false });

  it('is one line of "; "-separated directives with no empty parts', () => {
    expect(policy).not.toMatch(/[\r\n]/);
    expect(policy.split('; ').every((part) => part.trim().length > 0)).toBe(true);
    expect(policy.endsWith(';')).toBe(false);
  });

  it('closes down everything that is not needed', () => {
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
    expect(directive(policy, 'frame-ancestors')).toEqual(["'self'"]);
  });

  it('never allows eval or wildcard sources for scripts', () => {
    const scripts = directive(policy, 'script-src');
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toContain('*');
    expect(scripts).not.toContain('https:');
    expect(scripts).toContain("'self'");
  });

  it('lets Turnstile load its script, frame and connection', () => {
    expect(directive(policy, 'script-src')).toContain(TURNSTILE_ORIGIN);
    expect(directive(policy, 'frame-src')).toContain(TURNSTILE_ORIGIN);
    expect(directive(policy, 'connect-src')).toContain(TURNSTILE_ORIGIN);
  });

  it('lets the Google Maps embeds load, and only as frames', () => {
    for (const origin of MAP_ORIGINS) {
      expect(directive(policy, 'frame-src')).toContain(origin);
      expect(directive(policy, 'script-src')).not.toContain(origin);
      expect(directive(policy, 'connect-src')).not.toContain(origin);
    }
  });

  it('allows same-origin frames (invoice print preview) and Vercel Blob images', () => {
    expect(directive(policy, 'frame-src')).toContain("'self'");
    expect(directive(policy, 'img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:', BLOB_IMAGE_ORIGIN]));
  });

  it('lets WebGL create blob workers and textures', () => {
    expect(directive(policy, 'worker-src')).toEqual(expect.arrayContaining(["'self'", 'blob:']));
  });

  it('adds upgrade-insecure-requests only when asked', () => {
    expect(policy).not.toContain('upgrade-insecure-requests');
    const https = buildContentSecurityPolicy({ upgradeInsecure: true });
    expect(https.split('; ')).toContain('upgrade-insecure-requests');
    expect(https.startsWith(policy)).toBe(true);
  });
});
