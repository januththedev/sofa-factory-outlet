import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import * as s from '../db/schema';
import { notify } from '../notify/bell';
import { normaliseQuestion } from './normalise';

export async function recordGap(question: string): Promise<void> {
  try {
    const db = await getDb();
    const normalised = normaliseQuestion(question);
    const inserted = await db
      .insert(s.knowledgeGaps)
      .values({ question, normalised })
      .onConflictDoNothing({ target: s.knowledgeGaps.normalised })
      .returning({ id: s.knowledgeGaps.id });
    if (inserted.length === 0) {
      await db
        .update(s.knowledgeGaps)
        .set({
          timesAsked: sql`${s.knowledgeGaps.timesAsked} + 1`,
          lastAskedAt: new Date(),
        })
        .where(eq(s.knowledgeGaps.normalised, normalised));
    } else {
      await notify({
        type: 'knowledge_gap',
        title: 'New chatbot knowledge gap',
        body: question,
        link: '/admin/chat/',
      });
    }
  } catch {
    // Logging must never prevent a visitor response.
  }
}

export async function flagMessage(messageId: number): Promise<void> {
  const db = await getDb();
  const [message] = await db
    .update(s.chatMessages)
    .set({ rating: -1, flagged: true })
    .where(eq(s.chatMessages.id, messageId))
    .returning({
      conversationId: s.chatMessages.conversationId,
      id: s.chatMessages.id,
      text: s.chatMessages.text,
    });
  if (message) {
    const [question] = await db
      .select({ text: s.chatMessages.text })
      .from(s.chatMessages)
      .where(and(
        eq(s.chatMessages.conversationId, message.conversationId),
        eq(s.chatMessages.role, 'user'),
        lt(s.chatMessages.id, message.id),
      ))
      .orderBy(desc(s.chatMessages.id))
      .limit(1);
    await recordGap(question?.text ?? message.text);
  }
}
