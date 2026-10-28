import { z } from 'zod';
import { chatRateLimited, runChat } from '@/lib/chat/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const requestSchema = z.object({
  visitorId: z.string().min(1).max(200),
  sessionId: z.string().min(1).max(200),
  message: z.string().trim().min(1).max(600),
  context: z.object({
    page: z.string().max(500).optional(),
    productId: z.number().int().positive().optional(),
    variantId: z.number().int().positive().optional(),
    cart: z.array(z.object({
      productId: z.number().int().positive(),
      variantId: z.number().int().positive().optional(),
      quantity: z.number().int().positive().max(20),
    })).max(20).optional(),
  }).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid chat request.' }, { status: 400 });
  }
  if (await chatRateLimited(parsed.data.visitorId)) {
    return Response.json({ error: 'Too many messages. Please try again shortly.' }, { status: 429 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runChat(parsed.data)) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message: 'Chat unavailable.' })}\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
