import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import * as s from '../db/schema';
import { normaliseQuestion } from './normalise';

export type FaqMatch = {
  id: number;
  answer: string;
  score: number;
};

export async function findFaq(message: string): Promise<FaqMatch | null> {
  let match: FaqMatch | undefined;
  try {
    const db = await getDb();
    const question = normaliseQuestion(message);
    const similarity = sql<number>`greatest(
      similarity(lower(${s.faqs.question}), ${question}),
      coalesce((select max(similarity(lower(value), ${question}))
        from unnest(${s.faqs.alternatives}) value), 0)
    )`;
    const [row] = await db
      .select({ id: s.faqs.id, answer: s.faqs.answer, score: similarity })
      .from(s.faqs)
      .where(eq(s.faqs.enabled, true))
      .orderBy(desc(similarity))
      .limit(1);
    if (!row || Number(row.score) < 0.6) {
      return null;
    }
    match = { ...row, score: Number(row.score) };
  } catch {
    return null;
  }
  if (!match) {
    return null;
  }
  try {
    const db = await getDb();
    await db
      .update(s.faqs)
      .set({ hitCount: sql`${s.faqs.hitCount} + 1` })
      .where(eq(s.faqs.id, match.id));
  } catch {
    // The exact stored answer is still useful if only the counter write failed.
  }
  return match;
}
