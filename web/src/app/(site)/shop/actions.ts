'use server';

import { z } from 'zod';
import { searchListing } from '@/components/catalogue/server';
import { parseShopParams } from '@/lib/catalogue/search';

const previewSchema = z.object({
  query: z.string().max(4000),
  category: z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/).optional(),
  hub: z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/).optional(),
});

export async function previewFilters(input: z.input<typeof previewSchema>) {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'Check your filters and try again.' };
  const query = new URLSearchParams(parsed.data.query);
  const raw: Record<string, string[]> = {};
  for (const key of query.keys()) raw[key] = query.getAll(key);
  const params = parseShopParams(raw);
  try {
    const result = await searchListing({
      ...params,
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.hub ? { hub: parsed.data.hub } : {}),
      page: 1,
    });
    return { ok: true as const, total: result.total, facets: result.facets };
  } catch {
    return { ok: false as const, error: 'Could not count pieces. Please try again.' };
  }
}
