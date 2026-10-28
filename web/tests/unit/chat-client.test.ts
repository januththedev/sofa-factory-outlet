// tests for the browser chat client: NDJSON parsing (chunk boundaries, blank
// and malformed lines, unterminated last lines), transport error handling and
// abort behaviour. fetch is mocked with ReadableStream bodies.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatEvent } from '@/lib/chat/api';
import { readNdjson, sendChat } from '@/lib/chat/client';

const encoder = new TextEncoder();

const encodeLine = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);

type ChatRequestish = { visitorId: string; sessionId: string; message: string; context?: unknown };

const sampleRequest = { visitorId: 'visit-1', sessionId: 'session-1', message: 'Hello there' };

function streamResponse(chunks: Array<Uint8Array>, options: { status?: number; body?: string } = {}): Response {
  if (options.body !== undefined) return new Response(options.body, { status: options.status ?? 200 });
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { status: options.status ?? 200, headers: { 'content-type': 'application/x-ndjson' } },
  );
}

async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readNdjson', () => {
  it('parses events split across chunk boundaries', async () => {
    const meta = { type: 'meta', conversationId: 7, intent: 'find_products', answeredBy: 'template' };
    const chips = { type: 'chips', items: [{ label: 'Book a visit', action: 'book_visit' }] };
    const bytes = encoder.encode(`${JSON.stringify(meta)}\n${JSON.stringify(chips)}\n`);
    const split = bytes.length - 25; // cuts into the second event line
    const response = streamResponse([bytes.subarray(0, split), bytes.subarray(split)]);

    const events = await collect(readNdjson(response));
    expect(events).toEqual([
      { type: 'meta', conversationId: 7, intent: 'find_products', answeredBy: 'template' },
      { type: 'chips', items: [{ label: 'Book a visit', action: 'book_visit' }] },
    ]);
  });

  it('skips blank and malformed lines and lines that are not chat events', async () => {
    const payload =
      '\n   \nnot json at all\n{"broken\n{"error":"an object without a type"}\n{"type":"wat","text":"??"}\n{"type":"delta","text":"Here you go"}\n{"type":"cards","products":[]}\n\n';
    const response = streamResponse([encoder.encode(payload)]);

    const events = await collect(readNdjson(response));
    expect(events).toEqual([{ type: 'delta', text: 'Here you go' }]);
  });

  it('drops cards and chips entries it cannot read but keeps the rest', async () => {
    const line = JSON.stringify({
      type: 'cards',
      products: [
        { id: 3, slug: 'green-l-shape', name: 'Green L-shape', href: '/product/green-l-shape/', priceMinor: null, priceFrom: false, colours: [] },
        { nope: true },
        { id: 'x', name: 'Broken' },
        {
          id: 9,
          slug: 'grey-3-2',
          name: 'Grey 3+2',
          image: { avifSrcSet: 'a 100w', webpSrcSet: 'b 100w', src: '/blob/9/100.webp', width: 100, height: 80, alt: 'Grey sofa', cutout: true },
          colours: [{ id: 21, name: 'Pewter', hex: '77777', family: 'grey', image: null }],
        },
      ],
    });
    const response = streamResponse([encoder.encode(`${line}\n`)]);

    const events = await collect(readNdjson(response));
    expect(events).toHaveLength(1);
    const [cardsEvent] = events;
    expect(cardsEvent?.type).toBe('cards');
    if (cardsEvent?.type !== 'cards') return;
    expect(cardsEvent.products).toHaveLength(2);
    expect(cardsEvent.products[0]?.slug).toBe('green-l-shape');
    expect(cardsEvent.products[1]?.image?.src).toBe('/blob/9/100.webp');
    expect(cardsEvent.products[1]?.colours[0]?.hex).toBe('77777');
  });

  it('parses a final line that has no trailing newline', async () => {
    const response = streamResponse([encoder.encode('{"type":"done","messageId":42}')]);
    const events = await collect(readNdjson(response));
    expect(events).toEqual([{ type: 'done', messageId: 42 }]);
  });

  it('rejoins multi-byte characters split across chunks', async () => {
    const delta = { type: 'delta', text: 'Sofa set රුපියල්' };
    const asciiPrefix = '{"type":"delta","text":"Sofa set ';
    const cut = encoder.encode(asciiPrefix).length + 1; // lands inside the UTF-8 encoding of ර
    const bytes = encoder.encode(`${JSON.stringify(delta)}\n`);
    const response = streamResponse([bytes.subarray(0, cut), bytes.subarray(cut)]);

    const events = await collect(readNdjson(response));
    expect(events).toEqual([delta]);
  });

  it('ignores events that arrive after the signal aborts', async () => {
    const meta = { type: 'meta', conversationId: 1, intent: 'faq', answeredBy: 'faq' };
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encodeLine(meta));
          c.enqueue(encodeLine({ type: 'delta', text: 'buffered before the abort' }));
        },
      }),
      { status: 200, headers: { 'content-type': 'application/x-ndjson' } },
    );
    const ac = new AbortController();
    const events = readNdjson(response, ac.signal);

    const first = await events.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual(meta);

    ac.abort();

    const rest = await events.next();
    expect(rest.done).toBe(true);
    expect(rest.value).toBeUndefined();
  });

  it('yields nothing when the body is empty', async () => {
    const response = streamResponse([encoder.encode('')]);
    const events = await collect(readNdjson(response));
    expect(events).toEqual([]);
  });
});

