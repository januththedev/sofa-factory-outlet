'use client';

import { useId, useRef } from 'react';
import { TLink } from '@/components/site/transition';
import { Button, buttonStyles } from '@/components/ui/button';
import { useCart, useCartHydrated } from '@/lib/cart/store';
import { cartCount, toCartRef } from '@/lib/cart/types';
import { cn } from '@/lib/cn';
import { openChat } from '@/lib/events';
import { CartEmpty } from './cart-empty';
import { CartLineList, CartTotals } from './cart-lines';
import { SuggestionTiles, useCartSuggestions } from './cart-suggestions';
import { CartUndoNotice, useCartUndo } from './cart-undo';

export function CartPageBody() {
  const hydrated = useCartHydrated();
  const lines = useCart((state) => state.lines);
  const { suggestions, pending } = useCartSuggestions(hydrated);
  const { removed, remember, undo } = useCartUndo();
  const linesRegion = useRef<HTMLDivElement>(null);
  const linesHeading = useId();
  const summaryHeading = useId();
  const parkFocus = () => linesRegion.current?.focus({ preventScroll: true });

  if (!hydrated) {
    return (
      <div aria-busy="true" className="mt-10 space-y-4">
        <p role="status" className="sr-only">Loading your cart...</p>
        <div aria-hidden className="h-36 rounded-xl bg-bone-2 motion-safe:animate-pulse" />
        <div aria-hidden className="h-36 rounded-xl bg-bone-2 motion-safe:animate-pulse" />
      </div>
    );
  }
  return (
    <div ref={linesRegion} tabIndex={-1} className="mt-10 min-w-0 pb-28 lg:mt-14 lg:pb-0">
      <CartUndoNotice removed={removed} undo={() => {
        undo();
        parkFocus();
      }} />
      {lines.length ? (
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section aria-labelledby={linesHeading} className="min-w-0">
            <h2 id={linesHeading} className="sr-only">Items in your cart</h2>
            <CartLineList
              lines={lines}
              layout="page"
              onRemoved={(line) => {
                remember(line);
                parkFocus();
              }}
            />
          </section>
          <aside aria-labelledby={summaryHeading} className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <h2 id={summaryHeading} className="font-display text-2xl">Summary</h2>
              <p role="status" className="mt-1 text-base text-mute">
                {cartCount(lines)} {cartCount(lines) === 1 ? 'item' : 'items'}
              </p>
              <div className="mt-5 border-t border-line pt-5"><CartTotals lines={lines} /></div>
              <TLink
                href="/book-visit/"
                className={cn(buttonStyles({ variant: 'primary', size: 'lg' }), 'mt-6 hidden w-full lg:inline-flex')}
              >
                Book a visit
              </TLink>
              <Button
                variant="ghost"
                size="lg"
                className="mt-3 w-full"
                onClick={() => openChat({ cart: toCartRef(lines), nudge: true })}
              >
                Ask our assistant
              </Button>
            </div>
          </aside>
          <div className="min-w-0 lg:col-span-2">
            <SuggestionTiles
              suggestions={suggestions}
              pending={pending}
              layout="page"
              headingLevel={2}
              onAdded={parkFocus}
            />
          </div>
        </div>
      ) : <CartEmpty large />}
      <div
        data-sticky-bar
        className={[
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone px-4 pt-3 lg:hidden',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        ].join(' ')}
      >
        <TLink
          href="/book-visit/"
          className={cn(buttonStyles({ variant: 'primary', size: 'lg' }), 'w-full')}
        >
          Book a visit
        </TLink>
      </div>
    </div>
  );
}
