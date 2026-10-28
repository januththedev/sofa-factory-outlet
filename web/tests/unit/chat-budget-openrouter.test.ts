import { afterEach, describe, expect, it, vi } from 'vitest';
import { budgetAvailable, colomboMidnight } from '@/lib/chat/budget';
import { env } from '@/lib/env';
import { openRouter, parseSse } from '@/lib/chat/openrouter';

function sse(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('model budget', () => {
  it('reserves five of the 45 daily calls', () => {
    expect(budgetAvailable(39, 0)).toBe(true);
    expect(budgetAvailable(40, 0)).toBe(false);
  });

  it('caps each session at three answers', () => {
    expect(budgetAvailable(0, 2)).toBe(true);
    expect(budgetAvailable(0, 3)).toBe(false);
  });

  it('uses midnight in Asia/Colombo', () => {
    expect(colomboMidnight(new Date('2026-10-28T20:00:00Z')).toISOString())
      .toBe('2026-10-28T18:30:00.000Z');
  });
});

describe('OpenRouter streaming', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses SSE deltas and ignores malformed events', async () => {
    const stream = sse('data: nope\n\ndata: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n');
    const values: string[] = [];
    for await (const value of parseSse(stream)) {
      values.push(value);
    }
    expect(values).toEqual(['Hi']);
  });

  it('falls back to the next model after an HTTP error', async () => {
    const previousKey = env.OPENROUTER_API_KEY;
    env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(
        sse('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
      ));
    const result = await openRouter('prompt', ['first', 'second']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.model).toBe('second');
    env.OPENROUTER_API_KEY = previousKey;
  });
});
