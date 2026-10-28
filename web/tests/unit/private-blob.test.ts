import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    BLOB_READ_WRITE_TOKEN: 'test-token' as string | undefined,
    BLOB_ACCESS: 'private',
    BLOB_BASE_URL: 'https://custom.example',
    LOCAL_BLOB_DIR: '.data/blob',
  },
  get: vi.fn(),
  put: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@vercel/blob', () => ({ get: mocks.get, put: mocks.put }));

import { GET } from '@/app/blob/[...key]/route';
import { mediaBase, storage } from '@/lib/storage';

const key = 'products/688/1234abcd/480.webp';
const request = (pathname = key, headers?: HeadersInit) => GET(
  new Request(`https://sofa.test/blob/${pathname}`, { headers }),
  { params: Promise.resolve({ key: pathname.split('/') }) },
);

describe('private catalogue images', () => {
  beforeEach(() => {
    mocks.env.BLOB_ACCESS = 'private';
    mocks.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    mocks.get.mockReset();
    mocks.put.mockReset();
  });

  it('uses same-origin URLs for private storage and preserves public-store URLs', () => {
    expect(mediaBase()).toBe('/blob');
    mocks.env.BLOB_ACCESS = 'public';
    expect(mediaBase()).toBe('https://custom.example');
  });

  it('streams an authenticated image and makes its content-addressed response cacheable', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode('webp-image'));
      controller.close();
    } });
    mocks.get.mockResolvedValue({ statusCode: 200, stream, blob: { etag: '"photo-v1"', size: 10 } });
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('webp-image');
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=31536000');
    expect(mocks.get).toHaveBeenCalledWith(key, { access: 'private', token: 'test-token', ifNoneMatch: undefined });
  });

  it('returns 304 without a body for unchanged images', async () => {
    mocks.get.mockResolvedValue({ statusCode: 304, stream: null, blob: { etag: '"photo-v1"' } });
    const response = await request(key, { 'if-none-match': '"photo-v1"' });
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(mocks.get.mock.calls[0][1].ifNoneMatch).toBe('"photo-v1"');
  });

  it.each(['knowledge/private-notes.pdf', 'invoices/1/invoice.pdf', 'products/688/not-a-hash/480.webp'])('does not expose private non-catalogue files: %s', async (pathname) => {
    expect((await request(pathname)).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('rejects path traversal before reading storage', async () => {
    expect((await request('../.env.local')).status).toBe(400);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('returns 404 for missing images', async () => {
    mocks.get.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });

  it('keeps public stores on direct delivery', async () => {
    mocks.env.BLOB_ACCESS = 'public';
    expect((await request()).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('writes new admin images with the configured access', async () => {
    await storage().put(key, Buffer.from('image'), { contentType: 'image/webp' });
    expect(mocks.put).toHaveBeenCalledWith(key, expect.any(Buffer), expect.objectContaining({ access: 'private', token: 'test-token' }));
  });
});
