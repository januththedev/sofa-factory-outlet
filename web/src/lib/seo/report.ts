import keywordMapJson from '@content/seo/keyword-map.json';
import { z } from 'zod';
import { normaliseRedirectPath } from './redirects';

// Pure logic behind the SEO admin page and the monthly report: the keyword map,
// the 20 priority searches, aggregation of Search Console rows, the content
// due next, and the report itself with its text and CSV renderings. Nothing in
// here touches the database or the network, so every function is unit-tested.

export const PRIORITY_SEARCH_COUNT = 20;

// ---------------------------------------------------------------------------
// Keyword map (content/seo/keyword-map.json)

const clusterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  searches: z.array(z.string().min(1)),
  page: z.string().min(1),
  status: z.string().default('pending'),
  volume: z.number().nullable().optional(),
  serpNotes: z.string().nullable().optional(),
});

const keywordMapSchema = z.object({ clusters: z.array(clusterSchema) });

export type KeywordCluster = z.infer<typeof clusterSchema>;
export type KeywordMap = z.infer<typeof keywordMapSchema>;

export function parseKeywordMap(json: unknown): KeywordMap {
  return keywordMapSchema.parse(json);
}

let cachedMap: KeywordMap | undefined;

/** The keyword map shipped with the site, parsed once. */
export function keywordMap(): KeywordMap {
  cachedMap ??= parseKeywordMap(keywordMapJson);
  return cachedMap;
}

