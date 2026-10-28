// Browser helpers for the chat widget (Plan.md "Chatbot → In the interface"):
// reads the NDJSON event stream that POST /api/chat/ streams and prepares the
// anonymous visitor + session ids every request needs. Imports the server
// contract's types only — never the server functions.

import type { ChatEvent, ChatRequest, QuickReply } from './api';
import type { ProductCard } from '../catalogue/queries';
import type { PictureData } from '../images/urls';
import { getVisitorIds } from '../analytics/client';

const ANSWERED_BY = ['faq', 'template', 'model', 'handoff', 'fallback'] as const;
type AnsweredBy = (typeof ANSWERED_BY)[number];

const CHIP_ACTIONS = ['send', 'add_to_cart', 'book_visit', 'whatsapp', 'link'] as const;
type ChipAction = (typeof CHIP_ACTIONS)[number];

export type ChatIds = { visitorId: string; sessionId: string };

/** Anonymous visitor + session ids to send with every chat request. */
export function chatSessionIds(): ChatIds {
  return getVisitorIds();
}

/* ------------------------------------------------------------------ */
/* Defensive parsing: a bad line never breaks the stream.              */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePicture(value: unknown): PictureData | null {
  if (!isRecord(value)) return null;
  const avifSrcSet = asString(value['avifSrcSet']);
  const webpSrcSet = asString(value['webpSrcSet']);
  const src = asString(value['src']);
  const width = asNumber(value['width']);
  const height = asNumber(value['height']);
  if (!avifSrcSet || !webpSrcSet || !src || width === null || height === null) return null;
  const picture: PictureData = {
    avifSrcSet,
    webpSrcSet,
    src,
    width,
    height,
    alt: typeof value['alt'] === 'string' ? value['alt'] : '',
    cutout: value['cutout'] === true,
  };
  const blur = asString(value['blur']);
  if (blur) picture.blur = blur;
  const dominant = asString(value['dominant']);
  if (dominant) picture.dominant = dominant;
  return picture;
}

function parseColour(value: unknown): ProductCard['colours'][number] | null {
  if (!isRecord(value)) return null;
  const id = asNumber(value['id']);
  const name = asString(value['name']);
  const hex = asString(value['hex']);
  if (id === null || !name || !hex) return null;
  return { id, name, hex, family: asString(value['family']) ?? '', image: parsePicture(value['image']) };
}

function parseCard(value: unknown): ProductCard | null {
  if (!isRecord(value)) return null;
  const id = asNumber(value['id']);
  const name = asString(value['name']);
  const slug = asString(value['slug']);
  if (id === null || !name) return null;
  const href = asString(value['href']) ?? (slug ? `/product/${slug}/` : null);
  if (!href) return null;
  const category = isRecord(value['category']) ? value['category'] : null;
  const colours = Array.isArray(value['colours'])
    ? (value['colours'] as unknown[]).flatMap((entry) => {
        const colour = parseColour(entry);
        return colour ? [colour] : [];
      })
    : [];
  const card: ProductCard = {
    id,
    slug: slug ?? '',
    name,
    href,
    category: {
      name: category && typeof category['name'] === 'string' ? category['name'] : '',
      path: category && typeof category['path'] === 'string' ? category['path'] : '',
    },
    priceMinor: asNumber(value['priceMinor']),
    priceFrom: value['priceFrom'] === true,
    featured: value['featured'] === true,
    isNew: value['isNew'] === true,
    shape: asString(value['shape']),
    material: asString(value['material']),
    seats: asNumber(value['seats']),
    colours,
    image: parsePicture(value['image']),
    hoverImage: null,
  };
  return card;
}

function parseChip(value: unknown): QuickReply | null {
  if (!isRecord(value)) return null;
  const label = asString(value['label']);
  const action = value['action'];
  if (!label || typeof action !== 'string') return null;
  const known = CHIP_ACTIONS.includes(action as ChipAction);
  if (!known) return null;
  const chip: QuickReply = { label, action: action as ChipAction };
  const payload = asString(value['payload']);
  if (payload) chip.payload = payload;
  return chip;
}

