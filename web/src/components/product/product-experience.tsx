'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { TLink } from '@/components/site/transition';
import { trackEvent } from '@/lib/analytics/client';
import { formatLkr } from '@/lib/money';
import type { ProductDetail } from '@/lib/catalogue/types';
import { AddToCart } from './add-to-cart';
import { useProductCart } from './add-to-cart';
import { Gallery } from './gallery';
import { ProductView } from './product-view';

function Price({
  product,
}: {
  product: Pick<ProductDetail, 'priceMinor' | 'compareAtMinor' | 'priceFrom'>;
}) {
  if (product.priceMinor === null) return <span>Price on request</span>;
  return (
    <>
      <span>
        {product.priceFrom ? 'From ' : ''}
        {formatLkr(product.priceMinor)}
      </span>
      {product.compareAtMinor && product.compareAtMinor > product.priceMinor ? (
        <del className="ml-3 text-base text-mute">
          {formatLkr(product.compareAtMinor)}
        </del>
      ) : null}
    </>
  );
}

export function ProductExperience({ product }: { product: ProductDetail }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? 0);
  const [showSticky, setShowSticky] = useState(false);
  const actions = useRef<HTMLDivElement>(null);
  const variant =
    product.variants.find((item) => item.id === variantId) ??
    product.variants[0];
  const feedback = useProductCart(product, variant);
  useEffect(() => {
    const node = actions.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) =>
      setShowSticky(!entry.isIntersecting),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  if (!variant) return null;
  return (
    <>
      <ProductView productId={product.id} variantId={variant.id} />
      <div className="grid min-w-0 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          <Gallery key={variant.id} variant={variant} />
        </div>
        <div className="min-w-0 lg:col-span-5 lg:pt-8">
          <p className="text-xs font-semibold uppercase tracking-wider">
            {product.category.name}
          </p>
          <h1 className="mt-4 text-balance break-words font-display text-[clamp(2.25rem,8vw,3.75rem)] font-light leading-none lg:text-[clamp(2.25rem,3.8vw,3.9rem)]">
            {product.name}
          </h1>
          <p className="mt-6 text-xl">
            <Price product={product} />
          </p>
          {product.priceMinor === null ? (
            <p className="mt-2 text-base text-ink-2">
              Request a quote for prices, fabrics and delivery options.{' '}
              <TLink href="/book-visit/" className="underline">
                Book a visit
              </TLink>
              .
            </p>
          ) : null}
          <fieldset className="mt-6">
            <legend className="text-base font-semibold">
              Colour: {variant.colourName}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setVariantId(item.id);
                    trackEvent('colour_pick', {
                      productId: product.id,
                      variantId: item.id,
                    });
                  }}
                  aria-label={item.colourName}
                  aria-pressed={item.id === variant.id}
                  className="flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line
                    px-3 text-base aria-pressed:border-maroon"
                >
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full border border-line"
                    style={{ backgroundColor: item.hex }}
                  />
                  {item.colourName}
                </button>
              ))}
            </div>
          </fieldset>
          <div ref={actions} className="mt-6">
            <AddToCart
              product={product}
              variant={variant}
              feedback={feedback}
            />
          </div>
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {feedback.added ? 'Added to cart. View cart is available.' : ''}
      </p>
      {showSticky ? (
        <div
          data-sticky-bar
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone px-3 pt-3 lg:hidden
            pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <AddToCart
            product={product}
            variant={variant}
            feedback={feedback}
            compact
          />
        </div>
      ) : null}
    </>
  );
}
