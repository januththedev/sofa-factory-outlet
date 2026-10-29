'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { bookingCookie } from '@/lib/security/access';
import { after } from 'next/server';
import {
  bookingSubmissionSchema,
  type BookingFormState,
  type BookingSubmission,
  fieldErrorsFromZod,
  readBookingFormData,
} from '@/components/booking/schema';
import {
  type BookingResult,
  createBooking,
  type DayAvailability,
  getAvailability,
  getBookingByReference,
} from '@/lib/bookings/api';
import { hasEmail } from '@/lib/env';
import { sendOwnerBookingEmail } from '@/lib/notify/email';
import { normaliseLkPhone } from '@/lib/phone';
import { isRateLimited, phoneKey, visitorKey } from '@/lib/rate-limit';

type FailureCode = NonNullable<BookingFormState>['code'];

const HOUR_MS = 60 * 60 * 1000;
/** At most this many bookings per phone number and per browser in any hour. */
const BOOKINGS_PER_HOUR = 5;

const MESSAGES = {
  invalid: 'Please check the highlighted details and try again.',
  rateLimited:
    'We have received several booking requests from this phone number or device in the last hour. Please try again later, or message us on WhatsApp.',
  slotFull: 'Sorry, that time has just been taken. Please choose another time.',
  slotClosed:
    'That time is no longer available. Please choose another day or time.',
  unknown:
    'We could not save your booking just now. Please try again, or message us on WhatsApp.',
} as const;

// What the visitor sees when the booking core rejects a field. The core's own wording is never shown.
const FIELD_FALLBACKS: Record<string, string> = {
  name: 'Please check your name.',
  phone: 'Please check your phone number.',
  email: 'Please check your email address.',
  city: 'Please check this field.',
  date: 'Please choose another date.',
  slotId: 'Please choose another time.',
  notes: 'Please shorten your notes.',
  preferredContact: 'Please choose how we should contact you.',
  consent: 'Please tick the box to agree before booking.',
  items:
    'Your pieces could not be read. Please refresh the page and try again.',
};

async function freshAvailability(): Promise<DayAvailability[] | undefined> {
  try {
    return await getAvailability();
  } catch (error) {
    console.error('[book-visit] could not refresh availability:', error);
    return undefined;
  }
}

async function failure(
  code: FailureCode,
  error: string,
  options: { fieldErrors?: Record<string, string>; refresh?: boolean } = {},
): Promise<BookingFormState> {
  return {
    code,
    error,
    fieldErrors: options.fieldErrors,
    availability: options.refresh ? await freshAvailability() : undefined,
  };
}

/** The fields the visitor can fix, each with our own wording (the booking core's text is never shown). */
function friendlyFieldErrors(
  fieldErrors: Record<string, string> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(fieldErrors ?? {})) {
    const field = key.split('.')[0];
    if (field in FIELD_FALLBACKS) result[field] = FIELD_FALLBACKS[field];
  }
  return result;
}

/** Pieces are not a field on the form, so a problem with them is told in the notice instead. */
function invalid(
  fieldErrors: Record<string, string>,
): Promise<BookingFormState> {
  const onlyPieces = Object.keys(fieldErrors).every((key) => key === 'items');
  return failure(
    'invalid',
    onlyPieces && fieldErrors.items ? fieldErrors.items : MESSAGES.invalid,
    { fieldErrors },
  );
}

function fromBookingResult(
  result: Extract<BookingResult, { ok: false }>,
): Promise<BookingFormState> {
  switch (result.code) {
    case 'slot_full':
      return failure('slot_full', MESSAGES.slotFull, { refresh: true });
    case 'slot_closed':
      return failure('slot_closed', MESSAGES.slotClosed, { refresh: true });
    case 'rate_limited':
      return failure('rate_limited', MESSAGES.rateLimited);
    case 'invalid':
      return invalid(friendlyFieldErrors(result.fieldErrors));
    default:
      return failure('unknown', MESSAGES.unknown, { refresh: true });
  }
}

async function tooManyRecent(
  phone: string,
  visitorId: string | undefined,
): Promise<boolean> {
  try {
    const keys = [
      phoneKey(phone),
      ...(visitorId ? [visitorKey(visitorId)] : []),
    ];
    const limited = await Promise.all(
      keys.map((key) =>
        isRateLimited({ key, limit: BOOKINGS_PER_HOUR, windowMs: HOUR_MS }),
      ),
    );
    return limited.some(Boolean);
  } catch (error) {
    // Best effort: if this check cannot run, createBooking still reports a database problem properly.
    console.error('[book-visit] rate-limit check failed:', error);
    return false;
  }
}

function alertOwner(
  booking: { reference: string; bookingId: number },
  details: BookingSubmission,
  phone: string,
) {
  if (!hasEmail()) return;
  after(async () => {
    try {
      // Names and colours come from the saved booking, not from what the browser sent.
      const saved = await getBookingByReference(booking.reference);
      await sendOwnerBookingEmail({
        reference: booking.reference,
        bookingId: booking.bookingId,
        customerName: details.name,
        phone,
        email: details.email || null,
        city: details.city || null,
        preferredContact: details.preferredContact,
        notes: details.notes || null,
        visitDate: details.date,
        slotLabel: saved?.slotLabel ?? '',
        items: saved?.items ?? [],
      });
    } catch (error) {
      console.error('[book-visit] could not prepare the owner email:', error);
    }
  });
}

/**
 * Book a Visit submit. Validates, applies the rate limit and
 * saves the booking through the booking core. Success redirects to the
 * confirmation page; every expected failure comes back as a state object the
 * form shows (never raw error text).
 */
export async function submitBooking(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const { raw, meta } = readBookingFormData(formData);
  const parsed = bookingSubmissionSchema.safeParse(raw);
  if (!parsed.success) return invalid(fieldErrorsFromZod(parsed.error));
  const details = parsed.data;
  const phone = normaliseLkPhone(details.phone);
  if (!phone) return invalid({ phone: FIELD_FALLBACKS.phone });

  if (!formData.has('requestToken') && await tooManyRecent(phone, meta.visitorId))
    return failure('rate_limited', MESSAGES.rateLimited);

  const result = await createBooking({
    requestToken:
      typeof formData.get('requestToken') === 'string'
        ? String(formData.get('requestToken'))
        : undefined,
    name: details.name,
    phone,
    whatsappSame: details.whatsappSame,
    email: details.email || undefined,
    city: details.city || undefined,
    date: details.date,
    slotId: details.slotId,
    notes: details.notes || undefined,
    preferredContact: details.preferredContact,
    consent: true,
    items: details.items,
    meta,
  });
  if (!result.ok) return fromBookingResult(result);

  (await cookies()).set(bookingCookie(result.reference), result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') === true,
    path: '/',
    maxAge: 60 * 86400,
  });
  alertOwner(result, details, phone);
  redirect(`/book-visit/done/${encodeURIComponent(result.reference)}/`);
}
