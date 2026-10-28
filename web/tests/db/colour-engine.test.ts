import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getPublishedCards } from '@/lib/catalogue/cached';
import { suggestFor } from '@/lib/colour/engine';
import { closeDb, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

afterAll(closeDb);

describe('colour engine database integration', () => {
  it('suggests only published complements for an emerald sofa', async () => {
    const cards = await getPublishedCards();
    const anchor = cards.find((product) => product.category.path === 'sofas' && product.colours.some((colour) => colour.family === 'green'));
    expect(anchor).toBeDefined();
    if (!anchor) return;

    const emerald = anchor.colours.find((colour) => colour.family === 'green');
    const suggestions = await suggestFor({ anchors: [{ productId: anchor.id, variantId: emerald?.id }], limit: 4 });
    const db = await getDb();
    const hidden = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.status, 'hidden'));
    const hiddenIds = new Set(hidden.map((product) => product.id));

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(4);
    expect(suggestions.every((suggestion) => suggestion.product.id !== anchor.id)).toBe(true);
    expect(suggestions.every((suggestion) => !hiddenIds.has(suggestion.product.id))).toBe(true);
    expect(suggestions.every((suggestion) => cards.some((card) => card.id === suggestion.product.id))).toBe(true);
  });
});
