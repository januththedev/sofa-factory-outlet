import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { colomboDate, colomboDayEnd, colomboDays, colomboDayStart } from '@/lib/analytics/rollup';
import { type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { BookingStatus } from '@/lib/db/schema/types';
import { env } from '@/lib/env';
import { readSettings } from './settings';
import type { SetupInput } from './setup-checklist';

// Numbers for the admin dashboard. Each query takes a database handle and the
// current time, so tests can insert rows and pin "now". Days are Asia/Colombo
// days (UTC+05:30, no daylight saving), the same boundaries the nightly roll-up uses.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Booking statuses that still mean "a visit is coming". */
export const UPCOMING_STATUSES: BookingStatus[] = ['new', 'contacted'];
export const BOOKING_STATUSES: BookingStatus[] = ['new', 'contacted', 'visited', 'purchased', 'lost', 'cancelled'];

/** A Colombo calendar date (YYYY-MM-DD) shifted by whole days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const toNumber = (value: unknown): number => Number(value ?? 0);

// ---------------------------------------------------------------------------
// Visitors

export type VisitorDay = { date: string; visitors: number };

export type VisitorStats = {
  today: number;
  /** Each day's distinct visitors, added up: a visitor who returns on three days counts three times. */
  last7: number;
  series: VisitorDay[];
  /** False while there is nothing recorded at all, so the page can say "No data yet" instead of showing zeros. */
  hasData: boolean;
};

/**
 * Finished days come from `daily_stats` (rolled up nightly); today, and any day the
 * roll-up has not reached yet, are counted from raw `events`.
 */
export async function getVisitorStats(db: Db, now: Date = new Date()): Promise<VisitorStats> {
  const dates = colomboDays(7, now);
  const today = dates[dates.length - 1];

  const rolled = await db
    .select({ date: s.dailyStats.date, value: s.dailyStats.value })
    .from(s.dailyStats)
    .where(and(inArray(s.dailyStats.date, dates), eq(s.dailyStats.metric, 'visitors'), eq(s.dailyStats.dimension, '')));
  const rolledByDate = new Map(rolled.map((row) => [row.date, toNumber(row.value)]));

  const liveDates = dates.filter((date) => date === today || !rolledByDate.has(date));
  const live = new Map<string, Set<string>>();
  const rows = await db
    .select({ visitorId: s.events.visitorId, createdAt: s.events.createdAt })
    .from(s.events)
    .where(
      and(gte(s.events.createdAt, colomboDayStart(liveDates[0])), lt(s.events.createdAt, colomboDayEnd(today))),
    );
  for (const row of rows) {
    const date = colomboDate(row.createdAt);
    if (!liveDates.includes(date)) continue;
    const seen = live.get(date) ?? new Set<string>();
    seen.add(row.visitorId);
    live.set(date, seen);
  }

  const series = dates.map((date) => ({
    date,
    visitors: liveDates.includes(date) ? (live.get(date)?.size ?? 0) : (rolledByDate.get(date) ?? 0),
  }));
  const hasData = rolled.length > 0 || rows.length > 0;
  return {
    today: series[series.length - 1].visitors,
    last7: series.reduce((sum, day) => sum + day.visitors, 0),
    series,
    hasData,
  };
}

// ---------------------------------------------------------------------------
// Bookings

export type BookingStats = {
  /** Bookings made today, cancelled ones left out. */
  newToday: number;
  /** Visits dated today to six days ahead that are still new or contacted. */
  next7Days: number;
  /** Bookings made in the last 7 Colombo days, cancelled ones left out. */
  made7Days: number;
  byStatus: Record<BookingStatus, number>;
  total: number;
};

export async function getBookingStats(db: Db, now: Date = new Date()): Promise<BookingStats> {
  const today = colomboDate(now);
  const weekStart = colomboDayStart(addDays(today, -6));
  const tomorrowStart = colomboDayEnd(today);

  const [created, upcoming, statusRows] = await Promise.all([
    db
      .select({ createdAt: s.bookings.createdAt, status: s.bookings.status })
      .from(s.bookings)
      .where(and(gte(s.bookings.createdAt, weekStart), lt(s.bookings.createdAt, tomorrowStart))),
    db
      .select({ n: count() })
      .from(s.bookings)
      .where(
        and(
          gte(s.bookings.visitDate, today),
          lte(s.bookings.visitDate, addDays(today, 6)),
          inArray(s.bookings.status, UPCOMING_STATUSES),
        ),
      ),
    db.select({ status: s.bookings.status, n: count() }).from(s.bookings).groupBy(s.bookings.status),
  ]);

  const byStatus = Object.fromEntries(BOOKING_STATUSES.map((status) => [status, 0])) as Record<BookingStatus, number>;
  for (const row of statusRows) byStatus[row.status] = toNumber(row.n);

  return {
    newToday: created.filter((row) => row.status !== 'cancelled' && colomboDate(row.createdAt) === today).length,
    next7Days: toNumber(upcoming[0]?.n),
    made7Days: created.filter((row) => row.status !== 'cancelled').length,
    byStatus,
    total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
  };
}

