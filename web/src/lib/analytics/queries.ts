import { and, desc, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from 'drizzle-orm';
import { type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { TrackEventType } from './client';
import { colomboDate, colomboDayEnd, colomboDayStart, colomboDays } from './rollup';
import { SOURCE_BUCKETS, type SourceBucket } from './server';

// Read side of the Visitors page. Roll-ups serve finished days; today (and any
// day the nightly job has not reached) is counted from raw `events`, which are
// kept for 90 days.

export type TrafficPoint = { date: string; visitors: number; sessions: number; pageViews: number };

export type SourceRow = { source: SourceBucket; visitors: number; share: number };

export type FunnelStep = {
  key: string;
  label: string;
  visitors: number;
  conversionPct: number;
  dropOff: number;
  dropOffPct: number;
};

export type ProductPerformance = {
  productId: number;
  name: string;
  slug: string | null;
  views: number;
  addsToCart: number;
  bookings: number;
};

export type AudienceRow = { label: string; visitors: number };
export type Audience = { devices: AudienceRow[]; cities: AudienceRow[] };

export type ChatbotStats = {
  conversations: number;
  answers: { faq: number; template: number; model: number; handoff: number; fallback: number };
  answeredTotal: number;
  instantShare: number;
  modelShare: number;
  openGaps: Array<{ question: string; timesAsked: number }>;
  openGapCount: number;
};

export type VisitorsTotals = {
  visitors: number;
  sessions: number;
  pageViews: number;
  bookings: number;
  conversionPct: number;
};

export type VisitorsOverview = {
  days: number;
  from: string;
  to: string;
  totals: VisitorsTotals;
  traffic: TrafficPoint[];
  live: number;
  sources: SourceRow[];
  funnel: FunnelStep[];
  products: ProductPerformance[];
  audience: Audience;
  chatbot: ChatbotStats;
};

const FUNNEL_STEPS: ReadonlyArray<{ key: string; label: string; type: TrackEventType }> = [
  { key: 'visit', label: 'Visit', type: 'page_view' },
  { key: 'product_view', label: 'Product view', type: 'product_view' },
  { key: 'add_to_cart', label: 'Add to cart', type: 'add_to_cart' },
  { key: 'booking_start', label: 'Booking started', type: 'booking_start' },
  { key: 'booking_submit', label: 'Booking submitted', type: 'booking_submit' },
];

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
  unknown: 'Unknown',
};

const percent = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

type DimensionRow = { dimension: string; value: number };

function dimensionsFromStats(rows: DimensionRow[]): DimensionRow[] {
  return rows
    .filter((row) => row.dimension !== '' && row.value > 0)
    .map((row) => ({ dimension: row.dimension, value: row.value }))
    .sort((a, b) => b.value - a.value);
}

async function liveDimension(
  db: Db,
  dates: string[],
  metric: 'source' | 'device' | 'city',
): Promise<DimensionRow[]> {
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(dates[dates.length - 1]);
  const conditions = [gte(s.events.createdAt, from), lt(s.events.createdAt, to)];
  // Match the roll-up: the cities panel only lists local visitors.
  if (metric === 'city') conditions.push(sql`(${s.events.country} is null or ${s.events.country} = 'LK')`);
  const column = metric === 'source' ? s.events.source : metric === 'device' ? s.events.device : s.events.city;
  const rows = await db
    .select({
      dimension: sql<string>`coalesce(${column}, '')`,
      value: sql<number>`count(distinct ${s.events.visitorId})::int`,
    })
    .from(s.events)
    .where(and(...conditions))
    .groupBy(column);
  return rows.filter((row) => row.dimension !== '' && row.value > 0);
}

/**
 * A day uses rolled-up stats when the nightly job has covered it; today and any
 * day it has not reached are counted from raw events, then the days are added
 * together so a 30-day window is complete after a fresh deploy.
 */
async function dimensionSeries(metric: 'source' | 'device' | 'city', dates: string[], db: Db) {
  const today = dates[dates.length - 1];
  const rolledDates = await db
    .select({ date: s.dailyStats.date })
    .from(s.dailyStats)
    .where(
      and(
        inArray(s.dailyStats.date, dates),
        eq(s.dailyStats.metric, metric),
        ne(s.dailyStats.dimension, ''),
      ),
    )
    .groupBy(s.dailyStats.date);
  const statDates = rolledDates.map((row) => row.date).filter((date) => date !== today);

  const totals = new Map<string, number>();
  if (statDates.length) {
    const rows = await db
      .select({
        dimension: s.dailyStats.dimension,
        value: sql<number>`coalesce(sum(${s.dailyStats.value}), 0)::int`,
      })
      .from(s.dailyStats)
      .where(
        and(
          inArray(s.dailyStats.date, statDates),
          eq(s.dailyStats.metric, metric),
          ne(s.dailyStats.dimension, ''),
        ),
      )
      .groupBy(s.dailyStats.dimension);
    for (const row of dimensionsFromStats(rows)) totals.set(row.dimension, row.value);
  }

  const liveDates = dates.filter((date) => !statDates.includes(date));
  if (liveDates.length) {
    for (const row of await liveDimension(db, liveDates, metric)) {
      totals.set(row.dimension, (totals.get(row.dimension) ?? 0) + row.value);
    }
  }

  return [...totals.entries()]
    .map(([dimension, value]) => ({ dimension, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Visitors, sessions and page views per Colombo day; today is always live. */
export async function getTrafficSeries(days = 7, now: Date = new Date()): Promise<TrafficPoint[]> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const today = dates[dates.length - 1];
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(today);

  const [stats, events] = await Promise.all([
    db
      .select({ date: s.dailyStats.date, metric: s.dailyStats.metric, value: s.dailyStats.value })
      .from(s.dailyStats)
      .where(
        and(
          inArray(s.dailyStats.date, dates),
          inArray(s.dailyStats.metric, ['visitors', 'sessions', 'page_views']),
          eq(s.dailyStats.dimension, ''),
        ),
      ),
    db
      .select({
        visitorId: s.events.visitorId,
        sessionId: s.events.sessionId,
        type: s.events.type,
        createdAt: s.events.createdAt,
      })
      .from(s.events)
      .where(and(gte(s.events.createdAt, from), lt(s.events.createdAt, to))),
  ]);

  const rolled = new Map<string, TrafficPoint>();
  for (const row of stats) {
    const entry = rolled.get(row.date) ?? { date: row.date, visitors: 0, sessions: 0, pageViews: 0 };
    if (row.metric === 'visitors') entry.visitors = row.value;
    if (row.metric === 'sessions') entry.sessions = row.value;
    if (row.metric === 'page_views') entry.pageViews = row.value;
    rolled.set(row.date, entry);
  }

  const live = new Map<
    string,
    { visitors: Set<string>; sessions: Set<string>; pageViews: number }
  >();
  for (const row of events) {
    const date = colomboDate(row.createdAt);
    const entry = live.get(date) ?? { visitors: new Set<string>(), sessions: new Set<string>(), pageViews: 0 };
    entry.visitors.add(row.visitorId);
    entry.sessions.add(row.sessionId);
    if (row.type === 'page_view') entry.pageViews += 1;
    live.set(date, entry);
  }

  return dates.map((date) => {
    const stat = rolled.get(date);
    if (date !== today && stat) return stat;
    const raw = live.get(date);
    return {
      date,
      visitors: raw?.visitors.size ?? 0,
      sessions: raw?.sessions.size ?? 0,
      pageViews: raw?.pageViews ?? 0,
    };
  });
}

/** Distinct sessions with an event in the last five minutes. */
export async function getLiveVisitors(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const since = new Date(now.getTime() - 5 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${s.events.sessionId})::int` })
    .from(s.events)
    .where(and(gte(s.events.createdAt, since), lte(s.events.createdAt, now)));
  return row?.count ?? 0;
}

export async function getSources(days = 7, now: Date = new Date()): Promise<SourceRow[]> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const rows = await dimensionSeries('source', dates, db);
  const totals = new Map<SourceBucket, number>();
  for (const row of rows) {
    const known = (SOURCE_BUCKETS as readonly string[]).includes(row.dimension);
    const bucket = known ? (row.dimension as SourceBucket) : 'other';
    totals.set(bucket, (totals.get(bucket) ?? 0) + row.value);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([source, visitors]) => ({ source, visitors, share: percent(visitors, total) }))
    .sort((a, b) => b.visitors - a.visitors);
}

/** Distinct visitors at each funnel step in the period, with the drop from the step before. */
export async function getFunnel(days = 7, now: Date = new Date()): Promise<FunnelStep[]> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(dates[dates.length - 1]);
  const rows = await db
    .select({ visitorId: s.events.visitorId, type: s.events.type })
    .from(s.events)
    .where(
      and(
        gte(s.events.createdAt, from),
        lt(s.events.createdAt, to),
        inArray(
          s.events.type,
          FUNNEL_STEPS.map((step) => step.type),
        ),
      ),
    )
    .groupBy(s.events.visitorId, s.events.type);

  const visitorsByType = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = visitorsByType.get(row.type) ?? new Set<string>();
    set.add(row.visitorId);
    visitorsByType.set(row.type, set);
  }

  const first = visitorsByType.get(FUNNEL_STEPS[0].type)?.size ?? 0;
  return FUNNEL_STEPS.map((step, index) => {
    const visitors = visitorsByType.get(step.type)?.size ?? 0;
    const previous = index === 0 ? visitors : (visitorsByType.get(FUNNEL_STEPS[index - 1].type)?.size ?? 0);
    const dropOff = index === 0 ? 0 : Math.max(0, previous - visitors);
    return {
      key: step.key,
      label: step.label,
      visitors,
      conversionPct: percent(visitors, first),
      dropOff,
      dropOffPct: index === 0 ? 0 : percent(dropOff, previous),
    };
  });
}

/** Views, adds to cart and bookings for each product, side by side. */
export async function getProductPerformance(
  days = 7,
  now: Date = new Date(),
  limit = 10,
): Promise<ProductPerformance[]> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(dates[dates.length - 1]);

  const [eventRows, bookingRows] = await Promise.all([
    db
      .select({
        productId: s.events.productId,
        type: s.events.type,
        count: sql<number>`count(*)::int`,
      })
      .from(s.events)
      .where(
        and(
          gte(s.events.createdAt, from),
          lt(s.events.createdAt, to),
          inArray(s.events.type, ['product_view', 'add_to_cart']),
          isNotNull(s.events.productId),
        ),
      )
      .groupBy(s.events.productId, s.events.type),
    db
      .select({
        productId: s.bookingItems.productId,
        bookings: sql<number>`count(distinct ${s.bookings.id})::int`,
      })
      .from(s.bookingItems)
      .innerJoin(s.bookings, eq(s.bookings.id, s.bookingItems.bookingId))
      .where(
        and(
          gte(s.bookings.createdAt, from),
          lt(s.bookings.createdAt, to),
          ne(s.bookings.status, 'cancelled'),
          isNotNull(s.bookingItems.productId),
        ),
      )
      .groupBy(s.bookingItems.productId),
  ]);

  const byProduct = new Map<number, ProductPerformance>();
  const entry = (productId: number) => {
    const existing = byProduct.get(productId);
    if (existing) return existing;
    const created: ProductPerformance = {
      productId,
      name: `Product #${productId}`,
      slug: null,
      views: 0,
      addsToCart: 0,
      bookings: 0,
    };
    byProduct.set(productId, created);
    return created;
  };

  for (const row of eventRows) {
    if (row.productId === null) continue;
    const product = entry(row.productId);
    if (row.type === 'product_view') product.views += row.count;
    if (row.type === 'add_to_cart') product.addsToCart += row.count;
  }
  for (const row of bookingRows) {
    if (row.productId === null) continue;
    entry(row.productId).bookings += row.bookings;
  }

  const ids = [...byProduct.keys()];
  if (!ids.length) return [];
  const products = await db
    .select({ id: s.products.id, name: s.products.name, slug: s.products.slug })
    .from(s.products)
    .where(inArray(s.products.id, ids));
  for (const product of products) {
    const found = byProduct.get(product.id);
    if (found) {
      found.name = product.name;
      found.slug = product.slug;
    }
  }

  return [...byProduct.values()]
    .sort((a, b) => b.views - a.views || b.bookings - a.bookings || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function getAudience(days = 7, now: Date = new Date()): Promise<Audience> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const [devices, cities] = await Promise.all([
    dimensionSeries('device', dates, db),
    dimensionSeries('city', dates, db),
  ]);
  return {
    devices: devices.slice(0, 5).map((row) => ({
      label: DEVICE_LABELS[row.dimension] ?? row.dimension,
      visitors: row.value,
    })),
    cities: cities.slice(0, 8).map((row) => ({
      label: row.dimension,
      visitors: row.value,
    })),
  };
}

export async function getChatbotStats(
  days = 7,
  now: Date = new Date(),
): Promise<ChatbotStats> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(dates[dates.length - 1]);

  const [conversationsRow, answersRows, gaps, gapsCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.chatConversations)
      .where(and(gte(s.chatConversations.createdAt, from), lt(s.chatConversations.createdAt, to))),
    db
      .select({
        answeredBy: s.chatMessages.answeredBy,
        count: sql<number>`count(*)::int`,
      })
      .from(s.chatMessages)
      .where(
        and(
          gte(s.chatMessages.createdAt, from),
          lt(s.chatMessages.createdAt, to),
          eq(s.chatMessages.role, 'assistant'),
        ),
      )
      .groupBy(s.chatMessages.answeredBy),
    db
      .select({ question: s.knowledgeGaps.question, timesAsked: s.knowledgeGaps.timesAsked })
      .from(s.knowledgeGaps)
      .where(eq(s.knowledgeGaps.status, 'open'))
      .orderBy(desc(s.knowledgeGaps.timesAsked), desc(s.knowledgeGaps.lastAskedAt))
      .limit(6),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.knowledgeGaps)
      .where(eq(s.knowledgeGaps.status, 'open')),
  ]);

  const answers = { faq: 0, template: 0, model: 0, handoff: 0, fallback: 0 };
  for (const row of answersRows) {
    if (row.answeredBy && row.answeredBy in answers) {
      answers[row.answeredBy] = row.count;
    }
  }
  const answeredTotal = answers.faq + answers.template + answers.model + answers.handoff + answers.fallback;

  return {
    conversations: conversationsRow[0]?.count ?? 0,
    answers,
    answeredTotal,
    instantShare: percent(answers.faq + answers.template, answeredTotal),
    modelShare: percent(answers.model, answeredTotal),
    openGaps: gaps,
    openGapCount: gapsCount[0]?.count ?? 0,
  };
}

