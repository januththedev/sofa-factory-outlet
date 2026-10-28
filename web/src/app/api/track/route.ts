import { after } from 'next/server';
import { ingestEvent } from '@/lib/analytics/ingest';
import { contextFromRequest, parseTrackPayload } from '@/lib/analytics/server';
import { isBotUserAgent } from '@/lib/analytics/ua';

// sendBeacon posts a JSON Blob; read it as text and parse it ourselves so a
// malformed body can never reach the error page. The insert happens after the
// 204 so tracking never delays a page.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noContent = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = parseTrackPayload(raw);
  if (!parsed.ok) return new Response(null, { status: 400 });

  const context = contextFromRequest(request);
  if (isBotUserAgent(context.userAgent)) return noContent();

  try {
    after(async () => {
      try {
        await ingestEvent(parsed.payload, context);
      } catch (error) {
        console.error('[track] could not store event:', error);
      }
    });
  } catch (error) {
    // Scheduling background work must never turn a page view into an error page.
    console.error('[track] could not schedule the insert:', error);
  }

  return noContent();
}
