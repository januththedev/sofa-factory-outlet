import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimited: vi.fn(),
  runChat: vi.fn(),
}));

vi.mock('@/lib/chat/api', () => ({
  chatRateLimited: mocks.rateLimited,
  runChat: mocks.runChat,
}));

import { POST } from '@/app/api/chat/route';

describe('chat NDJSON route', () => {
  beforeEach(() => {
    mocks.rateLimited.mockResolvedValue(false);
    mocks.runChat.mockImplementation(async function* () {
      yield { type: 'delta', text: 'Hello' };
      yield { type: 'done', messageId: 1 };
    });
  });

  it('streams one JSON event per line', async () => {
    const response = await POST(new Request('http://local/api/chat/', {
      method: 'POST',
      body: JSON.stringify({ visitorId: 'v', sessionId: 's', message: 'hello' }),
    }));
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect((await response.text()).trim().split('\n')).toHaveLength(2);
  });

  it('rejects messages over 600 characters', async () => {
    const response = await POST(new Request('http://local/api/chat/', {
      method: 'POST',
      body: JSON.stringify({ visitorId: 'v', sessionId: 's', message: 'x'.repeat(601) }),
    }));
    expect(response.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    mocks.rateLimited.mockResolvedValue(true);
    const response = await POST(new Request('http://local/api/chat/', {
      method: 'POST',
      body: JSON.stringify({ visitorId: 'v', sessionId: 's', message: 'hello' }),
    }));
    expect(response.status).toBe(429);
  });
});
