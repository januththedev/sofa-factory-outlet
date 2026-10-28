import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approveReview,
  deleteReview,
  listReviewLinkBookings,
  listReviews,
  prepareReviewLink,
  rejectReview,
  reviewCounts,
} from '@/lib/admin/reviews';
import {
  createRedirect,
  deleteRedirect,
  getMonthlyReport,
  getReviewRequestStats,
  getSearchOverview,
  getSeoProblems,
  listRedirects,
  updateRedirect,
  upsertSearchConsoleRows,
} from '@/lib/admin/seo';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { keywordMap, prioritySearches } from '@/lib/seo/report';
import { createReviewLink, getReviewFormContext, submitReview } from '@/lib/seo/reviews';

const secrets = { AUTH_SECRET: 'seo-admin-test-secret' };
const DAY_MS = 86_400_000;
const goodReview = {
  rating: 5,
  title: 'Worth the visit',
  body: 'Very comfortable and the fabric feels like it will last.',
  name: 'Nimali P.',
};

let db: Db;
let products: Array<{ id: number; name: string }>;
let counter = 0;

/** A visited booking with one product in it, so each test has its own review slot. */
async function makeBooking(productId: number, name: string, overrides: { whatsapp?: string | null } = {}) {
  counter += 1;
  const [customer] = await db
    .insert(s.customers)
    .values({
      name: 'Kasun Perera',
      phone: `+9477000${String(counter).padStart(4, '0')}`,
      whatsapp: overrides.whatsapp,
    })
    .returning();
  const [booking] = await db
    .insert(s.bookings)
    .values({
      reference: `SFO-B-9${String(counter).padStart(3, '0')}`,
      customerId: customer.id,
      visitDate: '2026-09-12',
      slotLabel: '10:00 to 11:00',
      status: 'visited',
    })
    .returning();
  await db.insert(s.bookingItems).values({ bookingId: booking.id, productId, productName: name, quantity: 1 });
  return booking;
}

const tokenOf = (path: string) => path.replace('/review/', '').replace(/\/$/, '');

async function sendReview(bookingId: number, productId: number, input: unknown = goodReview) {
  const path = await createReviewLink({ bookingId, productId }, { secrets });
  return submitReview(tokenOf(path), input, { secrets });
}

beforeAll(async () => {
  db = await getDb();
  products = await db
    .select({ id: s.products.id, name: s.products.name })
    .from(s.products)
    .where(eq(s.products.status, 'published'))
    .limit(4);
});

afterAll(async () => {
  await closeDb();
});

