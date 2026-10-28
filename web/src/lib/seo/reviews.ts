import 'server-only';

import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { REVIEW_LIMITS } from '@/components/reviews/limits';
import { type DbOrTx, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { env } from '@/lib/env';
import { type PictureData, pictureData } from '@/lib/images/urls';
import { createNotification } from '@/lib/notify/bell';

// On-site reviews. Staff create a signed review link for a booking (or an
// invoice) and send it over WhatsApp. The link opens /review/<token>/, where the
// visitor rates the product they bought. A review starts unapproved and is
// published only after the team approves it (src/lib/admin/reviews.ts).

export const REVIEW_LINK_DAYS = 60;
export const REVIEW_NOTIFICATION_LINK = '/admin/seo/?tab=reviews';

const TOKEN_AUDIENCE = 'sofa-factory-outlet:review';
const MAX_TOKEN_LENGTH = 2000;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Tokens

export type SecretSource = { AUTH_SECRET?: string; CRON_SECRET?: string };
/** `secrets` and `now` exist so tests can sign and expire links without touching the environment. */
export type ReviewTokenOptions = { secrets?: SecretSource; now?: Date };
export type ReviewLinkInput = { bookingId?: number; invoiceId?: number; productId: number };
export type ReviewClaims = { productId: number; bookingId?: number; invoiceId?: number };

/** The signing secret: AUTH_SECRET, or CRON_SECRET when that is not set. */
export function reviewSecret(source: SecretSource = env): Uint8Array {
  const secret = source.AUTH_SECRET?.trim() || source.CRON_SECRET?.trim();
  if (!secret) throw new Error('Review links need AUTH_SECRET or CRON_SECRET to be set.');
  return new TextEncoder().encode(secret);
}

const idSchema = z.number().int().positive().max(2_147_483_647);

const claimsSchema = z
  .object({ productId: idSchema, bookingId: idSchema.optional(), invoiceId: idSchema.optional() })
  .refine((claims) => claims.bookingId !== undefined || claims.invoiceId !== undefined, {
    message: 'A review link needs a booking or an invoice.',
  });

/** `/review/<token>/`: a link valid for 60 days that carries the booking or invoice and the product. */
export async function createReviewLink(input: ReviewLinkInput, options: ReviewTokenOptions = {}): Promise<string> {
  const parsed = claimsSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Those review link details are not valid.');
  const secret = reviewSecret(options.secrets);
  const issuedAt = options.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + REVIEW_LINK_DAYS * DAY_MS);
  const token = await new SignJWT({ ...parsed.data })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret);
  return `/review/${token}/`;
}

export type TokenCheck = { ok: true; claims: ReviewClaims } | { ok: false; reason: 'expired' | 'invalid' };

export async function verifyReviewToken(token: string, options: ReviewTokenOptions = {}): Promise<TokenCheck> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'invalid' };
  try {
    const { payload } = await jwtVerify(token, reviewSecret(options.secrets), {
      algorithms: ['HS256'],
      audience: TOKEN_AUDIENCE,
      requiredClaims: ['exp'],
      currentDate: options.now,
    });
    const claims = claimsSchema.safeParse(payload);
    return claims.success ? { ok: true, claims: claims.data } : { ok: false, reason: 'invalid' };
  } catch (error) {
    return { ok: false, reason: error instanceof errors.JWTExpired ? 'expired' : 'invalid' };
  }
}

// ---------------------------------------------------------------------------
// Looking up what a link is for

/** A review already exists for this booking/invoice and product. */
async function findExistingReview(db: DbOrTx, claims: ReviewClaims): Promise<number | null> {
  const owners: SQL[] = [];
  if (claims.bookingId !== undefined) owners.push(eq(s.reviews.bookingId, claims.bookingId));
  if (claims.invoiceId !== undefined) owners.push(eq(s.reviews.invoiceId, claims.invoiceId));
  const [row] = await db
    .select({ id: s.reviews.id })
    .from(s.reviews)
    .where(and(eq(s.reviews.productId, claims.productId), or(...owners)))
    .limit(1);
  return row?.id ?? null;
}

/** The customer who bought: from the booking, or from the invoice when there is no booking. */
async function buyerOf(db: DbOrTx, claims: ReviewClaims): Promise<number | null> {
  if (claims.bookingId !== undefined) {
    const [booking] = await db
      .select({ customerId: s.bookings.customerId })
      .from(s.bookings)
      .where(eq(s.bookings.id, claims.bookingId))
      .limit(1);
    if (booking) return booking.customerId;
  }
  if (claims.invoiceId !== undefined) {
    const [invoice] = await db
      .select({ customerId: s.invoices.customerId })
      .from(s.invoices)
      .where(eq(s.invoices.id, claims.invoiceId))
      .limit(1);
    if (invoice) return invoice.customerId;
  }
  return null;
}

export type ReviewFormContext =
  | { status: 'ready'; product: { id: number; name: string; slug: string; image: PictureData | null } }
  | { status: 'expired' | 'invalid' | 'already_reviewed' | 'product_gone' };

