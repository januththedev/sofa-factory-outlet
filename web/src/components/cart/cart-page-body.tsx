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

/**
 * The body of /cart/. The page shell is server-rendered; everything that reads the cart
 * lives here. Until the saved cart has been restored it shows a neutral placeholder rather
 * than "your cart is empty", so a returning visitor never sees the empty state flash.
 */
export function CartPageBody() {
  const hydrated = useCartHydrated();
  const lines = useCart((state) => state.lines);
  const { suggestions, pending } = useCartSuggestions(hydrated);
  const linesRegion = useRef<HTMLElement>(null);
  const linesHeading = useId();
  const summaryHeading = useId();

  if (!hydrated) {
    return (
      <div aria-busy="true" className="mt-10 lg:mt-14">
        <p role="status" className="sr-only">
          Loading your cart…
        </p>
        <div aria-hidden className="space-y-4 motion-safe:animate-pulse">
          <div className="h-36 rounded-[var(--radius-card)] bg-bone-2" />
          <div className="h-36 rounded-[var(--radius-card)] bg-bone-2" />
        </div>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="mt-10 lg:mt-14">
        <CartEmpty large />
      </div>
    );
  }

  const count = cartCount(lines);
  // A removed line (or an added suggestion) takes its own button with it: park focus on the list.
  const parkFocus = () => linesRegion.current?.focus({ preventScroll: true });

  return (
    <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section ref={linesRegion} tabIndex={-1} aria-labelledby={linesHeading} className="outline-none">
        <h2 id={linesHeading} className="sr-only">
          Items in your cart
        </h2>
        <CartLineList lines={lines} layout="page" onRemoved={parkFocus} />
      </section>

      <aside aria-labelledby={summaryHeading} className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
          <h2 id={summaryHeading} className="font-display text-2xl">
            Summary
          </h2>
          <p role="status" className="mt-1 text-sm text-mute">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
          <div className="mt-5 border-t border-line pt-5">
            <CartTotals lines={lines} />
          </div>
          <TLink href="/book-visit/" className={cn(buttonStyles({ variant: 'primary', size: 'lg' }), 'mt-6 w-full')}>
            Book a visit
          </TLink>
          <Button variant="ghost" size="lg" className="mt-3 w-full" onClick={() => openChat({ cart: toCartRef(lines), nudge: true })}>
            Ask our assistant
          </Button>
        </div>
      </aside>

      <div className="lg:col-span-2">
        <SuggestionTiles suggestions={suggestions} pending={pending} layout="page" headingLevel={2} onAdded={parkFocus} />
      </div>
    </div>
  );
}