describe('on-site review submission', () => {
  it('saves a valid review as unapproved, marks the visit verified and rings the bell', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const result = await sendReview(booking.id, product.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [saved] = await db.select().from(s.reviews).where(eq(s.reviews.id, result.reviewId));
    expect(saved).toMatchObject({
      productId: product.id,
      bookingId: booking.id,
      customerId: booking.customerId,
      rating: 5,
      title: 'Worth the visit',
      authorName: 'Nimali P.',
      verifiedVisit: true,
      approved: false,
      approvedAt: null,
    });
    const notices = await db
      .select()
      .from(s.notifications)
      .where(and(eq(s.notifications.type, 'review'), eq(s.notifications.link, '/admin/seo/?tab=reviews')));
    expect(notices.some((notice) => notice.title.includes(product.name))).toBe(true);
  });

  it('keeps an empty title as null and tidies spaces in the name', async () => {
    const product = products[1];
    const booking = await makeBooking(product.id, product.name);
    const result = await sendReview(booking.id, product.id, { ...goodReview, title: '  ', name: '  Dilani   S.  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [saved] = await db.select().from(s.reviews).where(eq(s.reviews.id, result.reviewId));
    expect(saved.title).toBeNull();
    expect(saved.authorName).toBe('Dilani S.');
  });

  it('accepts only one review per booking and product, however many links are made', async () => {
    const product = products[2];
    const booking = await makeBooking(product.id, product.name);
    const path = await createReviewLink({ bookingId: booking.id, productId: product.id }, { secrets });
    expect((await submitReview(tokenOf(path), goodReview, { secrets })).ok).toBe(true);

    const again = await submitReview(tokenOf(path), goodReview, { secrets });
    expect(again).toMatchObject({ ok: false, code: 'duplicate' });
    const second = await sendReview(booking.id, product.id);
    expect(second).toMatchObject({ ok: false, code: 'duplicate' });

    const rows = await db
      .select({ id: s.reviews.id })
      .from(s.reviews)
      .where(and(eq(s.reviews.bookingId, booking.id), eq(s.reviews.productId, product.id)));
    expect(rows).toHaveLength(1);
  });

  it('stops two reviews sent at the same moment from both being saved', async () => {
    const product = products[3];
    const booking = await makeBooking(product.id, product.name);
    const results = await Promise.all([
      sendReview(booking.id, product.id),
      sendReview(booking.id, product.id),
      sendReview(booking.id, product.id),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const rows = await db.select({ id: s.reviews.id }).from(s.reviews).where(eq(s.reviews.bookingId, booking.id));
    expect(rows).toHaveLength(1);
  });

  it('rejects a short review with a message for the field, and saves nothing', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const result = await sendReview(booking.id, product.id, { ...goodReview, body: 'Nice' });
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
    if (result.ok) return;
    expect(result.fieldErrors?.body).toMatch(/at least 10/);
    const rows = await db.select({ id: s.reviews.id }).from(s.reviews).where(eq(s.reviews.bookingId, booking.id));
    expect(rows).toHaveLength(0);
  });

  it('rejects a missing rating, a rating out of range, a long review and a missing name', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const noRating = await sendReview(booking.id, product.id, { ...goodReview, rating: undefined });
    const tooHigh = await sendReview(booking.id, product.id, { ...goodReview, rating: 6 });
    const tooLong = await sendReview(booking.id, product.id, { ...goodReview, body: 'x'.repeat(2001) });
    const noName = await sendReview(booking.id, product.id, { ...goodReview, name: '' });
    for (const result of [noRating, tooHigh, tooLong, noName]) {
      expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
    }
    expect(noRating.ok ? '' : noRating.fieldErrors?.rating).toBeTruthy();
    expect(tooHigh.ok ? '' : tooHigh.fieldErrors?.rating).toBeTruthy();
    expect(tooLong.ok ? '' : tooLong.fieldErrors?.body).toMatch(/under 2000/);
    expect(noName.ok ? '' : noName.fieldErrors?.name).toBeTruthy();
  });

  it('refuses an expired link, a changed link and a link for a booking that does not exist', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const longAgo = new Date(Date.now() - 61 * DAY_MS);
    const old = await createReviewLink({ bookingId: booking.id, productId: product.id }, { secrets, now: longAgo });
    expect(await submitReview(tokenOf(old), goodReview, { secrets })).toMatchObject({
      ok: false,
      code: 'expired_link',
    });

    const fresh = tokenOf(await createReviewLink({ bookingId: booking.id, productId: product.id }, { secrets }));
    const [head, payload, signature] = fresh.split('.');
    const forged = `${head}.${payload}.${'A'.repeat(signature.length)}`;
    expect(await submitReview(forged, goodReview, { secrets })).toMatchObject({ ok: false, code: 'invalid_link' });
    expect(await submitReview('not-a-token', goodReview, { secrets })).toMatchObject({
      ok: false,
      code: 'invalid_link',
    });

    const ghost = await createReviewLink({ bookingId: 2_000_000, productId: product.id }, { secrets });
    expect(await submitReview(tokenOf(ghost), goodReview, { secrets })).toMatchObject({
      ok: false,
      code: 'invalid_link',
    });
    const rows = await db.select({ id: s.reviews.id }).from(s.reviews).where(eq(s.reviews.bookingId, booking.id));
    expect(rows).toHaveLength(0);
  });

  it('tells the page whether a link can be used, and stops once a review exists', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const token = tokenOf(await createReviewLink({ bookingId: booking.id, productId: product.id }, { secrets }));
    const ready = await getReviewFormContext(token, { secrets });
    expect(ready.status).toBe('ready');
    if (ready.status === 'ready') expect(ready.product).toMatchObject({ id: product.id, name: product.name });
    await submitReview(token, goodReview, { secrets });
    expect((await getReviewFormContext(token, { secrets })).status).toBe('already_reviewed');
    expect((await getReviewFormContext('garbage', { secrets })).status).toBe('invalid');
    const old = await createReviewLink(
      { bookingId: booking.id, productId: product.id },
      { secrets, now: new Date(Date.now() - 70 * DAY_MS) },
    );
    expect((await getReviewFormContext(tokenOf(old), { secrets })).status).toBe('expired');
  });
});

