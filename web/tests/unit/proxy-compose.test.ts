import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { composeProxy, config } from '@/proxy';
import { RedirectCache, type RedirectEntry } from '@/lib/seo/redirects';

const request = (path: string) => new NextRequest(new URL(path, 'https://sofa.test'));
const redirectMap = (entries: RedirectEntry[] = []) => new RedirectCache(async () => entries);

describe('proxy composition', () => {
  it('redirects an admin path without a session to login', async () => {
    const response = await composeProxy(request('/admin/products/'), redirectMap());

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/admin/login/');
  });

  it('lets the admin login page pass through', async () => {
    const load = vi.fn(async () => []);
    const response = await composeProxy(request('/admin/login/'), new RedirectCache(load));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(load).not.toHaveBeenCalled();
  });

  it('does not load public redirects for API requests', async () => {
    const load = vi.fn(async () => []);
    const response = await composeProxy(request('/api/track/'), new RedirectCache(load));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(load).not.toHaveBeenCalled();
  });

  it('answers a legacy URL with a 301 redirect', async () => {
    const entries: RedirectEntry[] = [{ from: '/old-sofa/', to: '/sofas/', status: 301 }];
    const response = await composeProxy(request('/old-sofa/'), redirectMap(entries));

    expect(response.status).toBe(301);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/sofas/');
  });

  it('leaves static asset paths outside the matcher', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    const matches = (path: string) => matcher.test(request(path).nextUrl.pathname);

    expect(matches('/_next/static/chunk.js')).toBe(false);
    expect(matches('/blob/product-photo')).toBe(false);
    expect(matches('/images/sofa.webp')).toBe(false);
    expect(matches('/api/cron/digest/')).toBe(false);
    expect(matches('/api/track/')).toBe(false);
    expect(matches('/api/admin/notifications/')).toBe(false);
    expect(matches('/admin/products/')).toBe(true);
    expect(matches('/shop/')).toBe(true);
  });
});
