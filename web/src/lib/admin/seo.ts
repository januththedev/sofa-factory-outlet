import 'server-only';

import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { evaluateSeoChecklist, type SeoCheckId, type SeoChecklist, type SeoScore } from '@/lib/admin/seo-checklist';
import { colomboToday } from '@/lib/bookings/rules';
import { type Db, type DbOrTx, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { getAllGuides } from '@/lib/guides';
import { type DailyRow, toDailyRows } from '@/lib/seo/gsc';
import { normaliseRedirectPath } from '@/lib/seo/redirects';
import {
  addDays,
  buildMonthlyReport,
  type ContentDue,
  dailyTrend,
  type GuideInfo,
  isMonthKey,
  keywordMap,
  matchPriority,
  type Metrics,
  monthBounds,
  type MonthlyReport,
  nextContentDue,
  normaliseQuery,
  type PriorityStat,
  prioritySearches,
  previousMonth,
  type ReportProduct,
  type SearchRow,
  summariseRows,
  type TrendPoint,
} from '@/lib/seo/report';
import { reviewStatus } from './reviews';

// Everything the SEO admin page reads and writes. Pages and actions check the
// session (requireRole) before they call anything here.

// ---------------------------------------------------------------------------
// Search Console data

const UPSERT_CHUNK = 500;
const OVERVIEW_DAYS = 28;
const TOP_PAGE_COUNT = 10;

/** Stores rows from the daily pull. Running it again with the same rows changes nothing. */
export async function upsertSearchConsoleRows(rows: DailyRow[]): Promise<number> {
  const shaped = toDailyRows(rows);
  if (shaped.length === 0) return 0;
  const db = await getDb();
  for (let start = 0; start < shaped.length; start += UPSERT_CHUNK) {
    await db
      .insert(s.searchConsoleDaily)
      .values(shaped.slice(start, start + UPSERT_CHUNK))
      .onConflictDoUpdate({
        target: [s.searchConsoleDaily.date, s.searchConsoleDaily.query, s.searchConsoleDaily.page],
        set: {
          clicks: sql`excluded.clicks`,
          impressions: sql`excluded.impressions`,
          ctr: sql`excluded.ctr`,
          position: sql`excluded.position`,
        },
      });
  }
  return shaped.length;
}

const daily = s.searchConsoleDaily;
const clicksSum = sql<number>`coalesce(sum(${daily.clicks}), 0)::int`;
const impressionsSum = sql<number>`coalesce(sum(${daily.impressions}), 0)::int`;
// Average position weighted by impressions, as Search Console itself reports it.
const positionAverage = sql<
  number | null
>`sum(${daily.position} * ${daily.impressions})::float8 / nullif(sum(${daily.impressions}), 0)`;

/** Daily rows for the priority searches only (matched ignoring case). */
async function priorityRows(db: Db, from: string, to: string, queries: string[]): Promise<SearchRow[]> {
  const wanted = queries.map(normaliseQuery);
  if (wanted.length === 0) return [];
  return db
    .select({
      date: daily.date,
      query: daily.query,
      clicks: daily.clicks,
      impressions: daily.impressions,
      position: daily.position,
    })
    .from(daily)
    .where(and(gte(daily.date, from), lte(daily.date, to), inArray(sql`lower(${daily.query})`, wanted)));
}

async function totalsBetween(db: Db, from: string, to: string): Promise<Metrics> {
  const [row] = await db
    .select({ clicks: clicksSum, impressions: impressionsSum, position: positionAverage })
    .from(daily)
    .where(and(gte(daily.date, from), lte(daily.date, to)));
  return { clicks: row.clicks, impressions: row.impressions, position: row.position };
}

export type PageStat = Metrics & { page: string };

export type SearchOverview = {
  from: string;
  to: string;
  /** Any Search Console row at all, so the page can tell "not synced yet" from "no matches". */
  hasData: boolean;
  /** The priority searches together. */
  totals: Metrics;
  priority: PriorityStat[];
  trend: TrendPoint[];
  topPages: PageStat[];
};

/** The last 28 days: the 20 priority searches, their daily trend, and the pages that earned the most clicks. */
export async function getSearchOverview(options: { days?: number; today?: string } = {}): Promise<SearchOverview> {
  const to = options.today ?? colomboToday();
  const from = addDays(to, -((options.days ?? OVERVIEW_DAYS) - 1));
  const searches = prioritySearches(keywordMap());
  const db = await getDb();
  const [rows, topPages, anyRow] = await Promise.all([
    priorityRows(
      db,
      from,
      to,
      searches.map((search) => search.query),
    ),
    db
      .select({ page: daily.page, clicks: clicksSum, impressions: impressionsSum, position: positionAverage })
      .from(daily)
      .where(and(gte(daily.date, from), lte(daily.date, to), ne(daily.page, '')))
      .groupBy(daily.page)
      .orderBy(desc(clicksSum), desc(impressionsSum), asc(daily.page))
      .limit(TOP_PAGE_COUNT),
    db.select({ id: daily.id }).from(daily).limit(1),
  ]);
  return {
    from,
    to,
    hasData: anyRow.length > 0,
    totals: summariseRows(rows),
    priority: matchPriority(rows, searches),
    trend: dailyTrend(rows, from),
    topPages,
  };
}

// ---------------------------------------------------------------------------
// SEO checklist per product

export type ProductSeoRow = {
  id: number;
  name: string;
  slug: string;
  status: s.ProductStatus;
  noindex: boolean;
  /** Null when the checklist could not be evaluated. */
  score: SeoScore | null;
  passed: number | null;
  total: number | null;
  failing: Array<{ id: SeoCheckId; label: string; detail: string }>;
};

export type ProductSeoReport = { rows: ProductSeoRow[]; checklistAvailable: boolean };

const SCORE_RANK: Record<SeoScore, number> = { red: 0, amber: 1, green: 2 };

/** The checklist result, or null if admin-products' evaluator is missing or throws. */
function tryEvaluate(input: Parameters<typeof evaluateSeoChecklist>[0]): SeoChecklist | null {
  try {
    return evaluateSeoChecklist(input);
  } catch {
    return null;
  }
}

/** Every product with its checklist score, the worst first. */
export async function getProductSeoReport(): Promise<ProductSeoReport> {
  const db = await getDb();
  const products = await db.query.products.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
      status: true,
      noindex: true,
      seoTitle: true,
      seoDescription: true,
      descriptionMd: true,
      priceMinor: true,
      tags: true,
    },
    with: { variants: { columns: { images: true } } },
    orderBy: [asc(s.products.name)],
  });
  let available = false;
  const rows = products.map((product): ProductSeoRow => {
    const seen = new Set<string>();
    let photosWithAlt = 0;
    for (const variant of product.variants) {
      for (const image of variant.images) {
        if (seen.has(image.key)) continue;
        seen.add(image.key);
        if (image.alt.trim()) photosWithAlt += 1;
      }
    }
    const checklist = tryEvaluate({
      name: product.name,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      photoCount: seen.size,
      photosWithAlt,
      descriptionMd: product.descriptionMd,
      priceMinor: product.priceMinor,
      tags: product.tags,
    });
    if (checklist) available = true;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      noindex: product.noindex,
      score: checklist?.score ?? null,
      passed: checklist?.passed ?? null,
      total: checklist?.total ?? null,
      failing: (checklist?.checks ?? [])
        .filter((check) => !check.pass)
        .map((check) => ({ id: check.id, label: check.label, detail: check.detail })),
    };
  });
  const rank = (row: ProductSeoRow) => (row.score === null ? 3 : SCORE_RANK[row.score]);
  rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return { rows, checklistAvailable: available };
}

