import { describe, expect, it, vi } from 'vitest';
import { buildRedirectMap, RedirectCache } from '@/lib/seo/redirects';

describe('redirects', () => {
  it('normalises paths and builds entries', () => expect(buildRedirectMap([{ from: 'old', to: '/new/', status: 301 }]).get('/old/')).toEqual({ to: '/new/', status: 301 }));
  it('caches loads for 30 seconds', async () => {
    let now = 1;
    const load = vi.fn(async () => [{ from: '/old/', to: '/new/', status: 301 as const }]);
    const cache = new RedirectCache(load, 30_000, () => now);
    await cache.get('/old/'); await cache.get('/old/');
    expect(load).toHaveBeenCalledTimes(1);
    now += 30_001; await cache.get('/old/');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent cache misses into one load', async () => {
    const load = vi.fn(async () => [{ from: '/old/', to: '/new/', status: 301 as const }]);
    const cache = new RedirectCache(load);
    await Promise.all(Array.from({ length: 20 }, () => cache.get('/old/')));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the last good map and backs off during an outage, then recovers', async () => {
    let now = 0;
    const load = vi.fn(async () => [{ from: '/old/', to: '/new/', status: 301 as const }]);
    const cache = new RedirectCache(load, 30_000, () => now);
    await cache.get('/old/');
    now = 30_001;
    load.mockRejectedValueOnce(new Error('offline'));
    expect(await cache.get('/old/')).toEqual({ to: '/new/', status: 301 });
    await Promise.all(Array.from({ length: 20 }, () => cache.get('/old/')));
    expect(load).toHaveBeenCalledTimes(2);
    now += 5000;
    load.mockResolvedValueOnce([{ from: '/old/', to: '/latest/', status: 301 }]);
    expect(await cache.get('/old/')).toEqual({ to: '/latest/', status: 301 });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('backs off even when the first load fails', async () => {
    const load = vi.fn(async () => { throw new Error('unavailable'); });
    const cache = new RedirectCache(load);
    expect(await cache.get('/old/')).toBeUndefined();
    await cache.get('/old/');
    expect(load).toHaveBeenCalledTimes(1);
  });
});
