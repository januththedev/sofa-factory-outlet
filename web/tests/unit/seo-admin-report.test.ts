import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildMonthlyReport,
  combineMetrics,
  dailyTrend,
  type GuideInfo,
  guideCoversSearch,
  isMonthKey,
  keywordMap,
  type KeywordMap,
  matchPriority,
  monthBounds,
  monthLabel,
  monthOptions,
  nextContentDue,
  normaliseQuery,
  parseKeywordMap,
  previousMonth,
  prioritySearches,
  type ReportInput,
  reportToCsv,
  reportToText,
  type SearchRow,
  summariseReviews,
  summariseRows,
} from '@/lib/seo/report';

const cluster = (id: string, searches: string[], page: string, status = 'pending') => ({
  id,
  name: `Cluster ${id}`,
  searches,
  page,
  status,
  volume: null,
  serpNotes: null,
});

const fixtureMap: KeywordMap = {
  clusters: [
    cluster('brand', ['sofa factory outlet'], '/'),
    cluster('sofas', ['sofa Sri Lanka', 'Sofa  Sri Lanka', 'sofa shop Colombo'], '/sofas/'),
    cluster('velvet', ['velvet sofa'], '/sofas/velvet/'),
    cluster('questions', ['best sofa fabric for humid weather', 'how to clean a velvet sofa'], '/guides/'),
    cluster('sinhala', ['sofa set mila'], '/si/', 'later'),
  ],
};

const fabricsGuide: GuideInfo = {
  slug: 'sofa-fabrics-for-sri-lankas-humid-climate',
  title: "The best sofa fabrics for Sri Lanka's humid climate",
  description:
    "Which sofa fabric suits Sri Lanka's humidity? A practical guide to velvet, leather, corduroy, woven and " +
    'suede-feel fabrics, and how to care for them at home.',
  tags: ['fabric', 'velvet', 'leather', 'care'],
};

const shapesGuide: GuideInfo = {
  slug: 'l-shape-u-shape-or-3-2-1-which-fits-your-living-room',
  title: 'L-shape, U-shape or 3+2+1: which fits your living room',
  description:
    'L-shape, U-shape or 3+2+1? How to measure your living room, keep the walkways clear and choose the sofa ' +
    'shape that suits your space, layout and household.',
  tags: ['l-shape', 'u-shape', 'sets', 'living-room'],
};

const row = (date: string, query: string, clicks: number, impressions: number, position: number): SearchRow => ({
  date,
  query,
  clicks,
  impressions,
  position,
});

describe('the keyword map and the 20 priority searches', () => {
  it('reads the keyword map that ships with the site', () => {
    const map = keywordMap();
    expect(map.clusters.length).toBeGreaterThan(5);
    expect(map.clusters.every((item) => item.searches.length > 0 && item.page.startsWith('/'))).toBe(true);
  });

  it('takes the first 20 searches in the order the map lists them', () => {
    const map = keywordMap();
    const listed = map.clusters.flatMap((item) => item.searches);
    const picked = prioritySearches(map);
    expect(picked).toHaveLength(20);
    expect(picked.map((item) => item.query)).toEqual(listed.slice(0, 20));
    expect(picked[0]).toMatchObject({ cluster: map.clusters[0].name, page: map.clusters[0].page });
  });

  it('counts a search that is listed twice once, ignoring case and extra spaces', () => {
    const picked = prioritySearches(fixtureMap, 5);
    expect(picked.map((item) => item.query)).toEqual([
      'sofa factory outlet',
      'sofa Sri Lanka',
      'sofa shop Colombo',
      'velvet sofa',
      'best sofa fabric for humid weather',
    ]);
  });

  it('returns fewer than the limit when the map lists fewer searches', () => {
    expect(prioritySearches({ clusters: [] })).toEqual([]);
    expect(prioritySearches(fixtureMap, 100)).toHaveLength(7);
  });

  it('rejects a keyword map that is not shaped like one', () => {
    expect(() => parseKeywordMap({ clusters: 'nope' })).toThrow();
    expect(() => parseKeywordMap(null)).toThrow();
    expect(parseKeywordMap({ clusters: [{ id: 'a', name: 'A', searches: ['x'], page: '/' }] }).clusters[0].status).toBe(
      'pending',
    );
  });

  it('normalises a search to lower case with single spaces', () => {
    expect(normaliseQuery('  Sofa   Sri\tLanka ')).toBe('sofa sri lanka');
    expect(normaliseQuery('සෝෆා')).toBe('සෝෆා');
  });
});

