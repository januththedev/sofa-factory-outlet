import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { flagMessage } from '@/lib/chat/log';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const feedbackSchema = z.object({
  messageId: z.number().int().positive(),
  rating: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid feedback.' }, { status: 400 });
  }
  try {
    if (parsed.data.rating === -1) {
      await flagMessage(parsed.data.messageId);
    } else {
      const db = await getDb();
      await db
        .update(s.chatMessages)
        .set({ rating: 1 })
        .where(eq(s.chatMessages.id, parsed.data.messageId));
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Could not save feedback.' }, { status: 503 });
  }
}
