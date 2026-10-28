import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDigest } from '@/lib/analytics/digest';
import { ingestEvent } from '@/lib/analytics/ingest';
import { getFunnel } from '@/lib/analytics/queries';
import { colomboDate, colomboDays, purgeOldEvents, rebuildDailyStats } from '@/lib/analytics/rollup';
import type { TrackPayloadInput } from '@/lib/analytics/server';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

let db: Db;

beforeAll(async () => {
  db = await getDb();
});

afterAll(async () => {
  await closeDb();
});

/** Distinct visitor ids long enough for the payload schema. */
const visitor = (name: string) => `visitor-${name}-0001`;
const session = (name: string) => `session-${name}-0001`;

const payload = (
  name: string,
  type: TrackPayloadInput['type'],
  extra: Partial<TrackPayloadInput> = {},
): TrackPayloadInput => ({
  type,
  visitorId: visitor(name),
  sessionId: session(name),
  path: '/',
  ...extra,
});

const valueAt = async (date: string, metric: string, dimension = ''): Promise<number | null> => {
  const [row] = await db
    .select({ value: s.dailyStats.value })
    .from(s.dailyStats)
    .where(and(eq(s.dailyStats.date, date), eq(s.dailyStats.metric, metric), eq(s.dailyStats.dimension, dimension)));
  return row?.value ?? null;
};

