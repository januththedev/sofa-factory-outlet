import { cleanKey, contentTypeFor, storage } from '@/lib/storage';

// Serves files from the local storage adapter (.data/blob) when Vercel Blob
// is not configured. With Blob, images load straight from the Blob CDN.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const driver = storage();
  if (driver.kind !== 'local') return new Response('Not found', { status: 404 });

  const { key } = await context.params;
  let cleaned: string;
  try {
    cleaned = cleanKey(key.map(decodeURIComponent).join('/'));
  } catch {
    return new Response('Bad request', { status: 400 });
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
