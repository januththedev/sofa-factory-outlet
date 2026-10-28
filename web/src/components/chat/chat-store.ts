'use client';

// Chat widget state (Plan.md "Chatbot → In the interface"): a zustand store so
// the floating button, the panel and integrations can share the conversation
// without threading props. The conversation lives for the browser session in
// sessionStorage (messages, conversation id and the latest WhatsApp hand-off
// link); nothing personal beyond what the visitor typed is stored.

import { create } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import { useCart } from '@/lib/cart/store';
import { toCartRef } from '@/lib/cart/types';
import type { CartRef } from '@/lib/cart/types';
import { trackEvent } from '@/lib/analytics/client';
import type { ChatOpenDetail } from '@/lib/events';
import type { ChatEvent, ChatRequest, QuickReply } from '@/lib/chat/api';
import type { ProductCard } from '@/lib/catalogue/queries';
import { chatSessionIds } from '@/lib/chat/client';
import { sendChat } from '@/lib/chat/client';

const MAX_MESSAGE_LENGTH = 600;
const PERSIST_KEY = 'sfo-chat-v1';
let confirmedWhatsApp: string | null = null;

/** The site layout supplies a link only when the owner has confirmed the number. */
export function configureChatWhatsApp(link: string | null): void {
  confirmedWhatsApp = link;
}

export const WELCOME_TEXT =
  "Ask me about sofas, colours, sizes or booking a visit. I'm an automated assistant; " +
  'you can also ask to talk to a person.';

export const DEFAULT_ERROR_TEXT =
  "Sorry — that didn't come through. Try again, or talk to a person on WhatsApp.";

const STARTER_CHIPS: QuickReply[] = [
  { label: 'Show me the sofas', action: 'send', payload: 'Show me your sofas' },
  { label: 'Book a visit', action: 'book_visit' },
  { label: 'Talk to a person', action: 'whatsapp' },
];

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  streaming?: boolean;
  error?: string;
  cards?: ProductCard[];
  chips?: QuickReply[];
  handoffUrl?: string;
  messageId?: number;
  rating?: 1 | -1;
};

export type ChatStore = {
  open: boolean;
  messages: ChatMessage[];
  conversationId: number | null;
  /** true while a reply is being streamed */
  streaming: boolean;
  /** "Asking about: <name>" — the product on screen when an integration opened the widget */
  askAbout: string | null;
  productId: number | null;
  variantId: number | null;
  /** cart snapshot passed along by the integration that opened the widget */
  cartOverride: CartRef | null;
  /** latest WhatsApp link the server offered for human hand-off */
  handoffUrl: string | null;

  openPanel: (detail?: ChatOpenDetail) => void;
  close: () => void;
  send: (text: string) => Promise<void>;
  retry: (assistantMessageId: string) => Promise<void>;
  rate: (messageId: number, rating: 1 | -1) => void;
  /** stops an in-flight reply; used on close and unmount */
  abort: () => void;
};

let activeController: AbortController | null = null;
let sequence = 0;
const nextId = () => `m${Date.now().toString(36)}-${(sequence++).toString(36)}`;

function foldMessage(
  state: ChatStore,
  assistantId: string,
  patch: (message: ChatMessage) => ChatMessage,
): Partial<ChatStore> {
  let touched = false;
  const messages = state.messages.map((message) => {
    if (message.id !== assistantId) return message;
    touched = true;
    return patch(message);
  });
  return touched ? { messages } : {};
}

function foldEvent(state: ChatStore, assistantId: string, event: ChatEvent): Partial<ChatStore> {
  switch (event.type) {
    case 'meta':
      return { conversationId: event.conversationId };
    case 'delta':
      return foldMessage(state, assistantId, (message) => ({ ...message, text: message.text + event.text }));
    case 'cards': {
      const colourKey = (card: ProductCard) => `${card.id}:${card.colours[0]?.id ?? ''}`;
      return foldMessage(state, assistantId, (message) => {
        const seen = new Set((message.cards ?? []).map(colourKey));
        const cards = [...(message.cards ?? []), ...event.products.filter((card) => !seen.has(colourKey(card)))];
        return { ...message, cards };
      });
    }
    case 'chips':
      return foldMessage(state, assistantId, (message) => ({ ...message, chips: event.items }));
    case 'handoff':
      return {
        handoffUrl: event.whatsappUrl,
        ...foldMessage(state, assistantId, (message) => ({ ...message, handoffUrl: event.whatsappUrl })),
      };
    case 'done':
      return foldMessage(state, assistantId, (message) => ({ ...message, messageId: event.messageId }));
    case 'error':
      return foldMessage(state, assistantId, (message) =>
        message.error ? message : { ...message, error: event.message || DEFAULT_ERROR_TEXT },
      );
  }
}

function welcomeMessage(): ChatMessage {
  return { id: nextId(), role: 'assistant', text: WELCOME_TEXT, at: Date.now(), chips: STARTER_CHIPS };
}

/** "Ask about this sofa" carries the product id; the readable name comes from the page URL when there is one. */
function productSlugFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = /\/product\/([a-z0-9-]+)\/?/i.exec(window.location.pathname);
  const slug = match?.[1];
  return slug ? slug : null;
}

