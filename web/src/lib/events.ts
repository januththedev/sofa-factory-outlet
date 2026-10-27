import type { CartRef } from './cart/types';

// Tiny window-event bus so parts of the site that don't know about each other can talk:
// the product page and cart ask the chat widget to open; the widget listens.

export const CHAT_OPEN_EVENT = 'sfo:chat-open';

export type ChatOpenDetail = {
  productId?: number;
  variantId?: number;
  /** what the visitor has in the cart, so the bot can pair pieces */
  cart?: CartRef;
  /** the cart page opens the chat with a colour-matching nudge built from the same suggestions */
  nudge?: boolean;
  /** send this as the first message */
  message?: string;
};

/** Open the chat widget (client only). */
export function openChat(detail: ChatOpenDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ChatOpenDetail>(CHAT_OPEN_EVENT, { detail }));
}