async function getTotals(
  days: number,
  now: Date,
): Promise<{ totals: VisitorsTotals; from: string; to: string }> {
  const db = await getDb();
  const dates = colomboDays(days, now);
  const from = colomboDayStart(dates[0]);
  const to = colomboDayEnd(dates[dates.length - 1]);

  const [row] = await db
    .select({
      visitors: sql<number>`count(distinct ${s.events.visitorId})::int`,
      sessions: sql<number>`count(distinct ${s.events.sessionId})::int`,
      pageViews: sql<number>`(count(*) filter (where ${s.events.type} = 'page_view'))::int`,
      bookings: sql<number>`
        count(distinct case when ${s.events.type} = 'booking_submit' then ${s.events.visitorId} end)::int
      `,
    })
    .from(s.events)
    .where(and(gte(s.events.createdAt, from), lt(s.events.createdAt, to)));

  const visitors = row?.visitors ?? 0;
  const bookings = row?.bookings ?? 0;
  return {
    from: dates[0],
    to: dates[dates.length - 1],
    totals: {
      visitors,
      sessions: row?.sessions ?? 0,
      pageViews: row?.pageViews ?? 0,
      bookings,
      conversionPct: percent(bookings, visitors),
    },
  };
}

/** Everything the Visitors page shows, in one round trip. */
export async function getVisitorsOverview(
  days = 7,
  now: Date = new Date(),
): Promise<VisitorsOverview> {
  const safeDays = days === 30 ? 30 : 7;
  const [totals, traffic, live, sources, funnel, products, audience, chatbot] = await Promise.all([
    getTotals(safeDays, now),
    getTrafficSeries(safeDays, now),
    getLiveVisitors(now),
    getSources(safeDays, now),
    getFunnel(safeDays, now),
    getProductPerformance(safeDays, now),
    getAudience(safeDays, now),
    getChatbotStats(safeDays, now),
  ]);
  return { days: safeDays, ...totals, traffic, live, sources, funnel, products, audience, chatbot };
}
