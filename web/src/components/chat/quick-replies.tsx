'use client';

// Quick-reply chips under an assistant message. The `action` values come from
// the chat contract; unresolvable payloads fall back to sending the text so
// the bot can sort it out.

import { useRouter } from 'next/navigation';
import type { QuickReply } from '@/lib/chat/api';
import type { ProductCard } from '@/lib/catalogue/queries';
import { cn } from '@/lib/cn';
import { addCardToCart } from './product-cards';
import { talkToAPerson } from './chat-store';

type AddTarget = { productId: number; variantId?: number };

/** Payload shapes seen in the wild: "12:34", a bare id, or a small JSON object. */
function parseAddTarget(payload: string | undefined): AddTarget | null {
  if (!payload) return null;
  const trimmed = payload.trim();
  const pair = /^(\d+):(\d+)?$/.exec(trimmed);
  if (pair) {
    const productId = Number(pair[1]);
    const variantId = pair[2] ? Number(pair[2]) : undefined;
    if (Number.isFinite(productId)) return variantId === undefined ? { productId } : { productId, variantId };
  }
  const bare = /^(\d+)$/.exec(trimmed);
  if (bare) {
    const only = Number(bare[1]);
    return Number.isFinite(only) ? { productId: only } : null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const productId = typeof record['productId'] === 'number' ? record['productId'] : null;
      if (productId === null) return null;
      const variantId = typeof record['variantId'] === 'number' ? record['variantId'] : undefined;
      return variantId === undefined ? { productId } : { productId, variantId };
    }
  } catch {
    // not JSON — fall through
  }
  return null;
}

function findCard(cards: ProductCard[], target: AddTarget): ProductCard | undefined {
  return cards.find(
    (card) => card.id === target.productId && (target.variantId === undefined || card.colours.some((colour) => colour.id === target.variantId)),
  );
}

export function QuickReplies({
  items,
  cards,
  disabled = false,
  onSend,
}: {
  items: QuickReply[];
  cards: ProductCard[];
  disabled?: boolean;
  onSend: (text: string) => void;
}) {
  const router = useRouter();

  const handle = (chip: QuickReply) => {
    if (disabled) return;
    const fallbackText = chip.payload ?? chip.label;
    switch (chip.action) {
      case 'send':
        onSend(fallbackText);
        break;
      case 'add_to_cart': {
        const target = parseAddTarget(chip.payload);
        const card = target ? findCard(cards, target) : undefined;
        if (card && target) addCardToCart(card, target.variantId);
        else onSend(fallbackText);
        break;
      }
      case 'book_visit':
        router.push('/book-visit/');
        break;
      case 'whatsapp':
        talkToAPerson(null); // the server's prefilled link arrives with the hand-off event
        break;
      case 'link': {
        const href = chip.payload;
        if (!href) {
          onSend(chip.label);
          break;
        }
        if (href.startsWith('/')) router.push(href);
        else window.open(href, '_blank', 'noopener,noreferrer');
        break;
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((chip, index) => (
        <button
          key={`${chip.action}-${chip.label}-${index}`}
          type="button"
          disabled={disabled}
          onClick={() => handle(chip)}
          className={cn(
            'rounded-full border border-ink/15 bg-bone px-2.5 py-1 text-[0.72rem] font-semibold text-ink',
            'transition-colors duration-150 hover:border-maroon hover:bg-maroon hover:text-bone disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
