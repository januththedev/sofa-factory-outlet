import { env, siteUrl } from '@/lib/env';

export async function submitIndexNow(paths: string[]): Promise<boolean> {
  if (!env.INDEXNOW_KEY || paths.length === 0) return false;
  const host = new URL(siteUrl()).host;
  const response = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `${siteUrl()}/${env.INDEXNOW_KEY}.txt`, urlList: paths.map((path) => new URL(path, `${siteUrl()}/`).toString()) }) });
  return response.ok;
}
