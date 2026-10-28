import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { chatRateLimited, runChat, type ChatContextInput, type ChatEvent } from '@/lib/chat/api';
import { closeDb, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

async function eventsFor(
  message: string,
  suffix: string,
  context?: ChatContextInput,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of runChat({
    visitorId: `visitor-${suffix}`,
    sessionId: `session-${suffix}`,
    message,
    context,
  })) {
    events.push(event);
  }
  return events;
}

afterAll(async () => {
  await closeDb();
});

describe('chat pipeline database integration', () => {
  it('answers an instant FAQ without a model call', async () => {
    const db = await getDb();
    await db.insert(s.faqs).values({
      question: 'where is the showroom',
      alternatives: ['showroom location'],
      answer: 'Use the confirmed address in settings.',
      tags: ['store_info'],
    });
    const events = await eventsFor('Where is the showroom?', 'faq');
    expect(events[0]).toMatchObject({ type: 'meta', answeredBy: 'faq' });
    expect(events).toContainEqual({ type: 'delta', text: 'Use the confirmed address in settings.' });
  });

  it('returns real catalogue cards for a product request', async () => {
    const events = await eventsFor('Show me sofas', 'products');
    const cards = events.find((event) => event.type === 'cards');
    expect(cards?.type === 'cards' ? cards.products.length : 0).toBeGreaterThan(0);
  });

  it('hands off unknown questions and records a knowledge gap', async () => {
    const db = await getDb();
    const question = 'Does this have radiation shielding?';
    const events = await eventsFor(question, 'unknown', { productId: 1 });
    const meta = events[0];
    expect(meta.type).toBe('meta');
    if (meta.type === 'meta') {
      expect(['handoff', 'fallback']).toContain(meta.answeredBy);
    }
    const gaps = await db
      .select()
      .from(s.knowledgeGaps)
      .where(eq(s.knowledgeGaps.normalised, 'does this have radiation shielding'));
    expect(gaps).toHaveLength(1);
  });

  it('forces template or handoff mode when the daily model budget is exhausted', async () => {
    const db = await getDb();
    const [conversation] = await db
      .insert(s.chatConversations)
      .values({ visitorId: 'budget-seed', sessionId: 'budget-seed' })
      .returning();
    await db.insert(s.chatMessages).values(Array.from({ length: 40 }, (_, index) => ({
      conversationId: conversation.id,
      role: 'assistant' as const,
      text: `answer ${index}`,
      answeredBy: 'model' as const,
    })));
    const events = await eventsFor('Explain an unusual sofa detail', 'budget');
    expect(events[0]).not.toMatchObject({ type: 'meta', answeredBy: 'model' });
  });

  it('never exposes a thrown pipeline error to the iterator consumer', async () => {
    const events = await eventsFor('A completely unknown dependency case', 'safe');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('rate limits after 20 user messages in ten minutes', async () => {
    const db = await getDb();
    const [conversation] = await db
      .insert(s.chatConversations)
      .values({ visitorId: 'rate-visitor', sessionId: 'rate-session' })
      .returning();
    await db.insert(s.chatMessages).values(Array.from({ length: 20 }, (_, index) => ({
      conversationId: conversation.id,
      role: 'user' as const,
      text: `message ${index}`,
    })));
    expect(await chatRateLimited('rate-visitor')).toBe(true);
  });
});