describe('review moderation', () => {
  async function pendingReview(overrides: Partial<typeof s.reviews.$inferInsert> = {}) {
    const [product] = products;
    const [row] = await db
      .insert(s.reviews)
      .values({
        productId: product.id,
        rating: 4,
        body: 'A moderation test review.',
        authorName: 'Moderation Test',
        ...overrides,
      })
      .returning();
    return row;
  }

  const publicIds = async () =>
    (await db.select({ id: s.reviews.id }).from(s.reviews).where(eq(s.reviews.approved, true))).map((row) => row.id);

  it('shows a review on the site only once it is approved, and takes it off again when rejected', async () => {
    const review = await pendingReview();
    expect(await publicIds()).not.toContain(review.id);
    expect((await listReviews({ status: 'pending' })).map((row) => row.id)).toContain(review.id);

    expect(await approveReview(review.id)).toBe(true);
    expect(await publicIds()).toContain(review.id);
    const approved = (await listReviews({ status: 'approved' })).find((row) => row.id === review.id);
    expect(approved?.status).toBe('approved');
    expect((await listReviews({ status: 'pending' })).map((row) => row.id)).not.toContain(review.id);

    expect(await rejectReview(review.id)).toBe(true);
    expect(await publicIds()).not.toContain(review.id);
    const rejected = (await listReviews({ status: 'rejected' })).find((row) => row.id === review.id);
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.decidedAt).not.toBeNull();
  });

  it('counts reviews by decision', async () => {
    const before = await reviewCounts();
    const waiting = await pendingReview();
    const published = await pendingReview();
    const turnedDown = await pendingReview();
    await approveReview(published.id);
    await rejectReview(turnedDown.id);
    const after = await reviewCounts();
    expect(after.pending - before.pending).toBe(1);
    expect(after.approved - before.approved).toBe(1);
    expect(after.rejected - before.rejected).toBe(1);
    expect(waiting.approved).toBe(false);
  });

  it('filters by verified visit', async () => {
    const verified = await pendingReview({ verifiedVisit: true });
    const unverified = await pendingReview({ verifiedVisit: false });
    const onlyVerified = (await listReviews({ status: 'all', verifiedOnly: true })).map((row) => row.id);
    expect(onlyVerified).toContain(verified.id);
    expect(onlyVerified).not.toContain(unverified.id);
    const everything = (await listReviews({ status: 'all' })).map((row) => row.id);
    expect(everything).toEqual(expect.arrayContaining([verified.id, unverified.id]));
  });

  it('lists the product and booking a review belongs to', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const review = await pendingReview({ bookingId: booking.id });
    const listed = (await listReviews({ status: 'all' })).find((row) => row.id === review.id);
    expect(listed?.product).toMatchObject({ id: product.id, name: product.name });
    expect(listed?.booking).toEqual({ id: booking.id, reference: booking.reference });
  });

  it('deletes a review, and says so when there is nothing to change', async () => {
    const review = await pendingReview();
    await approveReview(review.id);
    expect(await deleteReview(review.id)).toBe(true);
    expect(await publicIds()).not.toContain(review.id);
    expect(await deleteReview(review.id)).toBe(false);
    expect(await approveReview(review.id)).toBe(false);
    expect(await rejectReview(review.id)).toBe(false);
  });

  it('works out the rating and review requests from approved reviews only', async () => {
    const [product] = products;
    await db.delete(s.reviews);
    const before = await getReviewRequestStats();
    const five = await pendingReview({ rating: 5 });
    const three = await pendingReview({ rating: 3 });
    await pendingReview({ rating: 1 });
    await approveReview(five.id);
    await approveReview(three.id);
    const after = await getReviewRequestStats();
    expect(after.approvedReviews - before.approvedReviews).toBe(2);
    expect(after.waitingReviews - before.waitingReviews).toBe(1);
    expect(after.averageRating).toBe(4);

    const booking = await makeBooking(product.id, product.name);
    await db.update(s.bookings).set({ reviewRequestedAt: new Date() }).where(eq(s.bookings.id, booking.id));
    const asked = await getReviewRequestStats();
    expect(asked.bookingsAsked - after.bookingsAsked).toBe(1);
    expect(asked.totalAsked - after.totalAsked).toBe(1);
  });
});