describe('matching Search Console rows to the priority searches', () => {
  const searches = prioritySearches(fixtureMap, 3);

  it('matches ignoring case and spacing, and keeps the priority order', () => {
    const stats = matchPriority(
      [
        row('2026-10-01', 'sofa shop colombo', 1, 10, 5),
        row('2026-10-01', 'SOFA  SRI LANKA', 2, 20, 3),
        row('2026-10-02', 'sofa sri lanka', 3, 30, 4),
      ],
      searches,
    );
    expect(stats.map((stat) => stat.query)).toEqual(['sofa factory outlet', 'sofa Sri Lanka', 'sofa shop Colombo']);
    expect(stats[1]).toMatchObject({ clicks: 5, impressions: 50 });
    expect(stats[2]).toMatchObject({ clicks: 1, impressions: 10, position: 5 });
  });

  it('averages position by impressions, not by row', () => {
    const [stat] = matchPriority(
      [row('2026-10-01', 'sofa factory outlet', 1, 100, 2), row('2026-10-02', 'sofa factory outlet', 1, 300, 4)],
      searches,
    );
    expect(stat.position).toBeCloseTo(3.5, 5);
  });

  it('reports a search with no rows as zero with no position', () => {
    const [stat] = matchPriority([row('2026-10-01', 'something else', 9, 9, 1)], searches);
    expect(stat).toMatchObject({ clicks: 0, impressions: 0, position: null });
  });

  it('summarises and combines metrics', () => {
    expect(summariseRows([])).toEqual({ clicks: 0, impressions: 0, position: null });
    const combined = combineMetrics([
      { clicks: 2, impressions: 100, position: 2 },
      { clicks: 1, impressions: 100, position: 4 },
      { clicks: 0, impressions: 0, position: null },
    ]);
    expect(combined).toEqual({ clicks: 3, impressions: 200, position: 3 });
  });
});

describe('daily trend', () => {
  it('adds up each day, fills quiet days with zero and stops at the last day with data', () => {
    const trend = dailyTrend(
      [
        row('2026-10-01', 'a', 1, 10, 3),
        row('2026-10-01', 'b', 2, 20, 3),
        row('2026-10-04', 'a', 5, 50, 3),
        row('2026-09-30', 'a', 99, 99, 3),
      ],
      '2026-10-01',
    );
    expect(trend).toEqual([
      { date: '2026-10-01', clicks: 3, impressions: 30 },
      { date: '2026-10-02', clicks: 0, impressions: 0 },
      { date: '2026-10-03', clicks: 0, impressions: 0 },
      { date: '2026-10-04', clicks: 5, impressions: 50 },
    ]);
  });

  it('is empty when there is nothing to show', () => {
    expect(dailyTrend([], '2026-10-01')).toEqual([]);
    expect(dailyTrend([row('2026-09-01', 'a', 1, 1, 1)], '2026-10-01')).toEqual([]);
  });
});

