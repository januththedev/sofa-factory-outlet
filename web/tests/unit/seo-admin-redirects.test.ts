import { describe, expect, it } from 'vitest';
import { type ExistingRedirect, validateRedirect } from '@/lib/admin/seo';

const moved = (id: number, from: string, to: string): ExistingRedirect => ({ id, from, to, status: 301 });
const gone = (id: number, from: string): ExistingRedirect => ({ id, from, to: null, status: 410 });

describe('redirect validation: what staff type', () => {
  it('accepts a 301 and stores both addresses with a trailing slash', () => {
    expect(validateRedirect({ from: '/old-page', to: '/new-page', status: 301 }, [])).toEqual({
      ok: true,
      value: { from: '/old-page/', to: '/new-page/', status: 301 },
    });
  });

  it('trims what was typed and keeps a query string on the new address', () => {
    const result = validateRedirect({ from: '  /old/  ', to: ' /shop?colour=red ', status: 301 }, []);
    expect(result).toEqual({ ok: true, value: { from: '/old/', to: '/shop/?colour=red', status: 301 } });
  });

  it('accepts a 410 and ignores whatever was typed as the new address', () => {
    expect(validateRedirect({ from: '/discontinued/', to: 'not even a path', status: 410 }, [])).toEqual({
      ok: true,
      value: { from: '/discontinued/', to: null, status: 410 },
    });
    expect(validateRedirect({ from: '/discontinued/', status: 410 }, [])).toMatchObject({ ok: true });
  });

  it('requires a destination for a 301', () => {
    for (const to of [undefined, null, '', '   ']) {
      const result = validateRedirect({ from: '/old/', to, status: 301 }, []);
      expect(result).toMatchObject({ ok: false, errors: { to: expect.stringContaining('Enter the page') } });
    }
  });

  it('only allows 301 and 410', () => {
    for (const status of [302, 200, 0, Number.NaN]) {
      expect(validateRedirect({ from: '/old/', to: '/new/', status }, [])).toMatchObject({
        ok: false,
        errors: { status: expect.any(String) },
      });
    }
  });
});

describe('redirect validation: bad sources', () => {
  const bad = (from: string) => validateRedirect({ from, to: '/new/', status: 301 }, []);

  it('must start with a slash', () => {
    expect(bad('old-page')).toMatchObject({ ok: false, errors: { from: expect.stringContaining('starts with /') } });
    expect(bad('')).toMatchObject({ ok: false, errors: { from: expect.any(String) } });
    expect(bad('https://example.com/old/')).toMatchObject({ ok: false, errors: { from: expect.any(String) } });
  });

  it('cannot be another site written without a scheme', () => {
    expect(bad('//example.com/old/')).toMatchObject({ ok: false, errors: { from: expect.any(String) } });
  });

  it('cannot hold spaces, a query string or a fragment', () => {
    expect(bad('/old page/')).toMatchObject({ ok: false, errors: { from: expect.stringContaining('cannot contain') } });
    expect(bad('/old/?a=1')).toMatchObject({ ok: false, errors: { from: expect.stringContaining('cannot contain') } });
    expect(bad('/old/#top')).toMatchObject({ ok: false, errors: { from: expect.stringContaining('cannot contain') } });
  });

  it('cannot be the home page or an admin or system address', () => {
    expect(bad('/')).toMatchObject({ ok: false, errors: { from: expect.stringContaining('home page') } });
    for (const from of ['/admin', '/admin/seo/', '/api/health/', '/_next/static/x']) {
      expect(bad(from)).toMatchObject({ ok: false, errors: { from: expect.stringContaining('cannot be redirected') } });
    }
  });

  it('cannot be absurdly long', () => {
    expect(bad(`/${'a'.repeat(600)}/`)).toMatchObject({
      ok: false,
      errors: { from: expect.stringContaining('under') },
    });
  });

  it('reports a problem with each field at once', () => {
    const result = validateRedirect({ from: 'nope', to: 'also-nope', status: 301 }, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['from', 'to']);
    const wrongStatus = validateRedirect({ from: 'nope', to: '/new/', status: 302 }, []);
    if (!wrongStatus.ok) expect(Object.keys(wrongStatus.errors).sort()).toEqual(['from', 'status']);
  });
});

