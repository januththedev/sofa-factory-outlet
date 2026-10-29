import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSetupChecklist, openSetupItems } from '@/lib/admin/setup-checklist';
import {
  addDays,
  BOOKING_STATUSES,
  conversionRate,
  getBookingStats,
  getDashboardStats,
  getOpenGapCount,
  getTopChatQuestions,
  getTopProducts,
  getUnreadNotificationCount,
  getUpcomingVisits,
  getVisitorStats,
  loadSetupInput,
} from '@/lib/admin/stats';
import { colomboDayStart } from '@/lib/analytics/rollup';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { BookingStatus, ImageRef } from '@/lib/db/schema/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

// "Now" is 13:30 on Monday 4 May 2026 in Colombo (08:00 UTC). A Colombo day is UTC+05:30,
// so that day runs from 2026-05-03T18:30:00Z up to, not including, 2026-05-04T18:30:00Z.
const NOW = new Date('2026-05-04T08:00:00.000Z');
const TODAY = '2026-05-04';
const DAY_START = new Date('2026-05-03T18:30:00.000Z');
const JUST_BEFORE_DAY_START = new Date('2026-05-03T18:29:59.999Z');
const DAY_END = new Date('2026-05-04T18:30:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

let db: Db;
let counter = 0;

async function clean() {
  await db.delete(s.bookings);
  await db.delete(s.customers);
  await db.delete(s.events);
  await db.delete(s.dailyStats);
  await db.delete(s.chatMessages);
  await db.delete(s.chatConversations);
  await db.delete(s.knowledgeGaps);
  await db.delete(s.notifications);
  await db.delete(s.reviews);
}

const event = (visitorId: string, createdAt: Date, type = 'page_view', productId: number | null = null) =>
  ({ visitorId, sessionId: `session-${visitorId}`, type, productId, createdAt });

async function booking(options: {
  name?: string;
  visitDate: string;
  status?: BookingStatus;
  createdAt?: Date;
  slotLabel?: string;
}): Promise<number> {
  counter += 1;
  const [customer] = await db
    .insert(s.customers)
    .values({ name: options.name ?? `Customer ${counter}`, phone: `+9477000${String(counter).padStart(4, '0')}` })
    .returning({ id: s.customers.id });
  const [row] = await db
    .insert(s.bookings)
    .values({
      reference: `SFO-B-T${counter}`,
      customerId: customer.id,
      visitDate: options.visitDate,
      slotLabel: options.slotLabel ?? '10:00–12:00',
      status: options.status ?? 'new',
      createdAt: options.createdAt ?? hoursAgo(2),
    })
    .returning({ id: s.bookings.id });
  return row.id;
}

async function conversation(): Promise<number> {
  const [row] = await db
    .insert(s.chatConversations)
    .values({ visitorId: 'chat-visitor', sessionId: 'chat-session' })
    .returning({ id: s.chatConversations.id });
  return row.id;
}

beforeAll(async () => {
  db = await getDb();
});

beforeEach(async () => {
  await clean();
});

afterAll(async () => {
  await clean();
  await closeDb();
});

describe('addDays', () => {
  it('moves a calendar date across month and year ends', () => {
    expect(addDays('2026-05-04', 6)).toBe('2026-05-10');
    expect(addDays('2026-05-04', -6)).toBe('2026-04-28');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('getVisitorStats', () => {
  it('has no data, and zeros, before anything is recorded', async () => {
    const stats = await getVisitorStats(db, NOW);
    expect(stats.hasData).toBe(false);
    expect(stats.today).toBe(0);
    expect(stats.last7).toBe(0);
    expect(stats.series.map((day) => day.date)).toEqual([
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      TODAY,
    ]);
  });

  it('counts distinct visitors today from raw events', async () => {
    await db.insert(s.events).values([
      event('visitor-aaaa', hoursAgo(1)),
      event('visitor-aaaa', hoursAgo(2), 'product_view'),
      event('visitor-bbbb', hoursAgo(3)),
    ]);
    const stats = await getVisitorStats(db, NOW);
    expect(stats.hasData).toBe(true);
    expect(stats.today).toBe(2);
    expect(stats.last7).toBe(2);
  });

  it('puts the Colombo midnight boundary in the right day', async () => {
    await db.insert(s.events).values([
      event('visitor-late', JUST_BEFORE_DAY_START),
      event('visitor-early', DAY_START),
      event('visitor-next', DAY_END),
    ]);
    const stats = await getVisitorStats(db, NOW);
    const byDate = Object.fromEntries(stats.series.map((day) => [day.date, day.visitors]));
    expect(byDate['2026-05-03']).toBe(1);
    expect(byDate[TODAY]).toBe(1);
    expect(stats.last7).toBe(2);
  });

  it('uses the nightly roll-up for finished days and ignores their raw events', async () => {
    await db.insert(s.dailyStats).values({ date: '2026-05-02', metric: 'visitors', dimension: '', value: 10 });
    await db.insert(s.events).values([
      event('visitor-one', new Date('2026-05-02T06:00:00Z')),
      event('visitor-two', new Date('2026-05-02T07:00:00Z')),
    ]);
    const stats = await getVisitorStats(db, NOW);
    expect(stats.series.find((day) => day.date === '2026-05-02')?.visitors).toBe(10);
    expect(stats.last7).toBe(10);
  });

  it('counts a finished day from raw events when the roll-up has not reached it', async () => {
    await db.insert(s.events).values([
      event('visitor-one', new Date('2026-05-03T06:00:00Z')),
      event('visitor-two', new Date('2026-05-03T07:00:00Z')),
    ]);
    const stats = await getVisitorStats(db, NOW);
    expect(stats.series.find((day) => day.date === '2026-05-03')?.visitors).toBe(2);
  });

  it('always counts today live, even when a roll-up row exists for it', async () => {
    await db.insert(s.dailyStats).values({ date: TODAY, metric: 'visitors', dimension: '', value: 99 });
    await db.insert(s.events).values(event('visitor-live', hoursAgo(1)));
    const stats = await getVisitorStats(db, NOW);
    expect(stats.today).toBe(1);
  });

  it('only reads the visitors total, not other metrics or dimensions', async () => {
    await db.insert(s.dailyStats).values([
      { date: '2026-05-02', metric: 'page_views', dimension: '', value: 500 },
      { date: '2026-05-02', metric: 'visitors', dimension: 'mobile', value: 400 },
      { date: '2026-05-02', metric: 'visitors', dimension: '', value: 7 },
    ]);
    const stats = await getVisitorStats(db, NOW);
    expect(stats.last7).toBe(7);
  });

  it('has data when only a roll-up row exists, and ignores days outside the week', async () => {
    await db.insert(s.dailyStats).values([
      { date: '2026-05-01', metric: 'visitors', dimension: '', value: 3 },
      { date: '2026-04-27', metric: 'visitors', dimension: '', value: 50 },
    ]);
    const stats = await getVisitorStats(db, NOW);
    expect(stats.hasData).toBe(true);
    expect(stats.last7).toBe(3);
    expect(stats.today).toBe(0);
  });
});

describe('getBookingStats', () => {
  it('is all zeros when there are no bookings', async () => {
    const stats = await getBookingStats(db, NOW);
    expect(stats).toEqual({
      newToday: 0,
      next7Days: 0,
      made7Days: 0,
      total: 0,
      byStatus: { new: 0, contacted: 0, visited: 0, purchased: 0, lost: 0, cancelled: 0 },
    });
  });

  it('counts new today, the next seven days, the last seven days and each status', async () => {
    const twoDaysAgo = new Date('2026-05-02T06:00:00.000Z');
    await booking({ visitDate: '2026-05-05', status: 'new', createdAt: hoursAgo(1) });
    await booking({ visitDate: TODAY, status: 'contacted', createdAt: DAY_START });
    await booking({ visitDate: '2026-05-10', status: 'new', createdAt: JUST_BEFORE_DAY_START });
    await booking({ visitDate: '2026-05-11', status: 'new', createdAt: JUST_BEFORE_DAY_START });
    await booking({ visitDate: '2026-05-03', status: 'new', createdAt: twoDaysAgo });
    await booking({ visitDate: '2026-05-06', status: 'visited', createdAt: twoDaysAgo });
    await booking({ visitDate: '2026-05-06', status: 'cancelled', createdAt: hoursAgo(1) });
    await booking({ visitDate: '2026-05-06', status: 'purchased', createdAt: new Date('2026-04-27T18:29:59.999Z') });
    await booking({ visitDate: '2026-05-06', status: 'lost', createdAt: new Date('2026-04-27T18:30:00.000Z') });

    const stats = await getBookingStats(db, NOW);
    // Made at 12:30 today and at 00:00 Colombo time today. One millisecond earlier is yesterday,
    // and the booking cancelled today does not count as new.
    expect(stats.newToday).toBe(2);
    // Today to six days ahead, new or contacted: 05-05, 05-04 and 05-10; 05-11 is a day too far.
    expect(stats.next7Days).toBe(3);
    // Everything made since 28 April 00:00 Colombo, minus the cancelled one.
    expect(stats.made7Days).toBe(7);
    expect(stats.byStatus).toEqual({ new: 4, contacted: 1, visited: 1, purchased: 1, lost: 1, cancelled: 1 });
    expect(stats.total).toBe(9);
  });

  it('lists every status even when none of them has a booking', async () => {
    const stats = await getBookingStats(db, NOW);
    expect(Object.keys(stats.byStatus).sort()).toEqual([...BOOKING_STATUSES].sort());
  });
});

describe('conversionRate', () => {
  it('is null while there are no visitors, so the page can say so', () => {
    expect(conversionRate(0, 0).ratePct).toBeNull();
    expect(conversionRate(3, 0).ratePct).toBeNull();
  });

  it('divides bookings by visitors as a percentage', () => {
    expect(conversionRate(3, 120)).toEqual({ bookings: 3, visitors: 120, ratePct: 2.5 });
    expect(conversionRate(0, 50).ratePct).toBe(0);
  });
});

describe('getUpcomingVisits', () => {
  it('is empty with no bookings', async () => {
    expect(await getUpcomingVisits(db, NOW)).toEqual([]);
  });

  it('lists new and contacted visits from today on, by date then slot', async () => {
    await booking({ name: 'Past', visitDate: '2026-05-03' });
    await booking({ name: 'Later', visitDate: '2026-05-09', slotLabel: '14:00–16:00' });
    await booking({ name: 'Tomorrow late', visitDate: '2026-05-05', slotLabel: '14:00–16:00', status: 'contacted' });
    await booking({ name: 'Tomorrow early', visitDate: '2026-05-05', slotLabel: '08:00–10:00' });
    await booking({ name: 'Today', visitDate: TODAY });
    await booking({ name: 'Done', visitDate: '2026-05-05', status: 'visited' });
    await booking({ name: 'Cancelled', visitDate: '2026-05-05', status: 'cancelled' });
    await booking({ name: 'Lost', visitDate: '2026-05-05', status: 'lost' });

    const visits = await getUpcomingVisits(db, NOW);
    expect(visits.map((visit) => visit.customerName)).toEqual([
      'Today',
      'Tomorrow early',
      'Tomorrow late',
      'Later',
    ]);
    expect(visits[0]).toMatchObject({ visitDate: TODAY, slotLabel: '10:00–12:00', status: 'new' });
    expect(visits[0].reference).toMatch(/^SFO-B-/);
  });

  it('stops at the limit', async () => {
    for (let day = 5; day < 12; day += 1) {
      await booking({ visitDate: `2026-05-${String(day).padStart(2, '0')}` });
    }
    expect(await getUpcomingVisits(db, NOW)).toHaveLength(5);
    expect(await getUpcomingVisits(db, NOW, 2)).toHaveLength(2);
  });
});

describe('getTopProducts', () => {
  let ids: number[];
  let names: Map<number, string>;

  beforeAll(async () => {
    const rows = await db.select({ id: s.products.id, name: s.products.name }).from(s.products).limit(8);
    ids = rows.map((row) => row.id);
    names = new Map(rows.map((row) => [row.id, row.name]));
  });

  const views = (productId: number, count: number, at: Date = hoursAgo(1)) =>
    Array.from({ length: count }, (_, i) => event(`visitor-${productId}-${i}`, at, 'product_view', productId));

  it('is empty without product views', async () => {
    expect(await getTopProducts(db, NOW)).toEqual([]);
  });

  it('ranks the week’s most viewed products and stops at five', async () => {
    await db.insert(s.events).values([
      ...views(ids[0], 5),
      ...views(ids[1], 4),
      ...views(ids[2], 3),
      ...views(ids[3], 2),
      ...views(ids[4], 1),
      ...views(ids[5], 1, hoursAgo(30)),
      ...views(ids[6], 1, hoursAgo(40)),
    ]);
    const top = await getTopProducts(db, NOW);
    expect(top).toHaveLength(5);
    expect(top.slice(0, 4).map((row) => [row.productId, row.views])).toEqual([
      [ids[0], 5],
      [ids[1], 4],
      [ids[2], 3],
      [ids[3], 2],
    ]);
    // Three products are tied on one view: the five-product cut keeps the first by name.
    const tied = [ids[4], ids[5], ids[6]].sort((a, b) => (names.get(a) ?? '').localeCompare(names.get(b) ?? ''));
    expect(top[4].views).toBe(1);
    expect(tied).toContain(top[4].productId);
    expect(top[0]).toMatchObject({ name: names.get(ids[0]) });
  });

  it('counts only product views from the last seven Colombo days', async () => {
    const windowStart = colomboDayStart('2026-04-28');
    await db.insert(s.events).values([
      ...views(ids[0], 1, windowStart),
      ...views(ids[1], 2, new Date(windowStart.getTime() - 1)),
      ...views(ids[2], 3, DAY_END),
      event('visitor-cart', hoursAgo(1), 'add_to_cart', ids[3]),
      event('visitor-page', hoursAgo(1), 'page_view', ids[3]),
    ]);
    const top = await getTopProducts(db, NOW);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ productId: ids[0], views: 1 });
  });

  it('skips views of products that no longer exist', async () => {
    await db.insert(s.events).values([...views(2_000_000, 4), ...views(ids[0], 1)]);
    const top = await getTopProducts(db, NOW);
    expect(top.map((row) => row.productId)).toEqual([ids[0]]);
  });

  it('honours a smaller limit', async () => {
    await db.insert(s.events).values([...views(ids[0], 3), ...views(ids[1], 2)]);
    expect(await getTopProducts(db, NOW, 1)).toHaveLength(1);
  });
});

describe('getTopChatQuestions', () => {
  const say = async (conversationId: number, text: string, createdAt: Date, role: 'user' | 'assistant' = 'user') => {
    await db.insert(s.chatMessages).values({ conversationId, role, text, createdAt });
  };

  it('is empty without chat messages', async () => {
    expect(await getTopChatQuestions(db, NOW)).toEqual([]);
  });

  it('groups the same question ignoring case, spaces and trailing punctuation', async () => {
    const id = await conversation();
    await say(id, 'Do you deliver to Kandy?', hoursAgo(1));
    await say(id, '  do you deliver to kandy  ', hoursAgo(2));
    await say(id, 'DO YOU DELIVER TO KANDY??', hoursAgo(3));
    await say(id, 'What is the warranty?', hoursAgo(4));
    await say(id, 'What is the warranty?', hoursAgo(5));
    await say(id, 'Hi', hoursAgo(6));

    const top = await getTopChatQuestions(db, NOW);
    expect(top.map((row) => row.count)).toEqual([3, 2, 1]);
    expect(top[0].question.toLowerCase().replace(/[?\s]+$/, '')).toBe('do you deliver to kandy');
    expect(top[1].question).toBe('What is the warranty?');
  });

  it('counts what visitors ask, not what the bot answers', async () => {
    const id = await conversation();
    await say(id, 'Is the sofa washable?', hoursAgo(1));
    for (let i = 0; i < 5; i += 1) await say(id, 'Here is the answer', hoursAgo(1), 'assistant');
    expect(await getTopChatQuestions(db, NOW)).toEqual([{ question: 'Is the sofa washable?', count: 1 }]);
  });

  it('looks back thirty Colombo days and no further', async () => {
    const id = await conversation();
    const windowStart = colomboDayStart('2026-04-05');
    await say(id, 'inside the window', windowStart);
    await say(id, 'just outside the window', new Date(windowStart.getTime() - 1));
    await say(id, 'long ago', hoursAgo(24 * 60));
    expect((await getTopChatQuestions(db, NOW)).map((row) => row.question)).toEqual(['inside the window']);
  });

  it('skips messages that are only punctuation or spaces', async () => {
    const id = await conversation();
    await say(id, '???', hoursAgo(1));
    await say(id, '   ', hoursAgo(1));
    expect(await getTopChatQuestions(db, NOW)).toEqual([]);
  });

  it('shortens very long questions and honours the limit', async () => {
    const id = await conversation();
    await say(id, 'x'.repeat(400), hoursAgo(1));
    for (let i = 0; i < 6; i += 1) await say(id, `question number ${i}`, hoursAgo(2));
    const top = await getTopChatQuestions(db, NOW);
    expect(top).toHaveLength(5);
    const longest = await getTopChatQuestions(db, NOW, 20);
    expect(Math.max(...longest.map((row) => row.question.length))).toBeLessThanOrEqual(140);
  });
});

describe('counts', () => {
  it('counts only open knowledge gaps', async () => {
    expect(await getOpenGapCount(db)).toBe(0);
    await db.insert(s.knowledgeGaps).values([
      { question: 'a?', normalised: 'a', status: 'open' },
      { question: 'b?', normalised: 'b', status: 'open' },
      { question: 'c?', normalised: 'c', status: 'answered' },
      { question: 'd?', normalised: 'd', status: 'dismissed' },
    ]);
    expect(await getOpenGapCount(db)).toBe(2);
  });

  it('counts only unread notifications', async () => {
    expect(await getUnreadNotificationCount(db)).toBe(0);
    await db.insert(s.notifications).values([
      { type: 'booking', title: 'one' },
      { type: 'system', title: 'two' },
      { type: 'review', title: 'three', readAt: new Date() },
    ]);
    expect(await getUnreadNotificationCount(db)).toBe(2);
  });
});

describe('getDashboardStats', () => {
  it('works on an empty database, with nothing that looks like data', async () => {
    const stats = await getDashboardStats(NOW, db);
    expect(stats.today).toBe(TODAY);
    expect(stats.visitors.hasData).toBe(false);
    expect(stats.conversion.ratePct).toBeNull();
    expect(stats.bookings.total).toBe(0);
    expect(stats.topProducts).toEqual([]);
    expect(stats.topQuestions).toEqual([]);
    expect(stats.upcoming).toEqual([]);
    expect(stats.openGaps).toBe(0);
    expect(stats.unreadNotifications).toBe(0);
  });

  it('puts the pieces together, conversion included', async () => {
    await db.insert(s.events).values(['a', 'b', 'c', 'd'].map((id) => event(`visitor-${id}`, hoursAgo(1))));
    await booking({ visitDate: '2026-05-06', createdAt: hoursAgo(1) });
    const stats = await getDashboardStats(NOW, db);
    expect(stats.visitors.today).toBe(4);
    expect(stats.bookings.newToday).toBe(1);
    expect(stats.conversion).toEqual({ bookings: 1, visitors: 4, ratePct: 25 });
    expect(stats.upcoming).toHaveLength(1);
  });
});

describe('loadSetupInput', () => {
  const isFlagged = (image: ImageRef) => image.flag === 'borrowed' || image.flag === 'licence';
  const flagged = (images: ImageRef[]) => images.filter(isFlagged).length;
  const image = (flag: ImageRef['flag']): ImageRef => {
    counter += 1;
    return { key: `k-${counter}`, w: 10, h: 10, widths: [10], alt: 'x', flag };
  };

  it('reads the settings straight from the database, defaults filled in', async () => {
    const input = await loadSetupInput(db);
    expect(input.settings).toEqual(expect.objectContaining({ business: DEFAULT_SETTINGS.business }));
    expect(input.services).toEqual({ openRouter: expect.any(Boolean) });
  });

  it('counts published products with no price', async () => {
    const products = await db.select().from(s.products);
    const expected = products.filter((p) => p.status === 'published' && p.priceMinor === null).length;
    expect((await loadSetupInput(db)).counts.publishedWithoutPrice).toBe(expected);

    const priced = products.find((p) => p.status === 'published' && p.priceMinor === null);
    expect(priced).toBeDefined();
    if (!priced) return;
    await db.update(s.products).set({ priceMinor: 250_000_00 }).where(eq(s.products.id, priced.id));
    expect((await loadSetupInput(db)).counts.publishedWithoutPrice).toBe(expected - 1);
    await db.update(s.products).set({ priceMinor: null }).where(eq(s.products.id, priced.id));
  });

  it('counts only published products with review notes', async () => {
    const products = await db.select().from(s.products);
    const expected = products.filter((p) => p.status === 'published' && p.reviewNotes.length > 0).length;
    expect((await loadSetupInput(db)).counts.productsNeedingReview).toBe(expected);

    const target = products.find((p) => p.status === 'published' && p.reviewNotes.length > 0);
    expect(target).toBeDefined();
    if (!target) return;
    await db.update(s.products).set({ reviewNotes: [] }).where(eq(s.products.id, target.id));
    expect((await loadSetupInput(db)).counts.productsNeedingReview).toBe(expected - 1);
    await db.update(s.products).set({ reviewNotes: target.reviewNotes }).where(eq(s.products.id, target.id));
  });

  it('counts photos flagged borrowed or licence, and nothing else', async () => {
    const variants = await db.select().from(s.productVariants);
    const baseline = variants.reduce((sum, variant) => sum + flagged(variant.images), 0);
    expect((await loadSetupInput(db)).counts.flaggedPhotos).toBe(baseline);

    const target = variants[0];
    const replacement = [image('borrowed'), image('licence'), image(null), image(undefined)];
    await db.update(s.productVariants).set({ images: replacement }).where(eq(s.productVariants.id, target.id));
    const expected = baseline - flagged(target.images) + 2;
    expect((await loadSetupInput(db)).counts.flaggedPhotos).toBe(expected);
    await db.update(s.productVariants).set({ images: target.images }).where(eq(s.productVariants.id, target.id));
  });

  it('counts approved reviews only', async () => {
    expect((await loadSetupInput(db)).counts.approvedReviews).toBe(0);
    await db.insert(s.reviews).values([
      { rating: 5, body: 'Lovely sofa', authorName: 'A', approved: false },
      { rating: 4, body: 'Good value', authorName: 'B', approved: true },
    ]);
    expect((await loadSetupInput(db)).counts.approvedReviews).toBe(1);
  });

  it('feeds the checklist: confirming a setting clears its item', async () => {
    const before = openSetupItems(buildSetupChecklist(await loadSetupInput(db))).map((item) => item.id);
    expect(before).toContain('hours');
    await db
      .update(s.settings)
      .set({ value: { ...DEFAULT_SETTINGS.hours, confirmed: true } })
      .where(eq(s.settings.key, 'hours'));
    const after = openSetupItems(buildSetupChecklist(await loadSetupInput(db))).map((item) => item.id);
    expect(after).not.toContain('hours');
    await db.update(s.settings).set({ value: DEFAULT_SETTINGS.hours }).where(eq(s.settings.key, 'hours'));
  });

  // Last: it reloads the modules, which the tests above must not be using at the same time.
  it('reports whether a key is set without ever carrying its value', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-very-secret-value');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.resetModules();
    try {
      const fresh = await import('@/lib/admin/stats');
      const services = fresh.getServiceStatus();
      expect(services.find((service) => service.id === 'openrouter')?.configured).toBe(true);
      expect(services.find((service) => service.id === 'resend')?.configured).toBe(false);
      expect(JSON.stringify(services)).not.toContain('sk-or-very-secret-value');
      const input = await fresh.loadSetupInput(db);
      expect(JSON.stringify(input)).not.toContain('sk-or-very-secret-value');
      expect(input.services).toEqual({ openRouter: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
