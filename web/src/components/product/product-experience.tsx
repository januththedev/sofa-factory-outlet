'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { openChat } from '@/lib/events';
import { formatLkr } from '@/lib/money';
import type { ProductDetail } from '@/lib/catalogue/types';
import { AddToCart } from './add-to-cart';
import { Gallery } from './gallery';
import { ProductView } from './product-view';

function Price({ product }: { product: Pick<ProductDetail, 'priceMinor' | 'compareAtMinor' | 'priceFrom'> }) {
  if (product.priceMinor === null) return <span>Price on request</span>;
  return <><span>{product.priceFrom ? 'From ' : ''}{formatLkr(product.priceMinor)}</span>{product.compareAtMinor && product.compareAtMinor > product.priceMinor ? <del className="ml-3 text-base text-mute">{formatLkr(product.compareAtMinor)}</del> : null}</>;
}

export function ProductExperience({ product }: { product: ProductDetail }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? 0);
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  if (!variant) return null;
  return (
    <>
      <ProductView productId={product.id} variantId={variant.id} />
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7"><Gallery key={variant.id} variant={variant} /></div>
        <div className="lg:col-span-5 lg:pt-8">
          <p className="eyebrow">{product.category.name}</p>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,6vw,5.2rem)] font-light leading-[0.95]">{product.name}</h1>
          <p className="mt-6 text-xl"><Price product={product} /></p>
          {product.variants.length > 1 ? <fieldset className="mt-8"><legend className="text-sm font-semibold">Colour: {variant.colourName}</legend><div className="mt-3 flex flex-wrap gap-3">{product.variants.map((item) => <button key={item.id} type="button" onClick={() => setVariantId(item.id)} aria-label={item.colourName} aria-pressed={item.id === variant.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-2 aria-pressed:border-maroon"><span className="h-5 w-5 rounded-full border border-line" style={{ backgroundColor: item.hex }} />{item.colourName}</button>)}</div></fieldset> : null}
          <div className="mt-8"><AddToCart product={product} variant={variant} /></div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-bone/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="shrink-0 text-sm font-semibold"><Price product={product} /></p>
        <div className="flex gap-2"><button type="button" className="btn btn-primary px-3 py-2 text-xs" onClick={() => { useCart.getState().add({ productId: product.id, variantId: variant.id, slug: product.slug, name: product.name, colourName: variant.colourName, hex: variant.hex, image: variant.images[0] ?? null, priceMinor: product.priceMinor }); trackEvent('add_to_cart', { productId: product.id, variantId: variant.id }); }}>Add to cart</button><button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => openChat({ productId: product.id, variantId: variant.id })}>Ask about this sofa</button></div>
      </div>
    </>
  );
}
