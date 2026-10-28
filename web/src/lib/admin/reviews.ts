import 'server-only';

import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { siteUrl } from '@/lib/env';
import { isLkMobile } from '@/lib/phone';
import type { ReviewStatus } from '@/lib/seo/report';
import { createReviewLink, type ReviewTokenOptions } from '@/lib/seo/reviews';
import { whatsappLink } from '@/lib/settings/get';

// Moderation for on-site reviews, and the review links staff send. The reviews
// table has no status column, so `approved_at` doubles as the moment the team
// decided: approved = true is published, approved = false with a decision time
// is rejected, and approved = false without one is still waiting.

export type { ReviewStatus };

export function reviewStatus(row: { approved: boolean; approvedAt: Date | string | null }): ReviewStatus {
  if (row.approved) return 'approved';
  return row.approvedAt ? 'rejected' : 'pending';
}

function statusCondition(status: ReviewStatus | 'all') {
  if (status === 'approved') return eq(s.reviews.approved, true);
  if (status === 'pending') return and(eq(s.reviews.approved, false), isNull(s.reviews.approvedAt));
  if (status === 'rejected') return and(eq(s.reviews.approved, false), isNotNull(s.reviews.approvedAt));
  return undefined;
}

export type ReviewFilter = { status?: ReviewStatus | 'all'; verifiedOnly?: boolean; limit?: number };

export type AdminReview = {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  verifiedVisit: boolean;
  status: ReviewStatus;
  createdAt: string;
  decidedAt: string | null;
  product: { id: number; name: string; slug: string } | null;
  booking: { id: number; reference: string } | null;
  invoice: { id: number; number: string | null } | null;
};

function productOf(id: number | null, name: string | null, slug: string | null): AdminReview['product'] {
  return id !== null && name !== null && slug !== null ? { id, name, slug } : null;
}

function bookingOf(id: number | null, reference: string | null): AdminReview['booking'] {
  return id !== null && reference !== null ? { id, reference } : null;
}

/** The moderation queue, newest first. */
export async function listReviews(filter: ReviewFilter = {}): Promise<AdminReview[]> {
  const db = await getDb();
  const verified = filter.verifiedOnly ? eq(s.reviews.verifiedVisit, true) : undefined;
  const rows = await db
    .select({
      review: s.reviews,
      productName: s.products.name,
      productSlug: s.products.slug,
      bookingReference: s.bookings.reference,
      invoiceNumber: s.invoices.number,
    })
    .from(s.reviews)
    .leftJoin(s.products, eq(s.products.id, s.reviews.productId))
    .leftJoin(s.bookings, eq(s.bookings.id, s.reviews.bookingId))
    .leftJoin(s.invoices, eq(s.invoices.id, s.reviews.invoiceId))
    .where(and(statusCondition(filter.status ?? 'all'), verified))
    .orderBy(desc(s.reviews.createdAt), desc(s.reviews.id))
    .limit(filter.limit ?? 100);
  return rows.map(({ review, productName, productSlug, bookingReference, invoiceNumber }) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    authorName: review.authorName,
    verifiedVisit: review.verifiedVisit,
    status: reviewStatus(review),
    createdAt: review.createdAt.toISOString(),
    decidedAt: review.approvedAt?.toISOString() ?? null,
    product: productOf(review.productId, productName, productSlug),
    booking: bookingOf(review.bookingId, bookingReference),
    invoice: review.invoiceId === null ? null : { id: review.invoiceId, number: invoiceNumber },
  }));
}