/** Lower-case, single-spaced form used to compare searches. */
export function normaliseQuery(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export type PrioritySearch = { query: string; cluster: string; page: string };

/**
 * The priority searches are the first 20 searches listed in the keyword map
 * (clusters in file order, searches in cluster order). A search that appears
 * twice counts once.
 */
export function prioritySearches(map: KeywordMap, limit = PRIORITY_SEARCH_COUNT): PrioritySearch[] {
  const seen = new Set<string>();
  const picked: PrioritySearch[] = [];
  for (const cluster of map.clusters) {
    for (const query of cluster.searches) {
      const key = normaliseQuery(query);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      picked.push({ query, cluster: cluster.name, page: cluster.page });
      if (picked.length >= limit) return picked;
    }
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Dates

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isIsoDate = (value: string): boolean => DATE_PATTERN.test(value);

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export const isMonthKey = (value: string): boolean => MONTH_PATTERN.test(value);

function monthParts(month: string): { year: number; number: number } {
  const [year, number] = month.split('-').map(Number);
  return { year, number };
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** First and last calendar day of a 'YYYY-MM' month. */
export function monthBounds(month: string): { from: string; to: string } {
  const { year, number } = monthParts(month);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` };
}

export function previousMonth(month: string): string {
  const { year, number } = monthParts(month);
  const date = new Date(Date.UTC(year, number - 2, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** The current month and the ones before it, newest first, for the month picker. */
export function monthOptions(today: string, count = 12): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  let month = today.slice(0, 7);
  for (let index = 0; index < count; index += 1) {
    options.push({ value: month, label: monthLabel(month) });
    month = previousMonth(month);
  }
  return options;
}

// ---------------------------------------------------------------------------
// Aggregating Search Console rows

export type SearchRow = { date: string; query: string; clicks: number; impressions: number; position: number };
export type Metrics = { clicks: number; impressions: number; position: number | null };
export type PriorityStat = Metrics & PrioritySearch;
export type TrendPoint = { date: string; clicks: number; impressions: number };

/** Sums clicks and impressions; position is the average weighted by impressions. */
export function summariseRows(rows: Array<Pick<SearchRow, 'clicks' | 'impressions' | 'position'>>): Metrics {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weighted += row.position * row.impressions;
  }
  return { clicks, impressions, position: impressions > 0 ? weighted / impressions : null };
}

/** Totals for several already-summarised groups (for example the 20 priority searches together). */
export function combineMetrics(groups: Metrics[]): Metrics {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const group of groups) {
    clicks += group.clicks;
    impressions += group.impressions;
    weighted += (group.position ?? 0) * group.impressions;
  }
  return { clicks, impressions, position: impressions > 0 ? weighted / impressions : null };
}

/** One entry per priority search, in priority order. Matching ignores case and extra spaces. */
export function matchPriority(rows: SearchRow[], searches: PrioritySearch[]): PriorityStat[] {
  const buckets = new Map<string, SearchRow[]>();
  for (const search of searches) buckets.set(normaliseQuery(search.query), []);
  for (const row of rows) buckets.get(normaliseQuery(row.query))?.push(row);
  return searches.map((search) => ({ ...search, ...summariseRows(buckets.get(normaliseQuery(search.query)) ?? []) }));
}

/** Clicks and impressions per day, with quiet days filled in as zero, up to the last day that has data. */
export function dailyTrend(rows: SearchRow[], from: string): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const row of rows) {
    if (row.date < from) continue;
    const point = byDate.get(row.date) ?? { date: row.date, clicks: 0, impressions: 0 };
    point.clicks += row.clicks;
    point.impressions += row.impressions;
    byDate.set(row.date, point);
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return [];
  const last = dates[dates.length - 1];
  const points: TrendPoint[] = [];
  for (let date = from; date <= last; date = addDays(date, 1)) {
    points.push(byDate.get(date) ?? { date, clicks: 0, impressions: 0 });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Content due next

export type GuideInfo = { slug: string; title: string; description: string; tags: string[] };

export type ContentDue = {
  kind: 'guide' | 'page';
  title: string;
  searches: string[];
  /** Where it will live: the page for a cluster, or the guides index for a guide. */
  page: string;
  cluster: string;
  /** Planned for later (the keyword map marks the cluster `later`), so listed only when nothing else is due. */
  later: boolean;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'for',
  'how',
  'in',
  'is',
  'my',
  'of',
  'on',
  'the',
  'to',
  'what',
  'with',
]);

const stem = (word: string): string => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((word) => word && !STOP_WORDS.has(word))
    .map(stem);
}

/**
 * A guide answers a search when its title, slug, tags and description contain the search's words
 * (a longer word in the guide counts: "humidity" covers "humid"). One missing word is forgiven
 * once a search has four or more words.
 */
export function guideCoversSearch(guide: GuideInfo, search: string): boolean {
  const wanted = significantWords(search);
  if (wanted.length === 0) return false;
  const text = [guide.title, guide.slug.replace(/-/g, ' '), guide.tags.join(' '), guide.description].join(' ');
  const have = significantWords(text);
  const present = (word: string): boolean =>
    have.some((other) => other === word || (word.length >= 4 && other.startsWith(word)));
  const found = wanted.filter(present);
  const allowedMisses = wanted.length >= 4 ? 1 : 0;
  return found.length >= wanted.length - allowedMisses;
}

const capitalise = (text: string): string => (text ? text[0].toUpperCase() + text.slice(1) : text);

/**
 * The next pieces of content to write, in the order the keyword map lists them: a guide for every
 * search of a guides cluster that no published guide covers yet, and the page of every other
 * cluster that does not exist yet. Clusters marked `later` come last.
 */
export function nextContentDue(
  map: KeywordMap,
  existingPages: ReadonlySet<string>,
  guides: GuideInfo[],
  count = 2,
): ContentDue[] {
  const now: ContentDue[] = [];
  const later: ContentDue[] = [];
  for (const cluster of map.clusters) {
    const page = normaliseRedirectPath(cluster.page);
    const isLater = cluster.status === 'later';
    const target = isLater ? later : now;
    if (page.startsWith('/guides/')) {
      for (const search of cluster.searches) {
        if (guides.some((guide) => guideCoversSearch(guide, search))) continue;
        target.push({
          kind: 'guide',
          title: capitalise(search),
          searches: [search],
          page: '/guides/',
          cluster: cluster.name,
          later: isLater,
        });
      }
    } else if (!existingPages.has(page)) {
      target.push({
        kind: 'page',
        title: cluster.name,
        searches: cluster.searches,
        page,
        cluster: cluster.name,
        later: isLater,
      });
    }
  }
  return [...now, ...later].slice(0, count);
}

// ---------------------------------------------------------------------------
// The monthly report

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewSummary = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  averageRating: number | null;
};
export type ReportProduct = {
  id: number;
  name: string;
  score: 'green' | 'amber' | 'red';
  failing: string[];
};

export type ReportInput = {
  month: string;
  searches: PrioritySearch[];
  /** Rows for the priority searches inside the month. */
  rows: SearchRow[];
  /** Rows for the priority searches inside the month before. */
  previousRows: SearchRow[];
  /** All searches Google reported, for the month and the month before. */
  totals: Metrics;
  previousTotals: Metrics;
  /** Reviews that arrived during the month. */
  reviews: Array<{ rating: number; status: ReviewStatus }>;
  /** Null when the SEO checklist could not be evaluated. */
  products: ReportProduct[] | null;
  contentDue: ContentDue[];
};

export type RankingRow = PriorityStat & { previousPosition: number | null; change: number | null };

export type MonthlyReport = {
  month: string;
  label: string;
  from: string;
  to: string;
  hasSearchData: boolean;
  totals: Metrics;
  previousTotals: Metrics;
  priorityTotals: Metrics;
  rankings: RankingRow[];
  reviews: ReviewSummary;
  productsBelowGreen: ReportProduct[] | null;
  contentDue: ContentDue[];
};

const roundTo = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** New reviews counted by what the team decided; the average rating is over the approved ones. */
export function summariseReviews(reviews: Array<{ rating: number; status: ReviewStatus }>): ReviewSummary {
  const approved = reviews.filter((review) => review.status === 'approved');
  const total = approved.reduce((sum, review) => sum + review.rating, 0);
  return {
    total: reviews.length,
    approved: approved.length,
    pending: reviews.filter((review) => review.status === 'pending').length,
    rejected: reviews.filter((review) => review.status === 'rejected').length,
    averageRating: approved.length ? roundTo(total / approved.length, 1) : null,
  };
}

const SCORE_ORDER = { red: 0, amber: 1, green: 2 } as const;

export function buildMonthlyReport(input: ReportInput): MonthlyReport {
  const { from, to } = monthBounds(input.month);
  const current = matchPriority(input.rows, input.searches);
  const before = matchPriority(input.previousRows, input.searches);
  const rankings = current.map((stat, index): RankingRow => {
    const previousPosition = before[index]?.position ?? null;
    const position = stat.position;
    const change = previousPosition !== null && position !== null ? roundTo(previousPosition - position, 1) : null;
    return { ...stat, previousPosition, change };
  });
  const productsBelowGreen = input.products
    ? input.products
        .filter((product) => product.score !== 'green')
        .sort((a, b) => SCORE_ORDER[a.score] - SCORE_ORDER[b.score] || a.name.localeCompare(b.name))
    : null;
  return {
    month: input.month,
    label: monthLabel(input.month),
    from,
    to,
    hasSearchData: input.totals.impressions > 0 || rankings.some((row) => row.impressions > 0),
    totals: input.totals,
    previousTotals: input.previousTotals,
    priorityTotals: combineMetrics(rankings),
    rankings,
    reviews: summariseReviews(input.reviews),
    productsBelowGreen,
    contentDue: input.contentDue,
  };
}

// ---------------------------------------------------------------------------
// Report text and CSV

export const formatCount = (value: number): string => new Intl.NumberFormat('en-GB').format(value);

export const formatPosition = (value: number | null): string => (value === null ? '—' : value.toFixed(1));

function describeChange(change: number | null): string {
  if (change === null) return 'no earlier figure';
  if (change === 0) return 'unchanged';
  return change > 0 ? `up ${change.toFixed(1)}` : `down ${Math.abs(change).toFixed(1)}`;
}

function searchLines(report: MonthlyReport): string[] {
  if (!report.hasSearchData) return ['Search Console: no data for this month yet.'];
  const { totals, previousTotals } = report;
  const now = `${formatCount(totals.clicks)} clicks, ${formatCount(totals.impressions)} impressions`;
  const before = `${formatCount(previousTotals.clicks)} clicks, ${formatCount(previousTotals.impressions)} impressions`;
  return [
    `Search Console, all searches Google reported: ${now}, average position ${formatPosition(totals.position)}.`,
    `The month before: ${before}.`,
  ];
}

function reviewLines(reviews: ReviewSummary): string[] {
  const counts = `${reviews.approved} approved, ${reviews.pending} waiting, ${reviews.rejected} rejected`;
  const lines = [`New reviews: ${reviews.total} (${counts}).`];
  if (reviews.averageRating !== null) {
    lines.push(`Average rating of the approved ones: ${reviews.averageRating.toFixed(1)} out of 5.`);
  }
  return lines;
}

function productLines(products: ReportProduct[] | null): string[] {
  if (products === null) return ['Products below green: the SEO checklist could not be read.'];
  if (products.length === 0) return ['Products below green: none.'];
  const lines = [`Products below green (${products.length}):`];
  for (const product of products) {
    lines.push(`- ${product.name} (${product.score}): ${product.failing.join(', ') || 'see the checklist'}`);
  }
  return lines;
}

function contentLines(items: ContentDue[]): string[] {
  if (items.length === 0) return ['Next content due: nothing listed in the keyword map.'];
  const lines = ['Next content due:'];
  for (const item of items) {
    const note = item.later ? ' (planned for later)' : '';
    const what = item.kind === 'guide' ? 'a guide' : 'the page';
    lines.push(`- ${item.title}${note}: ${what} for ${item.searches.join('; ')}`);
  }
  return lines;
}

/** Plain text for pasting into a message or an email. */
export function reportToText(report: MonthlyReport): string {
  const lines: string[] = [`SEO report for ${report.label}`, ''];
  lines.push(...searchLines(report));
  lines.push('', `Priority searches (${report.rankings.length}):`);
  report.rankings.forEach((row, index) => {
    const moved = describeChange(row.change);
    const traffic = `${formatCount(row.clicks)} clicks, ${formatCount(row.impressions)} impressions`;
    lines.push(`${index + 1}. ${row.query}: position ${formatPosition(row.position)} (${moved}), ${traffic}`);
  });
  lines.push('', ...reviewLines(report.reviews));
  lines.push('', ...productLines(report.productsBelowGreen));
  lines.push('', ...contentLines(report.contentDue));
  return `${lines.join('\n')}\n`;
}

/** Spreadsheet programs run text that starts with these characters as a formula. */
function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The rankings table, one row per priority search. */
export function reportToCsv(report: MonthlyReport): string {
  const header = ['Search', 'Target page', 'Clicks', 'Impressions', 'Average position', 'Previous position', 'Change'];
  const lines = report.rankings.map((row) =>
    [
      csvText(row.query),
      csvText(row.page),
      String(row.clicks),
      String(row.impressions),
      row.position === null ? '' : row.position.toFixed(1),
      row.previousPosition === null ? '' : row.previousPosition.toFixed(1),
      row.change === null ? '' : row.change.toFixed(1),
    ].join(','),
  );
  return `${[header.join(','), ...lines].join('\r\n')}\r\n`;
}