describe('sendChat', () => {
  it('POSTs the request to /api/chat/ and streams the parsed events', async () => {
    const expected: ChatEvent[] = [
      { type: 'meta', conversationId: 9, intent: 'find_products', answeredBy: 'template' },
      { type: 'delta', text: 'Here are three green L-shape sofas.' },
      { type: 'done', messageId: 77 },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('/api/chat/');
      const body = JSON.parse(String(init?.body)) as ChatRequestish;
      expect(body).toEqual({
        visitorId: 'visit-1',
        sessionId: 'session-1',
        message: sampleRequest.message,
      });
      return streamResponse(expected.map(encodeLine));
    });
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect(sendChat(sampleRequest, new AbortController().signal));
    expect(events).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the context, visitor ids, content type and NDJSON accept header', async () => {
    let seenInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return streamResponse([encodeLine({ type: 'done', messageId: 1 })]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = {
      ...sampleRequest,
      context: { page: '/product/green-l-shape/', productId: 3, variantId: 21, cart: [{ productId: 3, variantId: 21, quantity: 1 }] },
    };
    const events = await collect(sendChat(request, new AbortController().signal));
    expect(events).toEqual([{ type: 'done', messageId: 1 }]);

    const headers = new Headers(seenInit?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/x-ndjson');
    const body = JSON.parse(String(seenInit?.body)) as ChatRequestish & {
      context?: { page?: string; productId?: number; variantId?: number; cart?: Array<{ productId: number; quantity: number }> };
    };
    expect(body.context).toEqual({ page: '/product/green-l-shape/', productId: 3, variantId: 21, cart: [{ productId: 3, variantId: 21, quantity: 1 }] });
  });

  it('turns an error status into a single error event using the body message', async () => {
    const fetchMock = vi.fn(async () => streamResponse([], { status: 429, body: JSON.stringify({ error: 'Too many messages, try again soon.' }) }));
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect(sendChat(sampleRequest, new AbortController().signal));
    expect(events).toEqual([{ type: 'error', message: 'Too many messages, try again soon.' }]);
  });

  it('falls back to a generic error event for non-JSON error bodies', async () => {
    const fetchMock = vi.fn(async () => streamResponse([], { status: 500, body: 'nope' }));
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect(sendChat(sampleRequest, new AbortController().signal));
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.type).toBe('error');
    if (event?.type !== 'error') return;
    expect(event.message.length).toBeGreaterThan(0);
  });

  it('turns a failed fetch into a single error event', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect(sendChat(sampleRequest, new AbortController().signal));
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
  });

  it('sends nothing and does not call fetch when the signal is already aborted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    const events = await collect(sendChat(sampleRequest, controller.signal));
    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops mid-stream when aborted and yields no further events', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(encodeLine({ type: 'meta', conversationId: 3, intent: 'faq', answeredBy: 'faq' }));
              c.enqueue(encodeLine({ type: 'delta', text: 'buffered before abort' }));
            },
          }),
          { status: 200, headers: { 'content-type': 'application/x-ndjson' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const ac = new AbortController();
    const events = sendChat(sampleRequest, ac.signal);
    const first = await events.next();
    expect(first.done).toBe(false);
    expect(first.value?.type).toBe('meta');

    ac.abort();

    const rest = await events.next();
    expect(rest.done).toBe(true);
  });
});
