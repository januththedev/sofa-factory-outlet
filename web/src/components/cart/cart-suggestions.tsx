'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { getSuggestionsAction } from '@/app/(site)/cart/actions';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { type CartSuggestion, cartSignature, suggestionToLine, toCartRef } from '@/lib/cart/types';
import { cn } from '@/lib/cn';
import { formatLkr } from '@/lib/money';

const DEBOUNCE_MS = 300;

/**
 * "Complete the look" for the current cart. Asks the server (which asks the colour
 * engine) once the cart has stopped changing for 300 ms, and ignores any answer that
 * belongs to an older cart. `enabled` keeps a closed drawer from asking at all.
 */
export function useCartSuggestions(enabled: boolean) {
  const lines = useCart((state) => state.lines);
  const signature = useCart((state) => cartSignature(state.lines));
  const [found, setFound] = useState<CartSuggestion[]>([]);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);
  const answeredFor = useRef('');

  useEffect(() => {
    if (!enabled || !signature || answeredFor.current === signature) return;
    const request = ++latest.current;
    const timer = window.setTimeout(() => {
      const cart = toCartRef(useCart.getState().lines);
      if (!cart.length) return;
      startTransition(async () => {
        let next: CartSuggestion[] = [];
        try {
          next = await getSuggestionsAction(cart);
        } catch {
          // a failed lookup just means no suggestions this time
        }
        if (request !== latest.current) return; // the cart changed while we waited
        answeredFor.current = signature;
        startTransition(() => setFound(next));
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      latest.current += 1;
    };
  }, [enabled, signature]);

  // Anything already in the cart (just added, say) is not a suggestion any more.
  const suggestions = signature ? found.filter((item) => !lines.some((line) => line.productId === item.productId)) : [];
  return { suggestions, pending };
}

type SuggestionTilesProps = {
  suggestions: CartSuggestion[];
  pending: boolean;
  layout: 'drawer' | 'page';
  /** Heading level of "Complete the look", so the page outline stays in order. */
  headingLevel: 2 | 3;
  /** A tile's Add button disappears with the tile: put focus somewhere sensible. */
  onAdded?: () => void;
  onNavigate?: () => void;
};

/** The "Complete the look" row: up to four colour-matched pieces, each with the reason it goes with the cart. */
export function SuggestionTiles({ suggestions, pending, layout, headingLevel, onAdded, onNavigate }: SuggestionTilesProps) {
  const add = useCart((state) => state.add);
  const headingId = useId();
  if (!suggestions.length) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section aria-labelledby={headingId} aria-busy={pending} className={cn('transition-opacity duration-300', pending && 'opacity-60')}>
      <Heading id={headingId} className="font-display text-2xl">
        Complete the look
      </Heading>
      <p className="mt-1 text-sm text-mute">Pieces in colours that go with what is in your cart.</p>
      <ul className={cn('mt-5 grid gap-x-4 gap-y-7', layout === 'drawer' ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
        {suggestions.map((item) => {
          const fit = item.image?.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
          return (
            <li key={`${item.productId}:${item.variantId}`} className="flex flex-col">
              <TLink href={item.href} data-cursor="view" onClick={onNavigate} className="block" aria-label={`${item.name}, ${item.colourName}`}>
                <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-paper">
                  {item.image ? (
                    <Picture data={item.image} alt="" sizes={layout === 'drawer' ? '200px' : '(min-width: 1024px) 20vw, 45vw'} className="block h-full w-full" imgClassName={`h-full w-full ${fit}`} />
                  ) : null}
                </div>
                <p className="mt-3 font-display text-lg leading-snug">{item.name}</p>
              </TLink>
              <p className="mt-1 flex items-center gap-2 text-sm text-mute">
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: item.hex }} />
                {item.colourName}
              </p>
              <p className="mt-0.5 text-sm">{item.priceMinor === null ? 'Price on request' : `${item.priceFrom ? 'From ' : ''}${formatLkr(item.priceMinor)}`}</p>
              <p className="mt-2 text-xs leading-snug text-ink-2">{item.reason}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 self-start"
                aria-label={`Add ${item.name} in ${item.colourName} to your cart`}
                onClick={() => {
                  add(suggestionToLine(item));
                  trackEvent('add_to_cart', { productId: item.productId, variantId: item.variantId, value: { source: 'cart-suggestion' } });
                  onAdded?.();
                }}
              >
                Add
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
