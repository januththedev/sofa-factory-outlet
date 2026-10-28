'use client';

// Compact product cards rendered under a streaming answer: photo, name, price
// ("Price on request" when the record has none), the product link and Add to
// cart — the same cart the rest of the site uses.

import { TLink } from '@/components/site/transition';
import { Picture } from '@/components/picture';
import type { ProductCard } from '@/lib/catalogue/queries';
import { useCart } from '@/lib/cart/store';
import { formatLkr } from '@/lib/money';
import { cn } from '@/lib/cn';

/** Adds a catalogue card to the browser cart, choosing the requested colour when there is one. */
export function addCardToCart(card: ProductCard, variantId?: number): void {
  const chosen = (variantId !== undefined ? card.colours.find((colour) => colour.id === variantId) : undefined) ?? card.colours[0];
  if (!chosen) return; // no colour snapshot to keep the cart line readable
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

/** One row in the "cards" stream of the assistant's reply. */
export function ChatProductCard({ card }: { card: ProductCard }) {
  const canAdd = card.colours.length > 0;
  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-paper p-2">
      <div className="flex gap-2.5">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-bone">
          {card.image ? (
            <Picture
              data={card.image}
              sizes="56px"
              alt={card.name}
              className="absolute inset-0"
              imgClassName={cn('h-full w-full', card.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover')}
            />
          ) : (
            <div className="absolute inset-0 bg-clay-soft" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <TLink
            href={card.href}
            className="line-clamp-2 text-xs font-semibold leading-snug text-ink transition-colors hover:text-maroon"
          >
            {card.name}
          </TLink>
          <p className="mt-0.5 text-[0.68rem] text-mute">{priceLabel(card.priceMinor, card.priceFrom)}</p>
        </div>
      </div>
      {canAdd ? (
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={() => addCardToCart(card)}
            className="rounded-full border border-ink/20 px-2.5 py-1 text-[0.68rem] font-semibold text-ink transition-colors hover:border-maroon hover:bg-maroon hover:text-bone"
          >
            Add to cart
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** Assistant product cards, most relevant first. */
export function ChatProductCards({ cards }: { cards: ProductCard[] }) {
  return (
    <div className="flex flex-col gap-2">
      {cards.map((card) => (
        <ChatProductCard key={`${card.id}-${card.colours[0]?.id ?? 'img'}`} card={card} />
      ))}
    </div>
  );
}