const slugLabel = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Confirmed WhatsApp link for a hand-off before the server has sent one. */
export function chatWhatsAppFallback(text?: string): string | null {
  if (!confirmedWhatsApp) return null;
  return `${confirmedWhatsApp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function lastUserMessage(state: ChatStore): ChatMessage | null {
  for (let index = state.messages.length - 1; index >= 0; index--) {
    const message = state.messages[index];
    if (message?.role === 'user') return message;
  }
  return null;
}

/** Opens WhatsApp with a summary of the chat filled in; records the click. */
export function talkToAPerson(whatsappUrl: string | null): void {
  if (typeof window === 'undefined') return;
  const summary = lastUserMessage(useChatStore.getState())?.text ?? '';
  const text = summary
    ? 'Hi! I was just chatting with the site assistant and would like to talk to a person. ' +
      `Last message: "${summary.slice(0, 300)}"`
    : 'Hi! I would like to talk to a person at the showroom.';
  const url = confirmedWhatsApp ? whatsappUrl ?? chatWhatsAppFallback(text) : null;
  if (!url) {
    void useChatStore.getState().send('talk to a person');
    return;
  }
  trackEvent('whatsapp_click');
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildRequest(text: string, state: ChatStore): ChatRequest {
  const cart = state.cartOverride ?? toCartRef(useCart.getState().lines);
  const { visitorId, sessionId } = chatSessionIds();
  return {
    visitorId,
    sessionId,
    message: text,
    context: {
      page: typeof window === 'undefined' ? undefined : window.location.pathname,
      productId: state.productId ?? undefined,
      variantId: state.productId === null ? undefined : (state.variantId ?? undefined),
      cart: cart.length ? cart : undefined,
    },
  };
}

/** Streams the events for one assistant placeholder message. */
async function runTurn(text: string, assistantId: string, controller: AbortController): Promise<void> {
  const request = buildRequest(text, useChatStore.getState());
  try {
    for await (const event of sendChat(request, controller.signal)) {
      if (activeController !== controller || controller.signal.aborted) return; // ignore events after abort
      useChatStore.setState((state) => foldEvent(state, assistantId, event));
    }
  } catch {
    if (activeController === controller && !controller.signal.aborted) {
      useChatStore.setState((state) => foldEvent(state, assistantId, { type: 'error', message: '' }));
    }
  } finally {
    if (activeController === controller) {
      activeController = null;
      useChatStore.setState((state) => ({
        streaming: false,
        messages: state.messages.map((message) =>
          message.id === assistantId && message.streaming
            ? message.text || (message.cards?.length ?? 0) > 0 || message.error
              ? { ...message, streaming: false }
              : { ...message, streaming: false, error: DEFAULT_ERROR_TEXT }
            : message,
        ),
      }));
    }
  }
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      open: false,
      messages: [],
      conversationId: null,
      streaming: false,
      askAbout: null,
      productId: null,
      variantId: null,
      cartOverride: null,
      handoffUrl: null,

      openPanel: (detail = {}) => {
        trackEvent('chat_open');
        const hasProduct = typeof detail.productId === 'number';
        const slug = hasProduct ? productSlugFromPath() : null;
        const auto = detail.message ?? (detail.nudge ? 'What goes well with what I have in my cart?' : null);
        if (!get().open) {
          set((state) => ({
            open: true,
            // a plain open means the visitor moved on: drop inherited product context
            askAbout: null,
            productId: null,
            variantId: null,
            cartOverride: null,
            messages: state.messages.length === 0 ? [welcomeMessage()] : state.messages,
          }));
        }
        if (hasProduct || detail.cart?.length) {
          set((state) => ({
            productId: hasProduct ? (detail.productId ?? null) : state.productId,
            variantId: hasProduct ? (detail.variantId ?? null) : state.variantId,
            askAbout: hasProduct && slug ? `Asking about: ${slugLabel(slug)}` : null,
            cartOverride: detail.cart?.length ? detail.cart : state.cartOverride,
          }));
        }
        if (auto && !get().streaming) void get().send(auto);
      },

      close: () => {
        set({ open: false });
        activeController?.abort();
      },

      send: async (text) => {
        const body = text.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!body || get().streaming || activeController) return;
        const controller = new AbortController();
        activeController = controller;
        const now = Date.now();
        const assistantId = nextId();
        set((state) => ({
          messages: [
            ...state.messages,
            { id: nextId(), role: 'user', text: body, at: now },
            { id: assistantId, role: 'assistant' as const, text: '', at: now, streaming: true },
          ],
          streaming: true,
          cartOverride: null, // one shot: the live cart takes over for later messages
        }));
        trackEvent('chat_message');
        await runTurn(body, assistantId, controller);
      },

      retry: async (assistantMessageId) => {
        if (get().streaming || activeController) return;
        const state = get();
        const index = state.messages.findIndex((message) => message.id === assistantMessageId);
        const previous = index > 0 ? state.messages[index - 1] : undefined;
        if (index < 0 || previous?.role !== 'user') return;
        const text = previous.text.slice(0, MAX_MESSAGE_LENGTH);
        const controller = new AbortController();
        activeController = controller;
        set((current) => ({
          messages: current.messages.map((message) =>
            message.id === assistantMessageId
              ? { id: message.id, role: 'assistant', text: '', at: message.at, streaming: true }
              : message,
          ),
          streaming: true,
        }));
        trackEvent('chat_message');
        await runTurn(text, assistantMessageId, controller);
      },

      rate: async (messageId, rating) => {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.messageId === messageId ? { ...message, rating } : message,
          ),
        }));
        try {
          await fetch('/api/chat/feedback/', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageId, rating }),
            keepalive: true,
          });
        } catch {
          // feedback must never break the chat
        }
      },

      abort: () => {
        activeController?.abort();
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        messages: state.messages,
        conversationId: state.conversationId,
        handoffUrl: state.handoffUrl,
      }),
      skipHydration: true,
    },
  ),
);
