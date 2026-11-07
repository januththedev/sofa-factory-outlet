import { env } from '@/lib/env';
import { TAGS, revalidateTags, type CacheTag } from '@/lib/revalidate';
import { bearerMatches } from '@/lib/security/bearer';

export const dynamic = 'force-dynamic';

/**
 * Refreshes the public site's cached data after a change made outside admin (a script against the database).
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/internal/revalidate?tags=products,categories
 * Without ?tags it refreshes the catalogue (products and categories).
 */
export async function POST(request: Request) {
  if (!bearerMatches(request, env.CRON_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const known = new Set<string>(Object.values(TAGS));
  const asked = new URL(request.url).searchParams.get('tags');
  const tags = (asked ? asked.split(',').map((t) => t.trim()) : [TAGS.products, TAGS.categories])
    .filter((t): t is CacheTag => known.has(t));
  if (!tags.length) return Response.json({ error: `Unknown tags. Use: ${[...known].join(', ')}` }, { status: 400 });
  revalidateTags(...tags);
  return Response.json({ revalidated: tags });
}
