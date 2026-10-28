import { cleanKey, contentTypeFor, storage } from '@/lib/storage';
import { env } from '@/lib/env';
import { get } from '@vercel/blob';

// Catalogue photos can be public even when their backing store is private.
// Only content-addressed image paths are exposed; other private files stay private.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  const driver = storage();
  if (driver.kind !== 'local' && env.BLOB_ACCESS !== 'private') return new Response('Not found', { status: 404 });

  const { key } = await context.params;
  let cleaned: string;
  try {
    cleaned = cleanKey(key.map(decodeURIComponent).join('/'));
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!/^(products|categories|site)\/[a-z0-9-]+\/[a-f0-9]{8}\/[1-9]\d*\.(avif|webp)$/.test(cleaned)) {
    return new Response('Not found', { status: 404 });
  }
  if (driver.kind === 'blob') {
    try {
      const blob = await get(cleaned, {
        access: 'private', token: env.BLOB_READ_WRITE_TOKEN,
        ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
      });
      if (!blob) return new Response('Not found', { status: 404 });
      const headers = {
        'cache-control': 'public, max-age=31536000, immutable',
        'vercel-cdn-cache-control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
        'etag': blob.blob.etag,
        'x-content-type-options': 'nosniff',
      };
      if (blob.statusCode === 304) return new Response(null, { status: 304, headers });
      return new Response(blob.stream, {
        headers: { ...headers, 'content-type': contentTypeFor(cleaned), 'content-length': String(blob.blob.size) },
      });
    } catch {
      console.error('[blob] Could not load a catalogue image.');
      return new Response('Image temporarily unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
    }
  }
  const data = await driver.get(cleaned);
  if (!data) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      'content-type': contentTypeFor(cleaned),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