describe('months', () => {
  it('moves across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('finds the first and last day of a month, leap years included', () => {
    expect(monthBounds('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('finds the month before, across a year end', () => {
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('labels a month and recognises month keys', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
    expect(isMonthKey('')).toBe(false);
  });

  it('lists the current month first and then the ones before it', () => {
    const options = monthOptions('2026-01-15', 3);
    expect(options.map((option) => option.value)).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(options[1].label).toBe('December 2025');
  });
});

describe('guides covering a search', () => {
  it('counts a guide that has the words of the search, even as longer words', () => {
    expect(guideCoversSearch(fabricsGuide, 'best sofa fabric for humid weather')).toBe(true);
  });

  it('does not count a guide that misses a word in a short search', () => {
    expect(guideCoversSearch(fabricsGuide, 'how to clean a velvet sofa')).toBe(false);
    expect(guideCoversSearch(shapesGuide, 'how to clean a velvet sofa')).toBe(false);
  });

  it('has no opinion on a search made only of filler words', () => {
    expect(guideCoversSearch(fabricsGuide, 'how to')).toBe(false);
  });
});

describe('content due next', () => {
  const existing = new Set(['/', '/sofas/', '/guides/']);

  it('lists a guide for every question no guide answers, and the clusters whose page is missing', () => {
    const due = nextContentDue(fixtureMap, existing, [fabricsGuide, shapesGuide], 5);
    expect(due.map((item) => [item.kind, item.title, item.later])).toEqual([
      ['page', 'Cluster velvet', false],
      ['guide', 'How to clean a velvet sofa', false],
      ['page', 'Cluster sinhala', true],
    ]);
    expect(due[0].page).toBe('/sofas/velvet/');
    expect(due[1].page).toBe('/guides/');
  });

  it('gives the next two by default, with the clusters marked later last', () => {
    expect(nextContentDue(fixtureMap, existing, [fabricsGuide]).map((item) => item.title)).toEqual([
      'Cluster velvet',
      'How to clean a velvet sofa',
    ]);
    const withVelvetPage = new Set(['/', '/sofas/', '/sofas/velvet/', '/guides/']);
    expect(nextContentDue(fixtureMap, withVelvetPage, [fabricsGuide])).toMatchObject([
      { title: 'How to clean a velvet sofa' },
      { title: 'Cluster sinhala', later: true },
    ]);
  });

  it('asks for every question when no guide exists yet', () => {
    const due = nextContentDue(fixtureMap, new Set(['/', '/sofas/', '/sofas/velvet/', '/guides/']), [], 10);
    expect(due.map((item) => item.title)).toEqual([
      'Best sofa fabric for humid weather',
      'How to clean a velvet sofa',
      'Cluster sinhala',
    ]);
  });

  it('is empty when every page and guide exists', () => {
    const everything = new Set(['/', '/sofas/', '/sofas/velvet/', '/guides/', '/si/']);
    const guides = [fabricsGuide, { ...shapesGuide, title: 'How to clean a velvet sofa', tags: [] }];
    expect(nextContentDue({ clusters: fixtureMap.clusters.slice(0, 4) }, everything, guides)).toEqual([]);
  });
});

describe('reviews in the report', () => {
  it('counts by decision and averages the approved ones only', () => {
    expect(
      summariseReviews([
        { rating: 5, status: 'approved' },
        { rating: 4, status: 'approved' },
        { rating: 1, status: 'rejected' },
        { rating: 3, status: 'pending' },
      ]),
    ).toEqual({ total: 4, approved: 2, pending: 1, rejected: 1, averageRating: 4.5 });
  });

  it('has no average without an approved review', () => {
    expect(summariseReviews([{ rating: 2, status: 'pending' }]).averageRating).toBeNull();
    expect(summariseReviews([]).total).toBe(0);
  });
});

describe('the monthly report', () => {
  const searches = prioritySearches(fixtureMap, 3);
  const input: ReportInput = {
    month: '2026-10',
    searches,
    rows: [
      row('2026-10-03', 'sofa factory outlet', 4, 40, 2),
      row('2026-10-10', 'sofa factory outlet', 6, 60, 3),
      row('2026-10-12', 'sofa sri lanka', 1, 100, 12),
    ],
    previousRows: [
      row('2026-09-12', 'sofa factory outlet', 2, 50, 6),
      row('2026-09-14', 'sofa shop colombo', 0, 10, 9),
    ],
    totals: { clicks: 120, impressions: 4300, position: 14.2 },
    previousTotals: { clicks: 90, impressions: 3000, position: 16 },
    reviews: [
      { rating: 5, status: 'approved' },
      { rating: 3, status: 'pending' },
    ],
    products: [
      { id: 1, name: 'Zed sofa', score: 'amber', failing: ['Photos'] },
      { id: 2, name: 'Fine sofa', score: 'green', failing: [] },
      { id: 3, name: 'Alpha sofa', score: 'red', failing: ['Photos', 'Price', 'Guide'] },
      { id: 4, name: 'Beta sofa', score: 'amber', failing: ['Guide'] },
    ],
    contentDue: [
      {
        kind: 'guide',
        title: 'How to clean a velvet sofa',
        searches: ['how to clean a velvet sofa'],
        page: '/guides/',
        cluster: 'Questions',
        later: false,
      },
    ],
  };

  it('ranks each priority search and compares it with the month before', () => {
    const report = buildMonthlyReport(input);
    expect(report).toMatchObject({ month: '2026-10', label: 'October 2026', from: '2026-10-01', to: '2026-10-31' });
    expect(report.hasSearchData).toBe(true);
    const [brand, sofa, shop] = report.rankings;
    expect(brand.query).toBe('sofa factory outlet');
    expect(brand.clicks).toBe(10);
    expect(brand.position).toBeCloseTo(2.6, 5);
    expect(brand.previousPosition).toBe(6);
    expect(brand.change).toBe(3.4);
    expect(sofa).toMatchObject({ clicks: 1, impressions: 100, previousPosition: null, change: null });
    expect(shop).toMatchObject({ clicks: 0, impressions: 0, position: null, previousPosition: 9, change: null });
    expect(report.priorityTotals).toMatchObject({ clicks: 11, impressions: 200 });
    expect(report.totals).toEqual(input.totals);
  });

  it('lists the products below green, red first and then by name', () => {
    const report = buildMonthlyReport(input);
    expect(report.productsBelowGreen?.map((product) => product.name)).toEqual(['Alpha sofa', 'Beta sofa', 'Zed sofa']);
  });

  it('says so when the checklist could not be read, and when there is no search data', () => {
    const report = buildMonthlyReport({
      ...input,
      products: null,
      rows: [],
      previousRows: [],
      totals: { clicks: 0, impressions: 0, position: null },
    });
    expect(report.productsBelowGreen).toBeNull();
    expect(report.hasSearchData).toBe(false);
    expect(reportToText(report)).toContain('no data for this month yet');
    expect(reportToText(report)).toContain('the SEO checklist could not be read');
  });

  it('writes plain text with every section', () => {
    const text = reportToText(buildMonthlyReport(input));
    expect(text).toContain('SEO report for October 2026');
    expect(text).toContain('120 clicks, 4,300 impressions, average position 14.2');
    expect(text).toContain('1. sofa factory outlet: position 2.6 (up 3.4), 10 clicks, 100 impressions');
    expect(text).toContain('3. sofa shop Colombo: position — (no earlier figure)');
    expect(text).toContain('New reviews: 2 (1 approved, 1 waiting, 0 rejected).');
    expect(text).toContain('Average rating of the approved ones: 5.0 out of 5.');
    expect(text).toContain('- Alpha sofa (red): Photos, Price, Guide');
    expect(text).toContain('- How to clean a velvet sofa: a guide for how to clean a velvet sofa');
  });

  it('writes the rankings as CSV, one row per priority search', () => {
    const lines = reportToCsv(buildMonthlyReport(input)).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Search,Target page,Clicks,Impressions,Average position,Previous position,Change');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('sofa factory outlet,/,10,100,2.6,6.0,3.4');
    expect(lines[3]).toBe('sofa shop Colombo,/sofas/,0,0,,9.0,');
  });

  it('keeps a search that looks like a spreadsheet formula from running as one', () => {
    const report = buildMonthlyReport({
      ...input,
      searches: [{ query: '=HYPERLINK("http://example.com"),x', cluster: 'Test', page: '/' }],
      rows: [row('2026-10-03', '=hyperlink("http://example.com"),x', 1, 1, 1)],
    });
    const csv = reportToCsv(report);
    expect(csv).toContain('"\'=HYPERLINK(""http://example.com""),x"');
    expect(csv.split('\r\n')[1].startsWith('"\'=')).toBe(true);
  });
});
