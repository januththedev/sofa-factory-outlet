'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { TLink } from '@/components/site/transition';
import type { ProductVariantView } from '@/lib/catalogue/types';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { openChat } from '@/lib/events';

type ProductSnapshot = {
  id: number;
  slug: string;
  name: string;
  priceMinor: number | null;
};
type CartFeedback = { added: boolean; addLine: () => void };

export function useProductCart(
  product: ProductSnapshot,
  variant: ProductVariantView | undefined,
): CartFeedback {
  const add = useCart((state) => state.add);
  const [addedVariant, setAddedVariant] = useState<number | null>(null);
  useEffect(() => {
    if (addedVariant === null) return;
    const timer = window.setTimeout(() => setAddedVariant(null), 5000);
    return () => window.clearTimeout(timer);
  }, [addedVariant]);
  const added = Boolean(variant && addedVariant === variant.id);
  const addLine = () => {
    if (!variant || added) return;
    add({
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      colourName: variant.colourName,
      hex: variant.hex,
      image: variant.images[0] ?? null,
      priceMinor: product.priceMinor,
    });
    setAddedVariant(variant.id);
    trackEvent('add_to_cart', { productId: product.id, variantId: variant.id });
  };
  return { added, addLine };
}

export function AddToCart({
  product,
  variant,
  feedback,
  compact = false,
}: {
  product: ProductSnapshot;
  variant: ProductVariantView;
  feedback?: CartFeedback;
  compact?: boolean;
}) {
  const local = useProductCart(product, variant);
  const { added, addLine } = feedback ?? local;
  return (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-3'}>
      <button
        type="button"
        disabled={added}
        className="btn btn-primary min-h-11 px-3"
        onClick={addLine}
      >
        {added ? 'Added to cart' : 'Add to cart'}
      </button>
      <button
        type="button"
        className="btn btn-ghost min-h-11 px-3"
        onClick={() =>
          openChat({ productId: product.id, variantId: variant.id })
        }
      >
        Ask about this sofa
      </button>
      <TLink
        href="/request-quote/"
        className="btn btn-ghost min-h-11 px-3"
        onClick={addLine}
      >
        Request a quote
      </TLink>
      {!compact ? (
        <TLink
          href="/book-visit/"
          className="btn btn-ghost min-h-11"
          onClick={addLine}
        >
          Book a visit with this piece
        </TLink>
      ) : null}
      {added ? (
        <TLink
          href="/cart/"
          className={`min-h-11 px-3 py-3 text-center underline ${compact ? 'col-span-2' : ''}`}
        >
          View cart
        </TLink>
      ) : null}
      {!feedback ? (
        <p role="status" className="sr-only">
          {added ? 'Added to cart. View cart is available.' : ''}
        </p>
      ) : null}
    </div>
  );
}
