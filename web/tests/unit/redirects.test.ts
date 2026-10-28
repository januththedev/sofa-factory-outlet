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
});
