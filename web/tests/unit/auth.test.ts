import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { resolveAuthSecret } from '@/lib/auth/config';
import { adminGate } from '@/lib/auth/gate';
import { DUMMY_HASH, hashPassword, verifyPassword } from '@/lib/auth/password';
import { hasSessionCookie, isAdminPath, isLoginPath, loginUrl, normalisePath, PATH_HEADER, safeAdminPath, sanitiseNext } from '@/lib/auth/paths';
import { clientIp, createFailureLimiter, createLoginLimiter, FAILURE_WINDOW_MS } from '@/lib/auth/rate-limit';

describe('password hashing', () => {
  it('hashes with bcrypt cost 12 and verifies only the right password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse battery!', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('fails the check, rather than throwing, on a malformed or empty hash', async () => {
    for (const bad of ['', 'garbage', '$2b$12$tooshort', DUMMY_HASH.slice(0, 47)]) {
      expect(await verifyPassword('anything', bad)).toBe(false);
    }
  });

  it('keeps the dummy hash a full 60-character bcrypt hash, so an unknown email costs a real comparison', async () => {
    expect(DUMMY_HASH).toHaveLength(60);
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    // bcryptjs rejects a wrongly sized hash instantly; a real cost-12 comparison takes far longer than this.
    const started = performance.now();
    expect(await verifyPassword('anything', DUMMY_HASH)).toBe(false);
    expect(performance.now() - started).toBeGreaterThan(20);
  });
});

describe('next-URL sanitising', () => {
  it.each([
    ['/admin/', '/admin/'],
    ['/admin', '/admin/'],
    ['/admin/bookings/12/', '/admin/bookings/12/'],
    ['/admin/bookings/?status=new&page=2', '/admin/bookings/?status=new&page=2'],
    ['/admin/products/?q=https://example.com/x', '/admin/products/?q=https://example.com/x'],
    ['  /admin/seo/  ', '/admin/seo/'],
    ['/admin/a/./b/', '/admin/a/b/'],
    ['/admin/products/#frag', '/admin/products/'],
  ])('keeps %j as %j', (input, expected) => {
    expect(safeAdminPath(input)).toBe(expected);
    expect(sanitiseNext(input)).toBe(expected);
  });

  it.each([
    ['//evil.com'],
    ['//evil.com/admin/'],
    ['///evil.com'],
    ['https://evil.com'],
    ['https://evil.com/admin/'],
    ['http://localhost:3000/admin/'],
    ['javascript:alert(1)'],
    ['data:text/html,<script>1</script>'],
    ['/\\evil.com'],
    ['/admin/\\evil.com'],
    ['\\\\evil.com'],
    ['/shop/'],
    ['/'],
    ['/administrator/'],
    ['/adminx'],
    ['/ADMIN/products/'],
    ['/admin/../shop/'],
    ['/admin/%2e%2e/shop/'],
    ['/admin/..%2fshop/'],
    ['/admin/%2fevil.com'],
    ['/admin/%5cevil.com'],
    ['/admin/login/'],
    ['/admin/login'],
    ['/admin/\nSet-Cookie: a=b'],
    ['/admin/\u0000'],
    ['/admin/' + 'a'.repeat(1100)],
    [''],
    ['   '],
    ['admin/products/'],
    [undefined],
    [null],
    [42],
    [['/admin/']],
    [{ toString: () => '/admin/' }],
  ])('rejects %j', (input) => {
    expect(safeAdminPath(input)).toBeNull();
    expect(sanitiseNext(input)).toBe('/admin/');
  });

  it('builds the login URL with the encoded page to come back to, only when it is safe', () => {
    expect(loginUrl('/admin/bookings/12/?tab=items')).toBe('/admin/login/?next=%2Fadmin%2Fbookings%2F12%2F%3Ftab%3Ditems');
    expect(loginUrl('//evil.com')).toBe('/admin/login/');
    expect(loginUrl(null)).toBe('/admin/login/');
    expect(loginUrl(undefined)).toBe('/admin/login/');
  });
});

describe('admin path helpers', () => {
  it('knows what is under /admin, tolerating encoding, case and slashes', () => {
    for (const path of ['/admin', '/admin/', '/admin/products/', '/ADMIN/x/', '/%61dmin/products/', '/admin//products/', '/admin\\products']) {
      expect(isAdminPath(path), path).toBe(true);
    }
    for (const path of ['/', '/shop/', '/administrator/', '/adminx', '/api/admin/notifications/', '/about/admin/']) {
      expect(isAdminPath(path), path).toBe(false);
    }
  });

  it('recognises only the login page itself', () => {
    expect(isLoginPath('/admin/login')).toBe(true);
    expect(isLoginPath('/admin/login/')).toBe(true);
    expect(isLoginPath('/admin/Login/')).toBe(true);
    expect(isLoginPath('/admin/login/extra/')).toBe(false);
    expect(isLoginPath('/admin/login-help/')).toBe(false);
    expect(isLoginPath('/admin/login/../products/')).toBe(false);
  });

  it('survives a malformed escape sequence', () => {
    expect(normalisePath('/admin/%E0%A4%A')).toBe('/admin/%e0%a4%a');
    expect(isAdminPath('/admin/%E0%A4%A')).toBe(true);
  });

  it('finds the session cookie under either name, and not when empty', () => {
    const read = (jar: Record<string, string>) => (name: string) => jar[name];
    expect(hasSessionCookie(read({ 'authjs.session-token': 'abc' }))).toBe(true);
    expect(hasSessionCookie(read({ '__Secure-authjs.session-token': 'abc' }))).toBe(true);
    expect(hasSessionCookie(read({ 'authjs.session-token.0': 'chunk' }))).toBe(true);
    expect(hasSessionCookie(read({ 'authjs.session-token': '' }))).toBe(false);
    expect(hasSessionCookie(read({ 'authjs.csrf-token': 'abc', theme: 'dark' }))).toBe(false);
    expect(hasSessionCookie(read({}))).toBe(false);
  });
});

describe('adminGate', () => {
  const at = (path: string, init: { cookie?: string; method?: string; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...init.headers };
    if (init.cookie) headers.cookie = init.cookie;
    return new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? 'GET', headers });
  };
  const SESSION = 'authjs.session-token=abc123';

  it('redirects to the login page, remembering where the visitor was going, when there is no session cookie', () => {
    const response = adminGate(at('/admin/products/?page=2'));
    expect(response?.status).toBe(307);
    const location = new URL(response?.headers.get('location') ?? '');
    expect(location.origin).toBe('http://localhost:3000');
    expect(location.pathname).toBe('/admin/login/');
    expect(location.searchParams.get('next')).toBe('/admin/products/?page=2');
    expect(response?.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('treats the bare /admin and /admin/ as the dashboard', () => {
    for (const path of ['/admin', '/admin/']) {
      const location = new URL(adminGate(at(path))?.headers.get('location') ?? '');
      expect(location.pathname).toBe('/admin/login/');
      expect(location.searchParams.get('next')).toBe('/admin/');
    }
  });

  it("drops Next's own _rsc parameter from the page to come back to", () => {
    const location = new URL(adminGate(at('/admin/seo/?_rsc=1abcd&tab=2'))?.headers.get('location') ?? '');
    expect(location.searchParams.get('next')).toBe('/admin/seo/?tab=2');
    const bare = new URL(adminGate(at('/admin/seo/?_rsc=1abcd'))?.headers.get('location') ?? '');
    expect(bare.searchParams.get('next')).toBe('/admin/seo/');
  });

  it('does not count an empty or unrelated cookie as a session', () => {
    for (const cookie of ['authjs.session-token=', 'authjs.csrf-token=abc; theme=dark', 'session=abc']) {
      expect(adminGate(at('/admin/seo/', { cookie }))?.status, cookie).toBe(307);
    }
  });

  it('lets a request with a session cookie continue, marked noindex, and tells the page which URL was asked for', () => {
    for (const cookie of [SESSION, '__Secure-authjs.session-token=abc123', `theme=dark; ${SESSION}`]) {
      const response = adminGate(at('/admin/bookings/12/?tab=items', { cookie }));
      expect(response, cookie).toBeDefined();
      expect(response?.headers.get('location')).toBeNull();
      expect(response?.headers.get('x-middleware-next')).toBe('1');
      expect(response?.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(response?.headers.get(`x-middleware-request-${PATH_HEADER}`)).toBe('/admin/bookings/12/?tab=items');
    }
  });

  it('does not let a client choose the forwarded path', () => {
    const response = adminGate(at('/admin/seo/', { cookie: SESSION, headers: { [PATH_HEADER]: '/admin/forged/' } }));
    expect(response?.headers.get(`x-middleware-request-${PATH_HEADER}`)).toBe('/admin/seo/');
  });

  it('never touches the login page, signed in or not', () => {
    for (const path of ['/admin/login', '/admin/login/', '/admin/login/?next=%2Fadmin%2Fseo%2F']) {
      expect(adminGate(at(path)), path).toBeUndefined();
      expect(adminGate(at(path, { cookie: SESSION })), path).toBeUndefined();
    }
  });

  it('ignores everything that is not under /admin', () => {
    for (const path of ['/', '/shop/', '/product/some-sofa/', '/administrator/', '/adminx/', '/api/admin/notifications/', '/api/auth/session/', '/about/admin/']) {
      expect(adminGate(at(path)), path).toBeUndefined();
    }
  });

  it('is not fooled by encoding or letter case in the path', () => {
    const encoded = adminGate(at('/%61dmin/products/'));
    expect(encoded?.status).toBe(307);
    expect(new URL(encoded?.headers.get('location') ?? '').searchParams.has('next')).toBe(false);
    expect(adminGate(at('/ADMIN/products/'))?.status).toBe(307);
    expect(adminGate(at('/admin//products/'))?.status).toBe(307);
  });

  it('sends a form POST to the login page with 303 so it arrives as a GET', () => {
    expect(adminGate(at('/admin/products/', { method: 'POST' }))?.status).toBe(303);
  });

  it('lets a server action through even without a cookie, so its own requireRole() redirect can run', () => {
    const response = adminGate(at('/admin/products/', { method: 'POST', headers: { 'next-action': 'abc123' } }));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('location')).toBeNull();
    expect(response?.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});

describe('resolveAuthSecret', () => {
  const good = 'a-long-random-secret-of-at-least-32-characters';

  it('uses a proper secret as is', () => {
    expect(resolveAuthSecret({ secret: good, nodeEnv: 'production' })).toBe(good);
    expect(resolveAuthSecret({ secret: ` ${good} `, nodeEnv: 'production' })).toBe(good);
  });

  it('closes sign-in in production when the secret is missing, short or still the placeholder', () => {
    for (const secret of [undefined, '', '   ', 'short', 'x'.repeat(31), 'replace-with-a-long-random-string', 'Replace-with-something-else-entirely-long']) {
      expect(resolveAuthSecret({ secret, nodeEnv: 'production' }), String(secret)).toBe('');
    }
  });

  it('falls back to a development secret outside production only', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(resolveAuthSecret({ secret: undefined, nodeEnv }).length).toBeGreaterThanOrEqual(32);
      expect(resolveAuthSecret({ secret: good, nodeEnv })).toBe(good);
    }
  });
});

describe('failure limiter', () => {
  const clock = () => {
    let now = 1_000_000;
    return { now: () => now, advance: (ms: number) => void (now += ms) };
  };

  it('blocks a key after max failures inside the window and frees it as they age out', () => {
    const time = clock();
    const limiter = createFailureLimiter({ max: 3, windowMs: 1000, now: time.now });
    limiter.recordFailure('a');
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(false);
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
    expect(limiter.isBlocked('b')).toBe(false);
    time.advance(999);
    expect(limiter.isBlocked('a')).toBe(true);
    time.advance(2);
    expect(limiter.isBlocked('a')).toBe(false);
    expect(limiter.size()).toBe(0);
  });

  it('counts a sliding window: old failures drop out one at a time', () => {
    const time = clock();
    const limiter = createFailureLimiter({ max: 2, windowMs: 1000, now: time.now });
    limiter.recordFailure('a');
    time.advance(600);
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
    time.advance(500); // the first failure is now 1100 ms old
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('reset forgets a key, and memory stays bounded by dropping the oldest keys', () => {
    const limiter = createFailureLimiter({ max: 1, windowMs: 60_000, maxKeys: 3 });
    limiter.recordFailure('a');
    limiter.reset('a');
    expect(limiter.isBlocked('a')).toBe(false);
    for (const key of ['k1', 'k2', 'k3', 'k4', 'k5']) limiter.recordFailure(key);
    expect(limiter.size()).toBe(3);
    expect(limiter.isBlocked('k1')).toBe(false);
    expect(limiter.isBlocked('k5')).toBe(true);
  });
});

describe('login limiter', () => {
  const email = 'owner@test.local';

  it('blocks the sixth try for an email from one address, not other addresses or emails', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 4; i++) limiter.recordFailure(email, '1.1.1.1');
    expect(limiter.isBlocked(email, '1.1.1.1')).toBe(false);
    limiter.recordFailure(email, '1.1.1.1');
    expect(limiter.isBlocked(email, '1.1.1.1')).toBe(true);
    expect(limiter.isBlocked(email.toUpperCase(), '1.1.1.1')).toBe(true);
    expect(limiter.isBlocked(email, '2.2.2.2')).toBe(false);
    expect(limiter.isBlocked('staff@test.local', '1.1.1.1')).toBe(false);
  });

  it('frees the pair after 15 minutes', () => {
    let now = 0;
    const limiter = createLoginLimiter(() => now);
    for (let i = 0; i < 5; i++) limiter.recordFailure(email, '1.1.1.1');
    now += FAILURE_WINDOW_MS - 1;
    expect(limiter.isBlocked(email, '1.1.1.1')).toBe(true);
    now += 2;
    expect(limiter.isBlocked(email, '1.1.1.1')).toBe(false);
  });

  it('a good sign-in clears the pair', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 4; i++) limiter.recordFailure(email, '1.1.1.1');
    limiter.recordSuccess(email, '1.1.1.1');
    limiter.recordFailure(email, '1.1.1.1');
    expect(limiter.isBlocked(email, '1.1.1.1')).toBe(false);
  });

  it('also caps one address that sprays many different emails', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 20; i++) limiter.recordFailure(`person${i}@test.local`, '9.9.9.9');
    expect(limiter.isBlocked('brand-new@test.local', '9.9.9.9')).toBe(true);
    expect(limiter.isBlocked('brand-new@test.local', '8.8.8.8')).toBe(false);
  });
});

describe('clientIp', () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it('takes the first forwarded address, then x-real-ip, then "unknown"', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
    expect(clientIp(headers({ 'x-real-ip': '203.0.113.6' }))).toBe('203.0.113.6');
    expect(clientIp(headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(headers({}))).toBe('unknown');
  });

  it('refuses values that do not look like an address, so the key space stays small', () => {
    for (const value of ['<script>', 'a'.repeat(200), '1.2.3.4; drop table', '']) {
      expect(clientIp(headers({ 'x-forwarded-for': value }))).toBe('unknown');
    }
  });
});
