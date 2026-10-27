import type { PictureData } from '../images/urls';

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
};

export const cartKey = (productId: number, variantId: number) => `${productId}:${variantId}`;

/** Sum of line totals in minor units, or null when the cart is empty or any line has no price. */
export function cartTotal(lines: CartLine[]): number | null {
  if (!lines.length || lines.some((l) => l.priceMinor === null)) return null;
  return lines.reduce((sum, l) => sum + (l.priceMinor ?? 0) * l.quantity, 0);
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

/** What the server needs to know about a cart (bookings, chatbot, suggestions). */
export type CartRef = Array<{ productId: number; variantId?: number; quantity: number }>;
export const toCartRef = (lines: CartLine[]): CartRef => lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
