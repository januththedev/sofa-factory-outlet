import type { PictureData } from '../images/urls';

/** The most of one product + colour a visitor can put in the cart (the stepper runs 1 to this). */
export const CART_MAX_QUANTITY = 20;

/** One cart line: a product in a chosen colour variant. Snapshots keep the cart readable if the catalogue changes. */
export type CartLine = {
  /** `${productId}:${variantId}` */
  key: string;
  productId: number;
  variantId: number;
  slug: string;
  name: string;
  colourName: string;
  hex: string;
  image: PictureData | null;
  quantity: number;
  /** Unit price snapshot in minor units; null = price on request. */
  priceMinor: number | null;
  /** Set when the line was added from a "Complete the look" suggestion: why it goes with the rest of the cart. */
  reason?: string;
  /** The price snapshot is a starting price ("From Rs. 12,490"), not a fixed one. */
  priceFrom?: boolean;
};

/** What `add()` and `replace()` take: a line without its key, with an optional quantity (default 1). */
export type NewCartLine = Omit<CartLine, 'key' | 'quantity'> & { quantity?: number };

export const cartKey = (productId: number, variantId: number) => `${productId}:${variantId}`;

/** A whole quantity between 1 and the maximum; anything that is not a finite number counts as 1. */
export const clampQuantity = (quantity: number) => (Number.isFinite(quantity) ? Math.min(CART_MAX_QUANTITY, Math.max(1, Math.floor(quantity))) : 1);

/** Sum of line totals in minor units, or null when the cart is empty or any line has no price. */
export function cartTotal(lines: CartLine[]): number | null {
  if (!lines.length || lines.some((l) => l.priceMinor === null)) return null;
  return lines.reduce((sum, l) => sum + (l.priceMinor ?? 0) * l.quantity, 0);
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

/** What the server needs to know about a cart (bookings, chatbot, suggestions). */
export type CartRef = Array<{ productId: number; variantId?: number; quantity: number }>;
export const toCartRef = (lines: CartLine[]): CartRef => lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));

/** Which pieces are in the cart, ignoring quantity and order: suggestions only need to be refreshed when this changes. */
export const cartSignature = (lines: CartLine[]) =>
  lines
    .map((l) => l.key)
    .sort()
    .join(',');

/** The cart page lives at /cart/; the drawer stays out of its way there. */
export const isCartPath = (pathname: string) => pathname.replace(/\/+$/, '') === '/cart';

// ---- Plain objects the cart's server actions return (src/app/(site)/cart/actions.ts) ----

/** One "Complete the look" suggestion: a product in the colour the engine chose, with the reason it goes with the cart. */
export type CartSuggestion = {
  productId: number;
  variantId: number;
  slug: string;
  name: string;
  href: string;
  priceMinor: number | null;
  /** The price is a starting price, shown as "From Rs. …". */
  priceFrom: boolean;
  image: PictureData | null;
  colourName: string;
  hex: string;
  /** One short sentence the colour engine generated, e.g. "Cream cushions soften emerald velvet". */
  reason: string;
};

/** A colour a product comes in, for changing a cart line's colour in place. */
export type CartVariantOption = {
  id: number;
  colourName: string;
  hex: string;
  family: string;
  image: PictureData | null;
};

/** The cart line a suggestion becomes when the visitor taps "Add". */
export function suggestionToLine(suggestion: CartSuggestion): NewCartLine {
  return {
    productId: suggestion.productId,
    variantId: suggestion.variantId,
    slug: suggestion.slug,
    name: suggestion.name,
    colourName: suggestion.colourName,
    hex: suggestion.hex,
    image: suggestion.image,
    priceMinor: suggestion.priceMinor,
    reason: suggestion.reason,
    ...(suggestion.priceFrom ? { priceFrom: true } : {}),
  };
}

// ---- Reading the saved cart back safely ----

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isText = (value: unknown): value is string => typeof value === 'string';

function sanitiseImage(value: unknown): PictureData | null {
  if (!isRecord(value)) return null;
  const { avifSrcSet, webpSrcSet, src, width, height, alt, blur, dominant, cutout } = value;
  if (!isText(avifSrcSet) || !isText(webpSrcSet) || !isText(src) || typeof width !== 'number' || typeof height !== 'number' || !isText(alt)) return null;
  return { avifSrcSet, webpSrcSet, src, width, height, alt, ...(isText(blur) ? { blur } : {}), ...(isText(dominant) ? { dominant } : {}), cutout: cutout === true };
}

/**
 * What the browser handed back is not trusted (older versions, edits, a full disk):
 * keeps only well-formed lines, clamps quantities, and merges duplicates.
 */
export function sanitiseLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const byKey = new Map<string, CartLine>();
  for (const raw of value) {
    if (!isRecord(raw) || !isId(raw.productId) || !isId(raw.variantId)) continue;
    if (!isText(raw.slug) || !isText(raw.name) || !isText(raw.colourName) || !isText(raw.hex)) continue;
    const key = cartKey(raw.productId, raw.variantId);
    const quantity = clampQuantity(typeof raw.quantity === 'number' ? raw.quantity : 1);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = Math.min(CART_MAX_QUANTITY, existing.quantity + quantity);
      continue;
    }
    byKey.set(key, {
      key,
      productId: raw.productId,
      variantId: raw.variantId,
      slug: raw.slug,
      name: raw.name,
      colourName: raw.colourName,
      hex: raw.hex,
      image: sanitiseImage(raw.image),
      quantity,
      priceMinor: typeof raw.priceMinor === 'number' && Number.isFinite(raw.priceMinor) && raw.priceMinor >= 0 ? Math.round(raw.priceMinor) : null,
      ...(isText(raw.reason) && raw.reason ? { reason: raw.reason } : {}),
      ...(raw.priceFrom === true ? { priceFrom: true } : {}),
    });
  }
  return [...byKey.values()];
}