describe('review links for staff', () => {
  it('lists visited bookings with their products', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    const listed = (await listReviewLinkBookings()).find((row) => row.id === booking.id);
    expect(listed).toMatchObject({ reference: booking.reference, customerName: 'Kasun Perera' });
    expect(listed?.items).toEqual([{ productId: product.id, name: product.name }]);
  });

  it('leaves out bookings that nobody visited', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name);
    await db.update(s.bookings).set({ status: 'cancelled' }).where(eq(s.bookings.id, booking.id));
    expect((await listReviewLinkBookings(200)).map((row) => row.id)).not.toContain(booking.id);
  });

  it('makes a link with a WhatsApp message to the customer', async () => {
    const [product] = products;
    const booking = await makeBooking(product.id, product.name, { whatsapp: '+94771234567' });
    const result = await prepareReviewLink({ bookingId: booking.id, productId: product.id }, { secrets });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toMatch(/^\/review\/.+\/$/);
    expect(result.url.endsWith(result.path)).toBe(true);
    expect(result.productName).toBe(product.name);
    expect(result.whatsappUrl).toContain('https://wa.me/94771234567');
    expect(decodeURIComponent(result.whatsappUrl ?? '')).toContain(result.url);
    const check = await getReviewFormContext(tokenOf(result.path), { secrets });
    expect(check.status).toBe('ready');
  });

  it('explains what is wrong instead of making a link', async () => {
    const [product, other] = products;
    const booking = await makeBooking(product.id, product.name);
    const noBooking = await prepareReviewLink({ productId: product.id }, { secrets });
    const unknown = await prepareReviewLink({ bookingId: 2_000_000, productId: product.id }, { secrets });
    const wrongProduct = await prepareReviewLink({ bookingId: booking.id, productId: other.id }, { secrets });
    const noSecret = await prepareReviewLink({ bookingId: booking.id, productId: product.id }, { secrets: {} });
    for (const result of [noBooking, unknown, wrongProduct]) expect(result.ok).toBe(false);
    expect(wrongProduct.ok ? '' : wrongProduct.error).toMatch(/not part of this booking/);
    expect(noSecret.ok ? '' : noSecret.error).toMatch(/AUTH_SECRET/);
    await sendReview(booking.id, product.id);
    const already = await prepareReviewLink({ bookingId: booking.id, productId: product.id }, { secrets });
    expect(already.ok ? '' : already.error).toMatch(/already reviewed/);
  });
});