// ---------------------------------------------------------------------------
// Pages with problems

export type SeoProblems = {
  checklistAvailable: boolean;
  /** Published products that are not green. */
  weakProducts: Array<{ id: number; name: string; score: 'amber' | 'red'; failing: string[] }>;
  noindexProducts: Array<{ id: number; name: string; slug: string }>;
  /** Redirects from hidden products that visitors still use. */
  hiddenWithRedirects: Array<{ id: number; from: string; to: string | null; hits: number; productName: string | null }>;
};

export async function getSeoProblems(): Promise<SeoProblems> {
  const report = await getProductSeoReport();
  const published = report.rows.filter((row) => row.status === 'published');
  const weakProducts = published.flatMap((row) =>
    row.score === 'amber' || row.score === 'red'
      ? [{ id: row.id, name: row.name, score: row.score, failing: row.failing.map((check) => check.label) }]
      : [],
  );
  const noindexProducts = published
    .filter((row) => row.noindex)
    .map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
  const db = await getDb();
  const hiddenWithRedirects = await db
    .select({
      id: s.redirects.id,
      from: s.redirects.fromPath,
      to: s.redirects.toPath,
      hits: s.redirects.hits,
      productName: s.products.name,
    })
    .from(s.redirects)
    .leftJoin(s.products, eq(s.products.id, s.redirects.productId))
    .where(
      and(gt(s.redirects.hits, 0), or(eq(s.redirects.reason, 'hidden-product'), eq(s.products.status, 'hidden'))),
    )
    .orderBy(desc(s.redirects.hits), asc(s.redirects.fromPath))
    .limit(20);
  return { checklistAvailable: report.checklistAvailable, weakProducts, noindexProducts, hiddenWithRedirects };
}

