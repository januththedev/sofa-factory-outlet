'use client';

import { TLink } from '@/components/site/transition';
import { Picture } from '@/components/picture';
import type { ProductCard } from '@/lib/catalogue/queries';
import { useCart } from '@/lib/cart/store';
import { formatLkr } from '@/lib/money';
import { cn } from '@/lib/cn';
import { useChatStore } from './chat-store';

/** Adds a catalogue card to the cart, choosing the requested colour when there is one. */
export function addCardToCart(card: ProductCard, variantId?: number): void {
  const requested = variantId === undefined ? undefined : card.colours.find((colour) => colour.id === variantId);
  const chosen = requested ?? card.colours[0];
  if (!chosen) return;
  useChatStore.getState().close();
  useCart.getState().add({
    productId: card.id,
    variantId: chosen.id,
    slug: card.slug,
    name: card.name,
    colourName: chosen.name,
    hex: chosen.hex,
    image: chosen.image ?? card.image,
    priceMinor: card.priceMinor,
  });
}

function priceLabel(priceMinor: number | null, priceFrom: boolean): string {
  if (!priceMinor) return 'Price on request';
  return `${priceFrom ? 'From ' : ''}${formatLkr(priceMinor)}`;
}

export function ChatProductCard({ card }: { card: ProductCard }) {
  const canAdd = card.colours.length > 0;
  return (
    <article className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper p-3">
      <TLink
        href={card.href}
        onClick={() => useChatStore.getState().close()}
        className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg hover:text-maroon"
      >
        <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-bone">
          {card.image ? (
            <Picture
              data={card.image}
              sizes="72px"
              alt=""
              className="absolute inset-0"
              imgClassName={cn(
                'h-full w-full',
                card.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover',
              )}
            />
          ) : (
            <span className="absolute inset-0 bg-clay-soft" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-base font-semibold leading-snug">{card.name}</span>
          <span className="mt-1 block text-sm text-mute">{priceLabel(card.priceMinor, card.priceFrom)}</span>
        </span>
      </TLink>
      {canAdd ? (
        <button
          type="button"
          onClick={() => addCardToCart(card)}
          className="mt-2 min-h-11 w-full rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold
            text-ink transition-colors hover:border-maroon hover:bg-maroon hover:text-bone"
        >
          Add to cart
        </button>
      ) : null}
    </article>
  );
}

export function ChatProductCards({ cards }: { cards: ProductCard[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {cards.map((card) => (
        <ChatProductCard key={`${card.id}-${card.colours[0]?.id ?? 'img'}`} card={card} />
      ))}
    </div>
  );
}
