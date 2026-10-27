import { notImplemented } from '../not-implemented';
import type { CartRef } from '../cart/types';
import type { ProductCard } from '../catalogue/queries';

// CONTRACT STUB. Owner: "chat-pipeline" agent. Keep these exports and signatures.
// The widget (src/components/chat) consumes the NDJSON stream of ChatEvent from POST /api/chat/.

export type ChatContextInput = { page?: string; productId?: number; variantId?: number; cart?: CartRef };

export type ChatRequest = { visitorId: string; sessionId: string; message: string; context?: ChatContextInput };

export type QuickReply = { label: string; action: 'send' | 'add_to_cart' | 'book_visit' | 'whatsapp' | 'link'; payload?: string };

export type ChatEvent =
  | { type: 'meta'; conversationId: number; intent: string; answeredBy: 'faq' | 'template' | 'model' | 'handoff' | 'fallback' }
  | { type: 'delta'; text: string }
  | { type: 'cards'; products: ProductCard[] }
  | { type: 'chips'; items: QuickReply[] }
  | { type: 'handoff'; whatsappUrl: string }
  | { type: 'done'; messageId: number }
  | { type: 'error'; message: string };

/**
 * Plan.md "What happens to each message": normalise → instant FAQ → intent →
 * extract → retrieve → confidence gate → strict prompt → model (streamed, with
 * fallback models and a timeout) → answer guard → cards + chips → log.
 * Most messages never call the model. Never throws: failures become an `error`
 * event followed by the honest WhatsApp hand-off.
 */
export const runChat: (request: ChatRequest) => AsyncGenerator<ChatEvent> = async function* () {
  notImplemented('runChat');
};

/** Rate-limit check used by the route before running: 20 messages per visitor per 10 minutes. */
export const chatRateLimited: (visitorId: string) => Promise<boolean> = async () => notImplemented('chatRateLimited');