// ---------------------------------------------------------------------------
// Redirects: checking what staff type

export type RedirectStatus = 301 | 410;
export type RedirectField = 'from' | 'to' | 'status';
export type RedirectInput = { from: string; to?: string | null; status: number };
export type ExistingRedirect = { id: number; from: string; to: string | null; status: RedirectStatus };
export type ValidRedirect = { from: string; to: string | null; status: RedirectStatus };
export type RedirectCheck =
  | { ok: true; value: ValidRedirect }
  | { ok: false; errors: Partial<Record<RedirectField, string>> };

const PATH_MAX = 500;
const RESERVED_PREFIXES = ['/admin/', '/api/', '/_next/'];

type Parsed = { value: string } | { error: string };

/** The old address: a path on this site, always stored with a trailing slash. */
function checkSource(raw: string): Parsed {
  const text = raw.trim();
  if (!text.startsWith('/') || text.startsWith('//')) {
    return { error: 'The old address must be a path on this site that starts with / (for example /old-page/).' };
  }
  if (/[\s?#]/.test(text)) return { error: 'The old address cannot contain spaces, ? or #.' };
  if (text.length > PATH_MAX) return { error: `The old address must be under ${PATH_MAX} characters.` };
  const value = normaliseRedirectPath(text);
  if (value === '/') return { error: 'The home page cannot be redirected.' };
  if (RESERVED_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return { error: 'Admin and system addresses cannot be redirected.' };
  }
  return { value };
}

function splitTarget(text: string): { path: string; suffix: string } {
  const index = text.search(/[?#]/);
  return index === -1 ? { path: text, suffix: '' } : { path: text.slice(0, index), suffix: text.slice(index) };
}

/** The new address: a path on this site, optionally with a query string. `path` is the part before it. */
function checkTarget(raw: string): { error: string } | { value: string; path: string } {
  const text = raw.trim();
  if (!text) return { error: 'Enter the page people should be sent to.' };
  if (!text.startsWith('/') || text.startsWith('//')) {
    return { error: 'The new address must be a path on this site that starts with / (for example /shop/).' };
  }
  if (/\s/.test(text)) return { error: 'The new address cannot contain spaces.' };
  if (text.length > PATH_MAX) return { error: `The new address must be under ${PATH_MAX} characters.` };
  const { path, suffix } = splitTarget(text);
  const normalised = normaliseRedirectPath(path);
  return { value: `${normalised}${suffix}`, path: normalised };
}

const targetPathOf = (to: string): string => normaliseRedirectPath(splitTarget(to).path);

/**
 * Checks a redirect before it is saved. Besides the shape of the addresses, no redirect may point at a
 * page that is itself redirected (so there are no chains), and no old address may already be the
 * destination of another redirect. Together that rules out loops. `editingId` leaves the redirect
 * being edited out of the comparison.
 */
export function validateRedirect(
  input: RedirectInput,
  existing: ExistingRedirect[],
  editingId?: number,
): RedirectCheck {
  const errors: Partial<Record<RedirectField, string>> = {};
  const others = existing.filter((row) => row.id !== editingId);
  const status = input.status === 301 || input.status === 410 ? input.status : null;
  if (status === null) errors.status = 'Choose 301 (moved) or 410 (gone).';

  const source = checkSource(input.from);
  if ('error' in source) errors.from = source.error;
  const from = 'value' in source ? source.value : null;

  const target = status === 301 ? checkTarget(input.to ?? '') : null;
  if (target && 'error' in target) errors.to = target.error;
  const to = target && 'value' in target ? target.value : null;
  const toPath = target && 'value' in target ? target.path : null;

  if (from) {
    const same = others.find((row) => normaliseRedirectPath(row.from) === from);
    const pointsHere = others.find((row) => row.to !== null && targetPathOf(row.to) === from);
    if (same) {
      errors.from = 'A redirect from this address already exists. Edit that one instead.';
    } else if (pointsHere) {
      errors.from =
        `${pointsHere.from} already redirects here. ` +
        'Point it at the final page first, so nobody goes through two redirects.';
    }
  }
  if (from && toPath) {
    const next = others.find((row) => normaliseRedirectPath(row.from) === toPath);
    if (toPath === from) {
      errors.to = 'A page cannot redirect to itself.';
    } else if (next) {
      errors.to =
        next.status === 410 || next.to === null
          ? `${toPath} has been removed (410), so it cannot be where people are sent.`
          : `${toPath} is itself redirected to ${next.to}. Send people there instead, so there is no chain.`;
    }
  }

  if (Object.keys(errors).length > 0 || status === null || from === null) return { ok: false, errors };
  return { ok: true, value: { from, to: status === 301 ? to : null, status } };
}

// ---------------------------------------------------------------------------
// Redirects: the table

export type RedirectRow = {
  id: number;
  from: string;
  to: string | null;
  status: RedirectStatus;
  reason: 'hidden-product' | 'slug-change' | 'deleted' | 'manual';
  hits: number;
  updatedAt: string;
};

export type RedirectWrite =
  | { ok: true; id: number }
  | { ok: false; errors: Partial<Record<RedirectField | 'form', string>> };

export async function listRedirects(limit = 500): Promise<RedirectRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.redirects)
    .orderBy(desc(s.redirects.hits), desc(s.redirects.updatedAt), asc(s.redirects.fromPath))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    from: row.fromPath,
    to: row.toPath,
    status: row.status,
    reason: row.reason,
    hits: row.hits,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function existingRedirects(db: DbOrTx): Promise<ExistingRedirect[]> {
  return db
    .select({ id: s.redirects.id, from: s.redirects.fromPath, to: s.redirects.toPath, status: s.redirects.status })
    .from(s.redirects);
}

/** Adds a manual redirect (301 moved or 410 gone) after checking it. */
export async function createRedirect(input: RedirectInput): Promise<RedirectWrite> {
  try {
    const db = await getDb();
    return await db.transaction(async (tx): Promise<RedirectWrite> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('redirects'))`);
      const check = validateRedirect(input, await existingRedirects(tx));
      if (!check.ok) return check;
      const [row] = await tx
        .insert(s.redirects)
        .values({ fromPath: check.value.from, toPath: check.value.to, status: check.value.status, reason: 'manual' })
        .returning({ id: s.redirects.id });
      return { ok: true, id: row.id };
    });
  } catch (error) {
    console.error('[seo] could not add a redirect:', error);
    return { ok: false, errors: { form: 'The redirect could not be saved. Please try again.' } };
  }
}

/** Changes a redirect. Its hit count and reason stay as they were. */
export async function updateRedirect(id: number, input: RedirectInput): Promise<RedirectWrite> {
  try {
    const db = await getDb();
    return await db.transaction(async (tx): Promise<RedirectWrite> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('redirects'))`);
      const existing = await existingRedirects(tx);
      if (!existing.some((row) => row.id === id)) {
        return { ok: false, errors: { form: 'That redirect no longer exists.' } };
      }
      const check = validateRedirect(input, existing, id);
      if (!check.ok) return check;
      await tx
        .update(s.redirects)
        .set({ fromPath: check.value.from, toPath: check.value.to, status: check.value.status, updatedAt: new Date() })
        .where(eq(s.redirects.id, id));
      return { ok: true, id };
    });
  } catch (error) {
    console.error('[seo] could not change a redirect:', error);
    return { ok: false, errors: { form: 'The redirect could not be saved. Please try again.' } };
  }
}

