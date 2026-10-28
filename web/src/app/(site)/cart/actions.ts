'use server';

import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { CART_MAX_QUANTITY, type CartRef, type CartSuggestion, type CartVariantOption } from '@/lib/cart/types';
import { suggestFor } from '@/lib/colour/engine';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { pictureData } from '@/lib/images/urls';

// Read-only lookups for the cart UI. Both return plain objects and fall back to an
// empty list for bad input, so a failed lookup never breaks the cart itself.

/** Ids are Postgres `integer`s; anything larger would make the query fail. */
const idSchema = z.number().int().positive().max(2_147_483_647);

const cartRefSchema = z
  .array(z.object({ productId: idSchema, variantId: idSchema.optional(), quantity: z.number().int().min(1).max(CART_MAX_QUANTITY) }))
  .max(40);

/** The colours a published product comes in (default colour first), for changing a cart line's colour in place. */
export async function getVariantsAction(productId: number): Promise<CartVariantOption[]> {
  const parsed = idSchema.safeParse(productId);
  if (!parsed.success) return [];

  const db = await getDb();
  const rows = await db
    .select({
      id: s.productVariants.id,
      colourName: s.productVariants.colourName,
      hex: s.productVariants.hex,
      family: s.productVariants.family,
      images: s.productVariants.images,
    })
    .from(s.productVariants)
    .innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
    .where(and(eq(s.productVariants.productId, parsed.data), eq(s.products.status, 'published')))
    .orderBy(desc(s.productVariants.isDefault), asc(s.productVariants.sortOrder), asc(s.productVariants.id));

  return rows.map((row) => ({
    id: row.id,
    colourName: row.colourName,
    hex: row.hex,
    family: row.family,
    image: row.images[0] ? pictureData(row.images[0]) : null,
  }));
}

/** "Complete the look" for a cart: the colour engine's best matches, flattened into plain objects the client can render. */
export async function getSuggestionsAction(cartRef: CartRef): Promise<CartSuggestion[]> {
  const parsed = cartRefSchema.safeParse(cartRef);
  if (!parsed.success || parsed.data.length === 0) return [];

  try {
    const found = await suggestFor({ anchors: parsed.data, limit: 4 });
    return found.flatMap(({ product, variantId, reason }) => {
      const colour = product.colours.find((c) => c.id === variantId);
      if (!colour) return [];
      return [
        {
          productId: product.id,
          variantId,
          slug: product.slug,
          name: product.name,
          href: product.href,
          priceMinor: product.priceMinor,
          priceFrom: product.priceFrom,
          image: colour.image ?? product.image,
          colourName: colour.name,
          hex: colour.hex,
          reason,
        },
      ];
    });
  } catch (error) {
    // The engine is a separate module; if it fails the cart simply shows no suggestions.
    console.error('[cart] suggestions unavailable', error);
    return [];
  }
}