/** Parses one NDJSON line into a ChatEvent, or null when the line is blank, malformed or unknown. */
function parseLine(line: string): ChatEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  switch (value['type']) {
    case 'meta': {
      const conversationId = asNumber(value['conversationId']);
      if (conversationId === null) return null;
      const answeredBy = value['answeredBy'];
      return {
        type: 'meta',
        conversationId,
        intent: typeof value['intent'] === 'string' ? value['intent'] : '',
        answeredBy: ANSWERED_BY.includes(answeredBy as AnsweredBy) ? (answeredBy as AnsweredBy) : 'fallback',
      };
    }
    case 'delta': {
      const text = value['text'];
      if (typeof text !== 'string' || !text.length) return null;
      return { type: 'delta', text };
    }
    case 'cards': {
      if (!Array.isArray(value['products'])) return null;
      const products = (value['products'] as unknown[]).flatMap((entry) => {
        const card = parseCard(entry);
        return card ? [card] : [];
      });
      return products.length ? { type: 'cards', products } : null;
    }
    case 'chips': {
      if (!Array.isArray(value['items'])) return null;
      const items = (value['items'] as unknown[]).flatMap((entry) => {
        const chip = parseChip(entry);
        return chip ? [chip] : [];
      });
      return items.length ? { type: 'chips', items } : null;
    }
    case 'handoff': {
      const whatsappUrl = asString(value['whatsappUrl']);
      if (!whatsappUrl || !/^https?:\/\//i.test(whatsappUrl)) return null;
      return { type: 'handoff', whatsappUrl };
    }
    case 'done': {
      const messageId = asNumber(value['messageId']);
      return messageId === null ? null : { type: 'done', messageId };
    }
    case 'error': {
      return { type: 'error', message: typeof value['message'] === 'string' ? value['message'] : '' };
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* The stream                                                          */
/* ------------------------------------------------------------------ */

/**
 * Reads a response body as NDJSON (one JSON value per line) and yields the
 * parsed ChatEvents. Handles partial chunks, blank lines, malformed lines and
 * a final line without a trailing newline; malformed lines are skipped. When
 * `signal` aborts, the stream is cancelled and no further events come out.
 */
export async function* readNdjson(response: Response, signal?: AbortSignal): AsyncGenerator<ChatEvent, void, void> {
  if (signal?.aborted) return;
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const event = parseLine(line);
        if (event) {
          if (signal?.aborted) return;
          yield event;
        }
      }
    }
    buffer += decoder.decode(); // flush any multi-byte tail
    const last = parseLine(buffer); // a final line still parses without its newline
    if (last && !signal?.aborted) yield last;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

const GENERIC_ERROR =
  "I couldn't reach the assistant just now. Try again, or talk to a person on WhatsApp.";

/**
 * Sends one message to POST /api/chat/ and yields the ChatEvents it streams.
 * HTTP errors, rate limits and network failures arrive as a single `error`
 * event so the widget can always render a fallback; aborted requests stop
 * quietly without yielding anything.
 */
export async function* sendChat(request: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatEvent, void, void> {
  if (signal.aborted) return;
  let response: Response;
  try {
    response = await fetch('/api/chat/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
      body: JSON.stringify(request),
      signal,
      cache: 'no-store',
    });
  } catch {
    if (signal.aborted) return;
    yield { type: 'error', message: GENERIC_ERROR };
    return;
  }
  if (!response.ok) {
    let message =
      response.status === 429
        ? 'That was a lot of messages in a short while. Try again in a few minutes, or talk to a person on WhatsApp.'
        : GENERIC_ERROR;
    try {
      const data: unknown = await response.json();
      if (isRecord(data) && typeof data['error'] === 'string' && data['error']) message = data['error'];
    } catch {
      // keep the generic message when the body is not JSON
    }
    if (signal.aborted) return;
    yield { type: 'error', message };
    return;
  }
  yield* readNdjson(response, signal);
}