export async function deleteRedirect(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(s.redirects).where(eq(s.redirects.id, id)).returning({ id: s.redirects.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Review requests

export type ReviewRequestStats = {
  bookingsAsked: number;
  invoicesAsked: number;
  totalAsked: number;
  approvedReviews: number;
  averageRating: number | null;
  waitingReviews: number;
};

/** Review-request links sent (from the bookings and invoices screens) and the rating from approved reviews. */
export async function getReviewRequestStats(): Promise<ReviewRequestStats> {
  const db = await getDb();
  const count = sql<number>`count(*)::int`;
  const undecided = sql`not ${s.reviews.approved} and ${s.reviews.approvedAt} is null`;
  const [bookings, invoices, ratings] = await Promise.all([
    db.select({ n: count }).from(s.bookings).where(isNotNull(s.bookings.reviewRequestedAt)),
    db.select({ n: count }).from(s.invoices).where(isNotNull(s.invoices.reviewRequestedAt)),
    db
      .select({
        approved: sql<number>`count(*) filter (where ${s.reviews.approved})::int`,
        waiting: sql<number>`count(*) filter (where ${undecided})::int`,
        average: sql<number | null>`avg(${s.reviews.rating}) filter (where ${s.reviews.approved})::float8`,
      })
      .from(s.reviews),
  ]);
  const average = ratings[0].average;
  return {
    bookingsAsked: bookings[0].n,
    invoicesAsked: invoices[0].n,
    totalAsked: bookings[0].n + invoices[0].n,
    approvedReviews: ratings[0].approved,
    averageRating: average === null ? null : Math.round(average * 10) / 10,
    waitingReviews: ratings[0].waiting,
  };
}

// ---------------------------------------------------------------------------
// Monthly report

/** Pages that exist without being categories: the home page, factory, visit and the guides index. */
const STATIC_PAGES = ['/', '/factory/', '/visit/', '/guides/'];

async function publishedGuides(): Promise<GuideInfo[]> {
  try {
    const guides = await getAllGuides();
    return guides.map((guide) => ({
      slug: guide.slug,
      title: guide.title,
      description: guide.description,
      tags: guide.tags,
    }));
  } catch (error) {
    console.error('[seo] could not read the guides:', error);
    return [];
  }
}

/** The next guides or pages the keyword map still needs. */
export async function getContentDue(count = 2): Promise<ContentDue[]> {
  const db = await getDb();
  const categories = await db.select({ path: s.categories.path }).from(s.categories);
  const existing = new Set([...STATIC_PAGES, ...categories.map((category) => normaliseRedirectPath(category.path))]);
  return nextContentDue(keywordMap(), existing, await publishedGuides(), count);
}

/** Reviews that arrived in the month, by Sri Lanka calendar day. */
async function reviewsInMonth(db: Db, from: string, to: string) {
  const day = sql`(${s.reviews.createdAt} at time zone 'Asia/Colombo')::date`;
  const rows = await db
    .select({ rating: s.reviews.rating, approved: s.reviews.approved, approvedAt: s.reviews.approvedAt })
    .from(s.reviews)
    .where(and(gte(day, from), lte(day, to)));
  return rows.map((row) => ({ rating: row.rating, status: reviewStatus(row) }));
}

/** A report for one month ('YYYY-MM'); anything else gives the month just ended. */
export async function getMonthlyReport(month: string, options: { today?: string } = {}): Promise<MonthlyReport> {
  const today = options.today ?? colomboToday();
  const chosen = isMonthKey(month) ? month : previousMonth(today.slice(0, 7));
  const { from, to } = monthBounds(chosen);
  const before = monthBounds(previousMonth(chosen));
  const searches = prioritySearches(keywordMap());
  const db = await getDb();
  const [rows, totals, previousTotals, reviews, productReport, contentDue] = await Promise.all([
    priorityRows(
      db,
      before.from,
      to,
      searches.map((search) => search.query),
    ),
    totalsBetween(db, from, to),
    totalsBetween(db, before.from, before.to),
    reviewsInMonth(db, from, to),
    getProductSeoReport(),
    getContentDue(),
  ]);
  const products: ReportProduct[] | null = productReport.checklistAvailable
    ? productReport.rows.flatMap((row) =>
        row.status === 'published' && row.score !== null
          ? [{ id: row.id, name: row.name, score: row.score, failing: row.failing.map((check) => check.label) }]
          : [],
      )
    : null;
  return buildMonthlyReport({
    month: chosen,
    searches,
    rows: rows.filter((row) => row.date >= from),
    previousRows: rows.filter((row) => row.date < from),
    totals,
    previousTotals,
    reviews,
    products,
    contentDue,
  });
}
