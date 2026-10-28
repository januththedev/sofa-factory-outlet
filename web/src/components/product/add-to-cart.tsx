'use client';

import { TLink } from '@/components/site/transition';
import type { ProductVariantView } from '@/lib/catalogue/types';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { openChat } from '@/lib/events';

type ProductSnapshot = { id: number; slug: string; name: string; priceMinor: number | null };

export function AddToCart({ product, variant }: { product: ProductSnapshot; variant: ProductVariantView }) {
  const add = useCart((state) => state.add);
  const addLine = () => {
    add({ productId: product.id, variantId: variant.id, slug: product.slug, name: product.name, colourName: variant.colourName, hex: variant.hex, image: variant.images[0] ?? null, priceMinor: product.priceMinor });
    trackEvent('add_to_cart', { productId: product.id, variantId: variant.id });
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="button" className="btn btn-primary" onClick={addLine}>Add to cart</button>
      <TLink href="/book-visit/" className="btn btn-ghost" onClick={addLine}>Book a visit with this piece</TLink>
      <button type="button" className="link-underline self-center py-2 text-sm" onClick={() => openChat({ productId: product.id, variantId: variant.id })}>Ask about this sofa</button>
    </div>
  );
}
