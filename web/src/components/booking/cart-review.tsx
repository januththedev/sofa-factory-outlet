'use client';

import { useRef } from 'react';

import { CartLineList, CartTotals } from '@/components/cart/cart-lines';
import { CartUndoNotice, useCartUndo } from '@/components/cart/cart-undo';
import { TLink } from '@/components/site/transition';
import { useCart, useCartHydrated } from '@/lib/cart/store';

/** Editable pieces share the same thumb-sized controls as the cart. A visit also works without pieces. */
export function CartReview() {
  const ready = useCartHydrated();
  const lines = useCart((state) => state.lines);
  const { removed, remember, undo } = useCartUndo();
  const region = useRef<HTMLDivElement>(null);

  if (!ready) {
    return (
      <div aria-busy="true" className="h-24 rounded-xl bg-bone-2/70 motion-safe:animate-pulse">
        <span className="sr-only" role="status">Loading your cart</span>
      </div>
    );
  }
  return (
    <div ref={region} tabIndex={-1} className="min-w-0">
      <CartUndoNotice removed={removed} undo={undo} />
      {lines.length ? (
        <>
          <CartLineList lines={lines} layout="page" onRemoved={(line) => {
            remember(line);
            region.current?.focus({ preventScroll: true });
          }} />
          <div className="mt-5"><CartTotals lines={lines} /></div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-bone/50 p-4">
          <p className="font-display text-xl">Not sure yet? Book without picking a piece.</p>
          <p className="mt-2 text-base text-ink-2">
            Come and look around, sit on a few pieces and choose at the showroom.
          </p>
          <TLink href="/shop/" className="mt-3 inline-flex min-h-11 items-center text-base text-maroon underline">
            Browse the collection first
          </TLink>
        </div>
      )}
    </div>
  );
}
