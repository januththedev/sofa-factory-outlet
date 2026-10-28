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

    // Every non-sofa piece in the capture is hidden (borrowed photos), so nothing complements a sofa yet.
    expect(suggestions).toEqual([]);
    expect(suggestions.length).toBeLessThanOrEqual(4);
    expect(suggestions.every((suggestion) => suggestion.product.id !== anchor.id)).toBe(true);
    expect(suggestions.every((suggestion) => !hiddenIds.has(suggestion.product.id))).toBe(true);
    expect(suggestions.every((suggestion) => cards.some((card) => card.id === suggestion.product.id))).toBe(true);
  });

  it('suggests an ottoman with a readable reason once one is published', async () => {
    const db = await getDb();
    await db.update(s.products).set({ status: 'published' }).where(eq(s.products.legacyId, 360));
    const cards = await getPublishedCards();
    const anchor = cards.find((product) => product.category.path === 'sofas' && product.colours.some((colour) => colour.family === 'green'));
    expect(anchor).toBeDefined();
    if (!anchor) return;

    const suggestions = await suggestFor({ anchors: [{ productId: anchor.id }], limit: 4 });
    expect(suggestions.map((suggestion) => suggestion.product.category.path)).toContain('ottomans');
    expect(suggestions[0].reason.length).toBeGreaterThan(10);
    expect(suggestions.every((suggestion) => suggestion.product.id !== anchor.id)).toBe(true);
  });
});