/** Everything the public review page needs, or the reason it cannot show the form. */
export async function getReviewFormContext(
  token: string,
  options: ReviewTokenOptions = {},
): Promise<ReviewFormContext> {
  const check = await verifyReviewToken(token, options);
  if (!check.ok) return { status: check.reason };
  const db = await getDb();
  const [product] = await db
    .select({ id: s.products.id, name: s.products.name, slug: s.products.slug })
    .from(s.products)
    .where(eq(s.products.id, check.claims.productId))
    .limit(1);
  if (!product) return { status: 'product_gone' };
  if (await findExistingReview(db, check.claims)) return { status: 'already_reviewed' };
  const variants = await db
    .select({ images: s.productVariants.images })
    .from(s.productVariants)
    .where(eq(s.productVariants.productId, product.id))
    .orderBy(desc(s.productVariants.isDefault), asc(s.productVariants.sortOrder), asc(s.productVariants.id));
  const image = variants.flatMap((variant) => variant.images)[0];
  return { status: 'ready', product: { ...product, image: image ? pictureData(image) : null } };
}

// ---------------------------------------------------------------------------
// Sending a review

const blankIfMissing = (value: unknown): unknown => (value === null || value === undefined ? '' : value);

const STAR_MESSAGE = 'Choose a star rating from 1 to 5.';

const reviewInputSchema = z.object({
  rating: z.coerce
    .number({ error: STAR_MESSAGE })
    .int(STAR_MESSAGE)
    .min(1, STAR_MESSAGE)
    .max(5, STAR_MESSAGE),
  title: z.preprocess(
    blankIfMissing,
    z.string().trim().max(REVIEW_LIMITS.titleMax, `Keep the title under ${REVIEW_LIMITS.titleMax} characters.`),
  ),
  body: z.preprocess(
    blankIfMissing,
    z
      .string()
      .trim()
      .min(REVIEW_LIMITS.bodyMin, `Please write at least ${REVIEW_LIMITS.bodyMin} characters.`)
      .max(REVIEW_LIMITS.bodyMax, `Please keep your review under ${REVIEW_LIMITS.bodyMax} characters.`),
  ),
  name: z.preprocess(
    blankIfMissing,
    z
      .string()
      .trim()
      .min(REVIEW_LIMITS.nameMin, 'Please tell us the name to show with your review.')
      .max(REVIEW_LIMITS.nameMax, `Keep the name under ${REVIEW_LIMITS.nameMax} characters.`),
  ),
});

export type ReviewField = 'rating' | 'title' | 'body' | 'name';

export type SubmitReviewResult =
  | { ok: true; reviewId: number }
  | {
      ok: false;
      code: 'expired_link' | 'invalid_link' | 'duplicate' | 'invalid_input' | 'unknown';
      message: string;
      fieldErrors?: Partial<Record<ReviewField, string>>;
    };

const LINK_EXPIRED = {
  ok: false,
  code: 'expired_link',
  message: 'This review link has expired. Please ask the showroom team for a new one.',
} as const;

const LINK_INVALID = {
  ok: false,
  code: 'invalid_link',
  message: 'This review link is not valid. Please ask the showroom team for a new one.',
} as const;

const REVIEW_EXISTS = {
  ok: false,
  code: 'duplicate',
  message: 'A review has already been sent for this purchase. Thank you.',
} as const;

const fieldOf = (key: PropertyKey | undefined): ReviewField | null =>
  key === 'rating' || key === 'title' || key === 'body' || key === 'name' ? key : null;

/**
 * Saves a visitor's review: unapproved, marked as a verified visit, and announced on the admin bell.
 * One review per booking/invoice and product; the lock keeps a double click from saving two.
 */
export async function submitReview(
  token: string,
  input: unknown,
  options: ReviewTokenOptions = {},
): Promise<SubmitReviewResult> {
  const check = await verifyReviewToken(token, options);
  if (!check.ok) return check.reason === 'expired' ? LINK_EXPIRED : LINK_INVALID;
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ReviewField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path[0]);
      if (field) fieldErrors[field] ??= issue.message;
    }
    return { ok: false, code: 'invalid_input', message: 'Please check the highlighted fields.', fieldErrors };
  }
  const { claims } = check;
  const review = parsed.data;
  try {
    const db = await getDb();
    return await db.transaction(async (tx): Promise<SubmitReviewResult> => {
      const lockKey = `review:${claims.bookingId ?? ''}:${claims.invoiceId ?? ''}:${claims.productId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const [product] = await tx
        .select({ id: s.products.id, name: s.products.name })
        .from(s.products)
        .where(eq(s.products.id, claims.productId))
        .limit(1);
      const customerId = await buyerOf(tx, claims);
      if (!product || customerId === null) return LINK_INVALID;
      if (await findExistingReview(tx, claims)) return REVIEW_EXISTS;
      const [saved] = await tx
        .insert(s.reviews)
        .values({
          productId: product.id,
          customerId,
          bookingId: claims.bookingId ?? null,
          invoiceId: claims.invoiceId ?? null,
          rating: review.rating,
          title: review.title || null,
          body: review.body,
          authorName: review.name.replace(/\s+/g, ' '),
          verifiedVisit: true,
          approved: false,
        })
        .returning({ id: s.reviews.id });
      await createNotification(
        {
          type: 'review',
          title: `New review for ${product.name}`,
          body: `${review.rating} out of 5 from ${review.name}. It is waiting for approval.`,
          link: REVIEW_NOTIFICATION_LINK,
        },
        tx,
      );
      return { ok: true, reviewId: saved.id };
    });
  } catch (error) {
    console.error('[reviews] could not save a review:', error);
    return { ok: false, code: 'unknown', message: 'We could not save your review. Please try again in a moment.' };
  }
}