describe('analytics ingest and roll-ups', () => {
  it('counts distinct visitors at every funnel step', async () => {
    const now = new Date('2026-05-01T06:00:00.000Z');
    const context = { userAgent: DESKTOP_FIREFOX, now };
    const steps: Array<[string, TrackPayloadInput['type']]> = [
      ['funnel-a', 'page_view'],
      ['funnel-b', 'page_view'],
      ['funnel-b', 'product_view'],
      ['funnel-c', 'page_view'],
      ['funnel-c', 'product_view'],
      ['funnel-c', 'add_to_cart'],
      ['funnel-d', 'page_view'],
      ['funnel-d', 'product_view'],
      ['funnel-d', 'add_to_cart'],
      ['funnel-d', 'booking_start'],
      ['funnel-d', 'booking_submit'],
    ];
    for (const [name, type] of steps) {
      expect(await ingestEvent(payload(name, type), context)).toBe('inserted');
    }

    const funnel = await getFunnel(7, now);
    expect(funnel.map((step) => step.visitors)).toEqual([4, 3, 2, 1, 1]);
    expect(funnel.map((step) => step.dropOff)).toEqual([0, 1, 1, 1, 0]);
    expect(funnel[0].conversionPct).toBe(100);
    expect(funnel[1].dropOffPct).toBeCloseTo(25);
    expect(funnel[2].dropOffPct).toBeCloseTo(33.3, 1);
  });

  it('writes the fields derived on the server and stores no personal data', async () => {
    const now = new Date('2026-03-10T04:00:00.000Z');
    const result = await ingestEvent(
      {
        type: 'product_view',
        visitorId: 'derived-visitor-0001',
        sessionId: 'derived-session-0001',
        path: '/product/l-shape-sofa/',
        productId: 685,
        referrer: 'https://www.google.com/search?q=cream+sofa+colombo',
        utm: { source: 'google', medium: 'cpc', campaign: 'autumn' },
        value: { variantId: 12 },
      },
      { userAgent: ANDROID_CHROME, country: 'LK', region: 'Western', city: 'Colombo', now },
    );
    expect(result).toBe('inserted');

    const [row] = await db.select().from(s.events).where(eq(s.events.visitorId, 'derived-visitor-0001'));
    expect(row).toMatchObject({
      type: 'product_view',
      path: '/product/l-shape-sofa/',
      productId: 685,
      country: 'LK',
      region: 'Western',
      city: 'Colombo',
      device: 'mobile',
      browser: 'Chrome',
      os: 'Android',
      source: 'google',
      referrer: 'google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'autumn',
      value: { variantId: 12 },
    });
    expect(row.createdAt.toISOString()).toBe(now.toISOString());
    // No IP column and no raw user agent anywhere in the row.
    expect(Object.keys(row)).not.toContain('ip');
    expect(Object.keys(row)).not.toContain('userAgent');
  });

  it('buckets a referrer even when the link has no UTM tag', async () => {
    const now = new Date('2026-02-01T04:00:00.000Z');
    const result = await ingestEvent(
      { ...payload('referrer-only', 'page_view'), referrer: 'https://www.google.com/search?q=sofa' },
      { userAgent: DESKTOP_FIREFOX, now },
    );
    expect(result).toBe('inserted');
    const [row] = await db.select().from(s.events).where(eq(s.events.visitorId, visitor('referrer-only')));
    expect(row.source).toBe('google');
    expect(row.referrer).toBe('google.com');
    expect(row.utmSource).toBeNull();
  });

  it('drops bot events', async () => {
    const now = new Date('2026-05-01T07:00:00.000Z');
    expect(await ingestEvent(payload('bot', 'page_view'), { userAgent: GOOGLEBOT, now })).toBe('bot');
    const rows = await db.select().from(s.events).where(eq(s.events.visitorId, visitor('bot')));
    expect(rows).toHaveLength(0);
  });

  it('ignores events over the per-visitor hourly soft limit', async () => {
    const now = new Date('2026-05-01T08:00:00.000Z');
    const context = { userAgent: DESKTOP_FIREFOX, now };
    expect(await ingestEvent(payload('limit', 'page_view'), context, { limit: 2 })).toBe('inserted');
    expect(await ingestEvent(payload('limit', 'page_view'), context, { limit: 2 })).toBe('inserted');
    expect(await ingestEvent(payload('limit', 'page_view'), context, { limit: 2 })).toBe('rate_limited');
  });

  it('rebuilds the same totals when the roll-up runs twice', async () => {
    const now = new Date('2026-03-11T05:00:00.000Z');
    const context = { userAgent: DESKTOP_FIREFOX, now };
    await ingestEvent(payload('rollup-a', 'page_view', { path: '/' }), context);
    await ingestEvent(payload('rollup-a', 'product_view', { path: '/product/l-shape-sofa/', productId: 42 }), context);
    await ingestEvent(payload('rollup-b', 'page_view', { path: '/shop/' }), context);
    await ingestEvent(payload('rollup-b', 'add_to_cart', { path: '/shop/', productId: 42 }), context);

    const snapshot = async () => {
      const rows = await db
        .select()
        .from(s.dailyStats)
        .orderBy(
          asc(s.dailyStats.date),
          asc(s.dailyStats.metric),
          asc(s.dailyStats.dimension),
        );
      return rows.map(
        (row) => `${row.date}|${row.metric}|${row.dimension}|${row.value}`,
      );
    };

    const first = await rebuildDailyStats({ days: 3, now });
    const afterFirst = await snapshot();
    const second = await rebuildDailyStats({ days: 3, now });
    const afterSecond = await snapshot();

    expect(afterSecond).toEqual(afterFirst);
    expect(second.rows).toBe(first.rows);
    expect(first.dates).toEqual(['2026-03-09', '2026-03-10', '2026-03-11']);

    expect(await valueAt('2026-03-11', 'visitors')).toBe(2);
    expect(await valueAt('2026-03-11', 'sessions')).toBe(2);
    expect(await valueAt('2026-03-11', 'page_views')).toBe(2);
    expect(await valueAt('2026-03-11', 'product_views', '42')).toBe(1);
    expect(await valueAt('2026-03-11', 'add_to_cart')).toBe(1);
    expect(await valueAt('2026-03-11', 'source', 'direct')).toBe(2);
    expect(await valueAt('2026-03-11', 'device', 'desktop')).toBe(2);
    expect(await valueAt('2026-03-10', 'city', 'Colombo')).toBe(1);
    expect(await valueAt('2026-03-11', 'top_page', '/')).toBe(1);
    expect(await valueAt('2026-03-11', 'top_page', '/shop/')).toBe(1);
  });

  it('splits days on Colombo midnight, not UTC midnight', async () => {
    const now = new Date('2026-06-02T06:00:00.000Z');
    // 18:29Z and 18:31Z are 23:59 and 00:01 in Colombo.
    const late = new Date('2026-06-01T18:29:00.000Z');
    const early = new Date('2026-06-01T18:31:00.000Z');
    expect(colomboDate(late)).toBe('2026-06-01');
    expect(colomboDate(early)).toBe('2026-06-02');
    expect(colomboDays(3, now)).toEqual(['2026-05-31', '2026-06-01', '2026-06-02']);

    await ingestEvent(payload('boundary-a', 'page_view'), { userAgent: DESKTOP_FIREFOX, now: late });
    await ingestEvent(payload('boundary-b', 'page_view'), { userAgent: DESKTOP_FIREFOX, now: early });

    await rebuildDailyStats({ days: 3, now });
    expect(await valueAt('2026-06-01', 'visitors')).toBe(1);
    expect(await valueAt('2026-06-02', 'visitors')).toBe(1);
    expect(await valueAt('2026-05-31', 'visitors')).toBeNull();
  });

  it('builds yesterday’s digest from the inserted events', async () => {
    const yesterday = new Date('2026-04-10T06:00:00.000Z');
    const digestNow = new Date('2026-04-11T02:00:00.000Z');
    await ingestEvent(payload('digest-a', 'page_view'), { userAgent: DESKTOP_FIREFOX, now: yesterday });
    await ingestEvent(payload('digest-b', 'page_view'), { userAgent: DESKTOP_FIREFOX, now: yesterday });

    const summary = await buildDigest(digestNow);
    expect(summary.date).toBe('2026-04-10');
    expect(summary.visitors).toBe(2);
    expect(summary.sessions).toBe(2);
    expect(summary.pageViews).toBe(2);
    expect(summary.bookings).toBe(0);
  });

  it('purges raw events older than 90 days and keeps newer ones', async () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    const context = { userAgent: DESKTOP_FIREFOX };
    await ingestEvent(payload('purge-old', 'page_view'), { ...context, now: new Date('2026-04-01T00:00:00.000Z') });
    await ingestEvent(payload('purge-new', 'page_view'), { ...context, now });

    const purged = await purgeOldEvents({ now });
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(s.events).where(eq(s.events.visitorId, visitor('purge-old')))).toHaveLength(0);
    expect(await db.select().from(s.events).where(eq(s.events.visitorId, visitor('purge-new')))).toHaveLength(1);
  });
});