describe('redirect validation: bad destinations', () => {
  const bad = (to: string) => validateRedirect({ from: '/old/', to, status: 301 }, []);

  it('must be a path on this site', () => {
    for (const to of ['new', 'https://example.com/new/', '//example.com/new/', 'mailto:a@b.c']) {
      expect(bad(to)).toMatchObject({ ok: false, errors: { to: expect.stringContaining('starts with /') } });
    }
  });

  it('cannot hold spaces', () => {
    expect(bad('/new page/')).toMatchObject({ ok: false, errors: { to: expect.stringContaining('spaces') } });
  });

  it('cannot send a page to itself, with or without a query string', () => {
    for (const to of ['/old/', '/old', '/old/?a=1', '/old#top']) {
      expect(bad(to)).toMatchObject({ ok: false, errors: { to: expect.stringContaining('itself') } });
    }
  });
});

describe('redirect validation: loops and chains', () => {
  it('rejects a duplicate source, however it is written', () => {
    const existing = [moved(1, '/old/', '/a/')];
    for (const from of ['/old/', '/old']) {
      expect(validateRedirect({ from, to: '/b/', status: 301 }, existing)).toMatchObject({
        ok: false,
        errors: { from: expect.stringContaining('already exists') },
      });
    }
  });

  it('rejects a destination that is itself redirected, so there are no chains', () => {
    const existing = [moved(1, '/b/', '/c/')];
    const result = validateRedirect({ from: '/a/', to: '/b/', status: 301 }, existing);
    expect(result).toMatchObject({ ok: false, errors: { to: expect.stringContaining('/c/') } });
    expect(validateRedirect({ from: '/a/', to: '/b', status: 301 }, existing)).toMatchObject({ ok: false });
  });

  it('rejects a destination that has been removed', () => {
    const result = validateRedirect({ from: '/a/', to: '/gone/', status: 301 }, [gone(1, '/gone/')]);
    expect(result).toMatchObject({ ok: false, errors: { to: expect.stringContaining('removed') } });
  });

  it('rejects a source that is already the destination of another redirect, so there are no chains', () => {
    const existing = [moved(1, '/a/', '/b/')];
    const result = validateRedirect({ from: '/b/', to: '/c/', status: 301 }, existing);
    expect(result).toMatchObject({
      ok: false,
      errors: { from: expect.stringContaining('/a/ already redirects here') },
    });
  });

  it('does not let a redirect point at a page that is then removed', () => {
    const existing = [moved(1, '/a/', '/b/')];
    expect(validateRedirect({ from: '/b/', status: 410 }, existing)).toMatchObject({
      ok: false,
      errors: { from: expect.stringContaining('already redirects here') },
    });
  });

  it('rejects a loop from both ends', () => {
    const existing = [moved(1, '/a/', '/b/')];
    const result = validateRedirect({ from: '/b/', to: '/a/', status: 301 }, existing);
    expect(result).toMatchObject({ ok: false, errors: { from: expect.any(String), to: expect.any(String) } });
  });

  it('compares the path of a destination, not its query string', () => {
    const existing = [moved(1, '/a/', '/b/?colour=red')];
    expect(validateRedirect({ from: '/b/', to: '/c/', status: 301 }, existing)).toMatchObject({
      ok: false,
      errors: { from: expect.stringContaining('already redirects here') },
    });
  });

  it('allows several old addresses to share one destination', () => {
    const existing = [moved(1, '/a/', '/shop/'), moved(2, '/b/', '/shop/')];
    expect(validateRedirect({ from: '/c/', to: '/shop/', status: 301 }, existing)).toMatchObject({ ok: true });
  });

  it('leaves out the redirect being edited, so a redirect can be saved unchanged or re-pointed', () => {
    const existing = [moved(1, '/a/', '/b/'), moved(2, '/x/', '/y/')];
    expect(validateRedirect({ from: '/a/', to: '/b/', status: 301 }, existing, 1)).toMatchObject({ ok: true });
    expect(validateRedirect({ from: '/a/', to: '/c/', status: 301 }, existing, 1)).toMatchObject({ ok: true });
    expect(validateRedirect({ from: '/a/', status: 410 }, existing, 1)).toMatchObject({ ok: true });
  });

  it('still checks an edit against all the other redirects', () => {
    const existing = [moved(1, '/a/', '/b/'), moved(2, '/x/', '/y/')];
    expect(validateRedirect({ from: '/a/', to: '/x/', status: 301 }, existing, 1)).toMatchObject({
      ok: false,
      errors: { to: expect.stringContaining('/y/') },
    });
    expect(validateRedirect({ from: '/x/', to: '/b/', status: 301 }, existing, 1)).toMatchObject({
      ok: false,
      errors: { from: expect.stringContaining('already exists') },
    });
    expect(validateRedirect({ from: '/a/', to: '/a/', status: 301 }, existing, 1)).toMatchObject({
      ok: false,
      errors: { to: expect.stringContaining('itself') },
    });
  });
});
