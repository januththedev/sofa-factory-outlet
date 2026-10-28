import { and, eq, gte, sql } from 'drizzle-orm';
import type { CartRef } from '../cart/types';
import type { ProductCard } from '../catalogue/queries';
import { getDb } from '../db';
import * as s from '../db/schema';

export type ChatContextInput = {
  page?: string;
  productId?: number;
  variantId?: number;
  cart?: CartRef;
};

export type ChatRequest = {
  visitorId: string;
  sessionId: string;
  message: string;
  context?: ChatContextInput;
};

export type QuickReply = {
  label: string;
  action: 'send' | 'add_to_cart' | 'book_visit' | 'whatsapp' | 'link';
  payload?: string;
};

export type ChatEvent =
  | {
      type: 'meta';
      conversationId: number;
      intent: string;
      answeredBy: 'faq' | 'template' | 'model' | 'handoff' | 'fallback';
    }
  | { type: 'delta'; text: string }
  | { type: 'cards'; products: ProductCard[] }
  | { type: 'chips'; items: QuickReply[] }
  | { type: 'handoff'; whatsappUrl: string }
  | { type: 'done'; messageId: number }
  | { type: 'error'; message: string };

export const runChat: (request: ChatRequest) => AsyncGenerator<ChatEvent> = async function* (request) {
  try {
    const { pipeline } = await import('./pipeline');
    yield* pipeline(request);
  } catch {
    yield { type: 'error', message: 'Chat is temporarily unavailable.' };
    yield { type: 'delta', text: "I'm unable to check that right now. Please try again shortly." };
    yield { type: 'done', messageId: 0 };
  }
};

export const chatRateLimited: (visitorId: string) => Promise<boolean> = async (visitorId) => {
  try {
    const db = await getDb();
    const since = new Date(Date.now() - 600_000);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.chatMessages)
      .innerJoin(s.chatConversations, eq(s.chatMessages.conversationId, s.chatConversations.id))
      .where(and(
        eq(s.chatConversations.visitorId, visitorId),
        eq(s.chatMessages.role, 'user'),
        gte(s.chatMessages.createdAt, since),
      ));
    return (row?.count ?? 0) >= 20;
  } catch {
    return false;
  }
};
