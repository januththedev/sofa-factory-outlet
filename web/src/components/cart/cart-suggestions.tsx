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
          // A failed lookup leaves the cart usable without suggestions.
        }
        if (request !== latest.current) return;
        answeredFor.current = signature;
        startTransition(() => setFound(next));
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      latest.current += 1;
    };
  }, [enabled, signature]);

  const suggestions = signature
    ? found.filter((item) => !lines.some((line) => line.productId === item.productId))
    : [];
  return { suggestions, pending };
}

type SuggestionTilesProps = {
  suggestions: CartSuggestion[];
  pending: boolean;
  layout: 'drawer' | 'page';
  headingLevel: 2 | 3;
  onAdded?: () => void;
  onNavigate?: () => void;
};

export function SuggestionTiles({
  suggestions,
  pending,
  layout,
  headingLevel,
  onAdded,
  onNavigate,
}: SuggestionTilesProps) {
  const add = useCart((state) => state.add);
  const headingId = useId();
  if (!suggestions.length) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section aria-labelledby={headingId} aria-busy={pending} className="min-w-0">
      <Heading id={headingId} className="font-display text-2xl">Complete the look</Heading>
      <p className="mt-1 text-base text-mute">Colours that go with your cart. Scroll for more pieces.</p>
      <ul
        className={cn(
          'mt-5 grid grid-flow-col auto-cols-[calc((100%_-_0.75rem)/2.3)] gap-3 overflow-x-auto pb-3',
          'snap-x snap-mandatory',
          layout === 'page' && 'lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4',
        )}
      >
        {suggestions.map((item) => {
          const fit = item.image?.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
          return (
            <li key={`${item.productId}:${item.variantId}`} className="flex min-w-0 snap-start flex-col">
              <TLink
                href={item.href}
                data-cursor="view"
                onClick={onNavigate}
                className="block min-h-11"
                aria-label={`${item.name}, ${item.colourName}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-paper">
                  {item.image ? (
                    <Picture
                      data={item.image}
                      alt=""
                      sizes={layout === 'drawer' ? '200px' : '(min-width: 1024px) 20vw, 45vw'}
                      className="block h-full w-full"
                      imgClassName={`h-full w-full ${fit}`}
                    />
                  ) : null}
                </div>
                <p className="mt-3 break-words font-display text-lg leading-snug">{item.name}</p>
              </TLink>
              <p className="mt-1 break-words text-base text-mute">{item.colourName}</p>
              <p className="mt-1 text-base">
                {item.priceMinor === null
                  ? 'Price on request'
                  : `${item.priceFrom ? 'From ' : ''}${formatLkr(item.priceMinor)}`}
              </p>
              <p className="mt-2 text-xs leading-snug text-ink-2">{item.reason}</p>
              <Button
                variant="ghost"
                size="md"
                className="mt-3 min-h-11 w-full px-2"
                aria-label={`Add ${item.name} in ${item.colourName} to your cart`}
                onClick={() => {
                  add(suggestionToLine(item));
                  trackEvent('add_to_cart', {
                    productId: item.productId,
                    variantId: item.variantId,
                    value: { source: 'cart-suggestion' },
                  });
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