export type Conversion = { bookings: number; visitors: number; ratePct: number | null };

/** Bookings made over the week divided by the week's visitors; null while there are no visitors. */
export function conversionRate(bookings: number, visitors: number): Conversion {
  return { bookings, visitors, ratePct: visitors > 0 ? (bookings / visitors) * 100 : null };
}

export type UpcomingVisit = {
  id: number;
  reference: string;
  visitDate: string;
  slotLabel: string;
  customerName: string;
  status: BookingStatus;
};

export async function getUpcomingVisits(db: Db, now: Date = new Date(), limit = 5): Promise<UpcomingVisit[]> {
  return db
    .select({
      id: s.bookings.id,
      reference: s.bookings.reference,
      visitDate: s.bookings.visitDate,
      slotLabel: s.bookings.slotLabel,
      customerName: s.customers.name,
      status: s.bookings.status,
    })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(and(gte(s.bookings.visitDate, colomboDate(now)), inArray(s.bookings.status, UPCOMING_STATUSES)))
    .orderBy(asc(s.bookings.visitDate), asc(s.bookings.slotLabel), asc(s.bookings.id))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Products and chat

export type TopProduct = { productId: number; name: string; slug: string; views: number };

/** Most viewed products over the last 7 Colombo days, from raw `product_view` events. */
export async function getTopProducts(db: Db, now: Date = new Date(), limit = 5): Promise<TopProduct[]> {
  const today = colomboDate(now);
  const rows = await db
    .select({
      productId: s.products.id,
      name: s.products.name,
      slug: s.products.slug,
      views: count(),
    })
    .from(s.events)
    .innerJoin(s.products, eq(s.products.id, s.events.productId))
    .where(
      and(
        eq(s.events.type, 'product_view'),
        gte(s.events.createdAt, colomboDayStart(addDays(today, -6))),
        lt(s.events.createdAt, colomboDayEnd(today)),
      ),
    )
    .groupBy(s.products.id, s.products.name, s.products.slug)
    .orderBy(desc(count()), asc(s.products.name))
    .limit(limit);
  return rows.map((row) => ({ ...row, views: toNumber(row.views) }));
}

export type TopQuestion = { question: string; count: number };

const QUESTION_DAYS = 30;
const QUESTION_MAX_LENGTH = 140;

/**
 * What visitors ask the chatbot most, over the last 30 days. Questions are grouped
 * ignoring case, surrounding spaces and trailing punctuation.
 */
export async function getTopChatQuestions(db: Db, now: Date = new Date(), limit = 5): Promise<TopQuestion[]> {
  const today = colomboDate(now);
  const key = sql<string>`regexp_replace(lower(btrim(${s.chatMessages.text})), '[?!.[:space:]]+$', '')`;
  const rows = await db
    .select({ sample: sql<string>`min(btrim(${s.chatMessages.text}))`, n: count() })
    .from(s.chatMessages)
    .where(
      and(
        eq(s.chatMessages.role, 'user'),
        gte(s.chatMessages.createdAt, colomboDayStart(addDays(today, -(QUESTION_DAYS - 1)))),
        lt(s.chatMessages.createdAt, colomboDayEnd(today)),
        sql`${key} <> ''`,
      ),
    )
    .groupBy(key)
    .orderBy(desc(count()), asc(key))
    .limit(limit);
  return rows.map((row) => ({
    question:
      row.sample.length > QUESTION_MAX_LENGTH ? `${row.sample.slice(0, QUESTION_MAX_LENGTH - 1)}…` : row.sample,
    count: toNumber(row.n),
  }));
}

export async function getOpenGapCount(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(s.knowledgeGaps).where(eq(s.knowledgeGaps.status, 'open'));
  return toNumber(row?.n);
}

export async function getUnreadNotificationCount(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(s.notifications).where(isNull(s.notifications.readAt));
  return toNumber(row?.n);
}

// ---------------------------------------------------------------------------
// The dashboard in one call

export type DashboardStats = {
  today: string;
  visitors: VisitorStats;
  bookings: BookingStats;
  conversion: Conversion;
  topProducts: TopProduct[];
  topQuestions: TopQuestion[];
  openGaps: number;
  unreadNotifications: number;
  upcoming: UpcomingVisit[];
};

export async function getDashboardStats(now: Date = new Date(), handle?: Db): Promise<DashboardStats> {
  const db = handle ?? (await getDb());
  const visitors = await getVisitorStats(db, now);
  const [bookings, topProducts, topQuestions, openGaps, unreadNotifications, upcoming] = await Promise.all([
    getBookingStats(db, now),
    getTopProducts(db, now),
    getTopChatQuestions(db, now),
    getOpenGapCount(db),
    getUnreadNotificationCount(db),
    getUpcomingVisits(db, now),
  ]);
  return {
    today: colomboDate(now),
    visitors,
    bookings,
    conversion: conversionRate(bookings.made7Days, visitors.last7),
    topProducts,
    topQuestions,
    openGaps,
    unreadNotifications,
    upcoming,
  };
}

// ---------------------------------------------------------------------------
// Setup checklist input

export type ServiceStatus = {
  id: 'search-console' | 'openrouter' | 'resend' | 'indexnow';
  label: string;
  configured: boolean;
  /** Names of the environment variables to set on the host. Never their values. */
  vars: string[];
  effect: string;
};

/** Which optional services have their keys set. Presence only: the values are never read out. */
export function getServiceStatus(): ServiceStatus[] {
  return [
    {
      id: 'search-console',
      label: 'Google Search Console',
      configured: Boolean(env.GSC_SERVICE_ACCOUNT_JSON && env.GSC_SITE_URL),
      vars: ['GSC_SERVICE_ACCOUNT_JSON', 'GSC_SITE_URL'],
      effect: 'Clicks, impressions and search positions on the SEO page.',
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      configured: Boolean(env.OPENROUTER_API_KEY),
      vars: ['OPENROUTER_API_KEY'],
      effect: 'The chatbot can answer from the model. Without it, only FAQs and templates answer.',
    },
    {
      id: 'resend',
      label: 'Resend email',
      configured: Boolean(env.RESEND_API_KEY),
      vars: ['RESEND_API_KEY', 'ADMIN_ALERT_EMAIL'],
      effect: 'Alert and digest emails. The bell works without it.',
    },
    {
      id: 'indexnow',
      label: 'IndexNow',
      configured: Boolean(env.INDEXNOW_KEY),
      vars: ['INDEXNOW_KEY'],
      effect: 'Tells search engines at once when a page changes (switch it on above).',
    },
  ];
}

const FLAGGED = new Set(['borrowed', 'licence']);

/** Gathers what buildSetupChecklist needs. */
export async function loadSetupInput(handle?: Db): Promise<SetupInput> {
  const db = handle ?? (await getDb());
  const [settings, withoutPrice, needReview, approved, variants] = await Promise.all([
    readSettings(db),
    db
      .select({ n: count() })
      .from(s.products)
      .where(and(eq(s.products.status, 'published'), isNull(s.products.priceMinor))),
    db
      .select({ n: count() })
      .from(s.products)
      .where(and(eq(s.products.status, 'published'), sql`cardinality(${s.products.reviewNotes}) > 0`)),
    db.select({ n: count() }).from(s.reviews).where(eq(s.reviews.approved, true)),
    db.select({ images: s.productVariants.images }).from(s.productVariants),
  ]);
  const flaggedPhotos = variants.reduce(
    (sum, variant) => sum + variant.images.filter((image) => image.flag && FLAGGED.has(image.flag)).length,
    0,
  );
  const configured = new Map(getServiceStatus().map((service) => [service.id, service.configured]));
  return {
    settings,
    counts: {
      publishedWithoutPrice: toNumber(withoutPrice[0]?.n),
      flaggedPhotos,
      productsNeedingReview: toNumber(needReview[0]?.n),
      approvedReviews: toNumber(approved[0]?.n),
    },
    services: {
      searchConsole: configured.get('search-console') ?? false,
      openRouter: configured.get('openrouter') ?? false,
      resend: configured.get('resend') ?? false,
    },
  };
}
