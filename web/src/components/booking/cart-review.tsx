'use client';

import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { type CartLine, cartTotal } from '@/lib/cart/types';
import { cn } from '@/lib/cn';
import { formatLkr } from '@/lib/money';

const MAX_QUANTITY = 20;

const subscribeToHydration = (notify: () => void) => useCart.persist.onFinishHydration(notify);

/**
 * True once the saved cart has been read from the browser. The site layout
 * restores it too; asking again here keeps this page working on its own. If
 * storage is blocked and hydration never finishes, we stop waiting after a moment.
 */
function useCartReady(): boolean {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => useCart.persist.hasHydrated(), () => false);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!useCart.persist.hasHydrated()) void useCart.persist.rehydrate();
    const timer = window.setTimeout(() => setGaveUp(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);
  return hydrated || gaveUp;
}

const stepper =
  'grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-bone-2 disabled:pointer-events-none disabled:opacity-35';

function Line({ line }: { line: CartLine }) {
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bone-2">
        {line.image ? (
          <Picture
            data={line.image}
            alt=""
            sizes="80px"
            imgClassName={cn('h-full w-full', line.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover')}
          />
        ) : (
          <span aria-hidden className="block h-full w-full" style={{ backgroundColor: line.hex }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <TLink href={`/product/${line.slug}/`} className="font-display text-lg leading-snug hover:underline">
              {line.name}
            </TLink>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-mute">
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: line.hex }} />
              {line.colourName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              trackEvent('remove_from_cart', { productId: line.productId, variantId: line.variantId });
              remove(line.key);
            }}
            aria-label={`Remove ${line.name}, ${line.colourName}, from your visit`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-bone-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={`Quantity of ${line.name}, ${line.colourName}`} className="inline-flex items-center rounded-full border border-line">
            <button type="button" onClick={() => setQuantity(line.key, line.quantity - 1)} disabled={line.quantity <= 1} aria-label="Decrease quantity" className={stepper}>
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span aria-live="polite" className="min-w-8 text-center text-sm tabular-nums">
              {line.quantity}
            </span>
            <button type="button" onClick={() => setQuantity(line.key, line.quantity + 1)} disabled={line.quantity >= MAX_QUANTITY} aria-label="Increase quantity" className={stepper}>
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {line.priceMinor !== null ? (
            <p className="text-sm text-ink-2">
              {formatLkr(line.priceMinor)}
              {line.quantity > 1 ? ' each' : ''}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Step 1: the pieces in the cart, still editable, and a clear note that a visit works without any. */
export function CartReview() {
  const ready = useCartReady();
  const lines = useCart((state) => state.lines);

  if (!ready) {
    return (
      <div aria-busy="true" className="h-24 animate-pulse rounded-xl bg-bone-2/70 motion-reduce:animate-none">
        <span className="sr-only" role="status">
          Loading your cart
        </span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-bone/50 p-5">
        <p className="font-display text-xl">Not sure yet? Book without picking a piece.</p>
        <p className="mt-2 text-ink-2">Your visit works just as well with an empty cart. Come and look around, sit on a few pieces and choose at the showroom.</p>
        <TLink href="/shop/" className="link-underline mt-3 text-sm font-semibold text-maroon">
          Browse the collection first
        </TLink>
      </div>
    );
  }

  const total = cartTotal(lines);
  return (
    <div>
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <Line key={line.key} line={line} />
        ))}
      </ul>
      <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-mute">
        <p>{total !== null ? `Estimated total ${formatLkr(total)}. Prices are confirmed at your visit.` : 'Prices are confirmed at your visit.'}</p>
        <p>
          Changed your mind? Remove a piece here, or book without any: a visit works just as well with an empty cart.{' '}
          <TLink href="/cart/" className="font-semibold text-maroon underline underline-offset-4">
            Change a colour in your cart
          </TLink>
        </p>
      </div>
    </div>
  );
}