describe('redirects manager', () => {
  it('adds, lists, changes and deletes a manual redirect', async () => {
    const created = await createRedirect({ from: '/crud-old', to: '/shop', status: 301 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const listed = (await listRedirects()).find((row) => row.id === created.id);
    expect(listed).toMatchObject({ from: '/crud-old/', to: '/shop/', status: 301, reason: 'manual', hits: 0 });

    await db.update(s.redirects).set({ hits: 7 }).where(eq(s.redirects.id, created.id));
    const changed = await updateRedirect(created.id, { from: '/crud-old/', to: '/guides/', status: 301 });
    expect(changed.ok).toBe(true);
    const [row] = await db.select().from(s.redirects).where(eq(s.redirects.id, created.id));
    expect(row).toMatchObject({ toPath: '/guides/', hits: 7, reason: 'manual' });

    const gone = await updateRedirect(created.id, { from: '/crud-old/', status: 410 });
    expect(gone.ok).toBe(true);
    const [removed] = await db.select().from(s.redirects).where(eq(s.redirects.id, created.id));
    expect(removed).toMatchObject({ status: 410, toPath: null });

    expect(await deleteRedirect(created.id)).toBe(true);
    expect(await deleteRedirect(created.id)).toBe(false);
    expect((await listRedirects()).map((item) => item.id)).not.toContain(created.id);
  });

  it('refuses a duplicate source, a chain and a loop', async () => {
    const first = await createRedirect({ from: '/chain-a/', to: '/shop/', status: 301 });
    expect(first.ok).toBe(true);
    const duplicate = await createRedirect({ from: '/chain-a', to: '/guides/', status: 301 });
    expect(duplicate).toMatchObject({ ok: false });
    const chain = await createRedirect({ from: '/chain-b/', to: '/chain-a/', status: 301 });
    expect(chain.ok ? '' : chain.errors.to).toMatch(/itself redirected/);
    const loop = await createRedirect({ from: '/shop/', to: '/chain-a/', status: 301 });
    expect(loop.ok).toBe(false);
    const rows = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, '/chain-b/'));
    expect(rows).toHaveLength(0);
    if (first.ok) await deleteRedirect(first.id);
  });

  it('refuses a bad source or an unknown redirect without touching the table', async () => {
    const before = (await listRedirects()).length;
    const noSlash = await createRedirect({ from: 'old-page', to: '/shop/', status: 301 });
    expect(noSlash.ok ? '' : noSlash.errors.from).toMatch(/starts with/);
    const missing = await updateRedirect(2_000_000, { from: '/never-saved/', to: '/shop/', status: 301 });
    expect(missing.ok ? '' : missing.errors.form).toMatch(/no longer exists/);
    expect((await listRedirects()).length).toBe(before);
  });

  it('lets two writes for the same address race without saving both', async () => {
    const results = await Promise.all([
      createRedirect({ from: '/race-old/', to: '/shop/', status: 301 }),
      createRedirect({ from: '/race-old/', to: '/guides/', status: 301 }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const rows = await db.select().from(s.redirects).where(eq(s.redirects.fromPath, '/race-old/'));
    expect(rows).toHaveLength(1);
    await deleteRedirect(rows[0].id);
  });

  it('shows hidden products that are still being visited', async () => {
    const [row] = await db
      .insert(s.redirects)
      .values({ fromPath: '/product/hidden-but-popular/', toPath: '/shop/', reason: 'hidden-product', hits: 12 })
      .returning();
    const problems = await getSeoProblems();
    const found = problems.hiddenWithRedirects.find((item) => item.id === row.id);
    expect(found).toMatchObject({ from: '/product/hidden-but-popular/', hits: 12 });
  });
});

describe('Search Console data', () => {
  const [priority] = prioritySearches(keywordMap());
  const row = (overrides: Partial<Parameters<typeof upsertSearchConsoleRows>[0][number]> = {}) => ({
    date: '2026-10-20',
    query: priority.query.toUpperCase(),
    page: 'https://example.test/sofas/',
    clicks: 3,
    impressions: 30,
    ctr: 0.1,
    position: 4,
    ...overrides,
  });
  const countRows = async () => {
    const [result] = await db.select({ n: sql<number>`count(*)::int` }).from(s.searchConsoleDaily);
    return result.n;
  };

  it('stores each day, search and page once however often the pull runs', async () => {
    const before = await countRows();
    expect(await upsertSearchConsoleRows([row(), row({ date: '2026-10-21' })])).toBe(2);
    expect(await countRows()).toBe(before + 2);
    await upsertSearchConsoleRows([row(), row({ date: '2026-10-21' })]);
    expect(await countRows()).toBe(before + 2);
  });

  it('updates a day that Google revised, in place', async () => {
    await upsertSearchConsoleRows([row({ date: '2026-10-22', clicks: 1, impressions: 10, position: 9 })]);
    const before = await countRows();
    await upsertSearchConsoleRows([row({ date: '2026-10-22', clicks: 5, impressions: 50, position: 6 })]);
    expect(await countRows()).toBe(before);
    const [saved] = await db
      .select()
      .from(s.searchConsoleDaily)
      .where(and(eq(s.searchConsoleDaily.date, '2026-10-22'), eq(s.searchConsoleDaily.query, row().query)));
    expect(saved).toMatchObject({ clicks: 5, impressions: 50, position: 6 });
  });

  it('does nothing for an empty pull', async () => {
    const before = await countRows();
    expect(await upsertSearchConsoleRows([])).toBe(0);
    expect(await countRows()).toBe(before);
  });

  it('adds up the priority searches for the overview, ignoring case', async () => {
    await db.delete(s.searchConsoleDaily);
    await upsertSearchConsoleRows([
      row({ clicks: 2, impressions: 20, position: 3 }),
      row({ query: priority.query, page: 'https://example.test/other/', clicks: 1, impressions: 20, position: 5 }),
      row({ query: 'a search nobody planned for', clicks: 9, impressions: 90, position: 2 }),
      row({ date: '2026-08-01', clicks: 40, impressions: 400, position: 1 }),
    ]);
    const overview = await getSearchOverview({ today: '2026-10-28' });
    expect(overview.hasData).toBe(true);
    expect(overview.totals).toMatchObject({ clicks: 3, impressions: 40 });
    expect(overview.totals.position).toBeCloseTo(4, 5);
    expect(overview.priority).toHaveLength(20);
    expect(overview.priority[0]).toMatchObject({ query: priority.query, clicks: 3, impressions: 40 });
    expect(overview.trend).toHaveLength(20);
    expect(overview.trend.at(-1)).toEqual({ date: '2026-10-20', clicks: 3, impressions: 40 });
    expect(overview.trend[0]).toEqual({ date: '2026-10-01', clicks: 0, impressions: 0 });
    const clicks = overview.topPages.map((page) => page.clicks);
    expect(overview.topPages[0].page).toBe('https://example.test/sofas/');
    expect(clicks).toEqual([...clicks].sort((a, b) => b - a));
  });

  it('says there is no data before the first pull', async () => {
    await db.delete(s.searchConsoleDaily);
    const overview = await getSearchOverview({ today: '2026-10-28' });
    expect(overview.hasData).toBe(false);
    expect(overview.trend).toEqual([]);
    expect(overview.totals).toEqual({ clicks: 0, impressions: 0, position: null });
  });

  it('builds the monthly report from the stored rows', async () => {
    await db.delete(s.searchConsoleDaily);
    await upsertSearchConsoleRows([
      row({ date: '2026-09-10', clicks: 4, impressions: 40, position: 6 }),
      row({ date: '2026-08-10', clicks: 1, impressions: 20, position: 9 }),
    ]);
    const report = await getMonthlyReport('2026-09', { today: '2026-10-28' });
    expect(report).toMatchObject({ month: '2026-09', from: '2026-09-01', to: '2026-09-30', hasSearchData: true });
    expect(report.totals).toMatchObject({ clicks: 4, impressions: 40 });
    expect(report.previousTotals).toMatchObject({ clicks: 1, impressions: 20 });
    expect(report.rankings[0]).toMatchObject({ query: priority.query, previousPosition: 9, change: 3 });
    expect(report.contentDue.length).toBeLessThanOrEqual(2);
    const fallback = await getMonthlyReport('not-a-month', { today: '2026-10-28' });
    expect(fallback.month).toBe('2026-09');
  });
});