export async function reviewCounts(): Promise<Record<ReviewStatus, number>> {
  const db = await getDb();
  const undecided = sql`${s.reviews.approved} = false and ${s.reviews.approvedAt} is null`;
  const turnedDown = sql`${s.reviews.approved} = false and ${s.reviews.approvedAt} is not null`;
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${undecided})::int`,
      approved: sql<number>`count(*) filter (where ${s.reviews.approved})::int`,
      rejected: sql<number>`count(*) filter (where ${turnedDown})::int`,
    })
    .from(s.reviews);
  return { pending: row.pending, approved: row.approved, rejected: row.rejected };
}

async function decide(id: number, approved: boolean): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(s.reviews)
    .set({ approved, approvedAt: new Date() })
    .where(eq(s.reviews.id, id))
    .returning({ id: s.reviews.id });
  return rows.length > 0;
}

/** Publishes a review. Returns false when there is no such review. */
export const approveReview = (id: number): Promise<boolean> => decide(id, true);

/** Takes a review off the site (or keeps it off) and remembers that the team said no. */
export const rejectReview = (id: number): Promise<boolean> => decide(id, false);

export async function deleteReview(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(s.reviews).where(eq(s.reviews.id, id)).returning({ id: s.reviews.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Review links

export type ReviewLinkBooking = {
  id: number;
  reference: string;
  customerName: string;
  visitDate: string;
  items: Array<{ productId: number; name: string }>;
};

/** Bookings the team can ask for a review: visited or purchased, newest visit first, with the products they chose. */
export async function listReviewLinkBookings(limit = 40): Promise<ReviewLinkBooking[]> {
  const db = await getDb();
  const bookings = await db
    .select({
      id: s.bookings.id,
      reference: s.bookings.reference,
      visitDate: s.bookings.visitDate,
      customerName: s.customers.name,
    })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(inArray(s.bookings.status, ['visited', 'purchased']))
    .orderBy(desc(s.bookings.visitDate), desc(s.bookings.id))
    .limit(limit);
  if (bookings.length === 0) return [];
  const bookingIds = bookings.map((booking) => booking.id);
  const items = await db
    .select({
      bookingId: s.bookingItems.bookingId,
      productId: s.bookingItems.productId,
      name: s.bookingItems.productName,
    })
    .from(s.bookingItems)
    .where(and(inArray(s.bookingItems.bookingId, bookingIds), isNotNull(s.bookingItems.productId)));
  return bookings
    .map((booking) => {
      const seen = new Set<number>();
      const own: ReviewLinkBooking['items'] = [];
      for (const item of items) {
        if (item.bookingId !== booking.id || item.productId === null || seen.has(item.productId)) continue;
        seen.add(item.productId);
        own.push({ productId: item.productId, name: item.name });
      }
      return { ...booking, items: own };
    })
    .filter((booking) => booking.items.length > 0);
}

export type PreparedReviewLink =
  | { ok: true; path: string; url: string; whatsappUrl: string | null; productName: string }
  | { ok: false; error: string };

/**
 * A review link for one product of one booking, plus a WhatsApp message to send it with.
 * Checks that the booking exists, that the product is in it, and that no review has been sent yet.
 */
export async function prepareReviewLink(
  input: { productId: number; bookingId?: number },
  options: ReviewTokenOptions = {},
): Promise<PreparedReviewLink> {
  const { productId, bookingId } = input;
  if (bookingId === undefined) return { ok: false, error: 'Choose the booking this review link is for.' };
  const db = await getDb();
  const [booking] = await db
    .select({ customer: s.customers })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(eq(s.bookings.id, bookingId))
    .limit(1);
  if (!booking) return { ok: false, error: 'That booking could not be found.' };
  const [item] = await db
    .select({ name: s.bookingItems.productName })
    .from(s.bookingItems)
    .where(and(eq(s.bookingItems.bookingId, bookingId), eq(s.bookingItems.productId, productId)))
    .limit(1);
  if (!item) return { ok: false, error: 'That product is not part of this booking.' };
  const [existing] = await db
    .select({ id: s.reviews.id })
    .from(s.reviews)
    .where(and(eq(s.reviews.bookingId, bookingId), eq(s.reviews.productId, productId)))
    .limit(1);
  if (existing) return { ok: false, error: 'This customer has already reviewed that product.' };
  let path: string;
  try {
    path = await createReviewLink({ bookingId, productId }, options);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The review link could not be created.' };
  }
  const url = `${siteUrl()}${path}`;
  const { customer } = booking;
  const number = customer.whatsapp ?? (isLkMobile(customer.phone) ? customer.phone : null);
  const firstName = customer.name.trim().split(/\s+/)[0] ?? '';
  const message =
    `Hi ${firstName}, thank you for visiting Sofa Factory Outlet. ` +
    `We would love to hear how you are finding your ${item.name}. You can leave a review here: ${url}`;
  return { ok: true, path, url, whatsappUrl: whatsappLink(number, message), productName: item.name };
}
