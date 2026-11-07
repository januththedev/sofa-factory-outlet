import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'test-cron-secret-0123456789' } }));

const { POST } = await import('@/app/api/internal/revalidate/route');
const call = (query = '', token = 'test-cron-secret-0123456789') =>
  POST(new Request(`https://example.test/api/internal/revalidate${query}`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }));

describe('internal cache refresh', () => {
  beforeEach(() => revalidateTag.mockClear());

  it('refuses a request without the cron secret', async () => {
    expect((await call('', 'wrong-secret-wrong-secret')).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refreshes the catalogue by default', async () => {
    const response = await call();
    expect(await response.json()).toEqual({ revalidated: ['products', 'categories'] });
    expect(revalidateTag).toHaveBeenCalledWith('products', 'max');
  });

  it('refreshes only known tags', async () => {
    expect(await (await call('?tags=guides,nope')).json()).toEqual({ revalidated: ['guides'] });
    expect((await call('?tags=nope')).status).toBe(400);
  });
});
