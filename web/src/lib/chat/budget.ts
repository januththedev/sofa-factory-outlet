import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db';
import * as s from '../db/schema';

export function budgetAvailable(
  dailyUsed: number,
  sessionUsed: number,
  dailyBudget = 45,
  buffer = 5,
  perSession = 3,
): boolean {
  return dailyUsed < Math.max(0, dailyBudget - buffer) && sessionUsed < perSession;
}

export function colomboMidnight(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00+05:30`);
}

export async function modelBudgetAvailable(
  sessionId: string,
  dailyBudget = 45,
  perSession = 3,
  buffer = 5,
): Promise<boolean> {
  try {
    const db = await getDb();
    const [daily] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.chatMessages)
      .where(and(eq(s.chatMessages.answeredBy, 'model'), gte(s.chatMessages.createdAt, colomboMidnight())));
    const [session] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.chatMessages)
      .innerJoin(s.chatConversations, eq(s.chatMessages.conversationId, s.chatConversations.id))
      .where(and(
        eq(s.chatMessages.answeredBy, 'model'),
        eq(s.chatConversations.sessionId, sessionId),
      ));
    return budgetAvailable(
      daily?.count ?? 0,
      session?.count ?? 0,
      dailyBudget,
      buffer,
      perSession,
    );
  } catch {
    return false;
  }
}
