import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';

// One interface over two backends: Vercel Blob when BLOB_READ_WRITE_TOKEN is
// set, otherwise files under LOCAL_BLOB_DIR served by app/blob/[...key].

export type PutOptions = { contentType: string };

export interface StorageDriver {
  readonly kind: 'local' | 'blob';
  put(key: string, data: Buffer | Uint8Array, options: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  deletePrefix(prefix: string): Promise<void>;
}

export function cleanKey(key: string): string {
  const parts = key.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.some((p) => p === '..' || p === '.')) throw new Error(`Invalid storage key: ${key}`);
  return parts.join('/');
}

// Local-only folder: keep it out of Vercel's output file tracing.
const localRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), env.LOCAL_BLOB_DIR);

const localDriver: StorageDriver = {
  kind: 'local',
  async put(key, data) {
    const file = path.join(localRoot(), cleanKey(key));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  },
  async get(key) {
    try {
      return await fs.readFile(path.join(localRoot(), cleanKey(key)));
    } catch {
      return null;
    }
  },
  async deletePrefix(prefix) {
    await fs.rm(path.join(localRoot(), cleanKey(prefix)), { recursive: true, force: true });
  },
};

const blobDriver: StorageDriver = {
  kind: 'blob',
  async put(key, data, { contentType }) {
    const { put } = await import('@vercel/blob');
    await put(cleanKey(key), Buffer.from(data), {
      access: env.BLOB_ACCESS,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
  },
  async get(key) {
    if (env.BLOB_ACCESS === 'private') {
      const { get } = await import('@vercel/blob');
      const blob = await get(cleanKey(key), { access: 'private', token: env.BLOB_READ_WRITE_TOKEN });
      return blob?.statusCode === 200 ? Buffer.from(await new Response(blob.stream).arrayBuffer()) : null;
    }
    const response = await fetch(`${mediaBase()}/${cleanKey(key)}`);
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  },
  async deletePrefix(prefix) {
    const { list, del } = await import('@vercel/blob');
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: cleanKey(prefix), cursor, token: env.BLOB_READ_WRITE_TOKEN });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url), { token: env.BLOB_READ_WRITE_TOKEN });
      cursor = page.cursor;
    } while (cursor);
  },
};

export const storage = (): StorageDriver => (env.BLOB_READ_WRITE_TOKEN ? blobDriver : localDriver);

/** Public base URL that stored keys are served from. */
export function mediaBase(): string {
  if (env.BLOB_READ_WRITE_TOKEN && env.BLOB_ACCESS === 'private') return '/blob';
  if (env.BLOB_BASE_URL) return env.BLOB_BASE_URL.replace(/\/+$/, '');
  if (env.BLOB_READ_WRITE_TOKEN) {
    // Tokens look like vercel_blob_rw_<storeId>_<secret>.
    const storeId = env.BLOB_READ_WRITE_TOKEN.split('_')[3]?.toLowerCase();
    if (storeId) return `https://${storeId}.public.blob.vercel-storage.com`;
  }
  return '/blob';
}

export function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'avif':
      return 'image/avif';
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'json':
      return 'application/json';
    case 'md':
      return 'text/markdown; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
