import { z } from 'zod';
import type { DayAvailability } from '@/lib/bookings/api';
import { normaliseLkPhone } from '@/lib/phone';

// The Book a Visit form's contract, shared by the browser (React Hook Form
// resolver) and the `submitBooking` server action, so both enforce the same
// rules. Nothing here may import server-only code.

export const CONTACT_METHODS = ['whatsapp', 'call', 'email'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export const CONTACT_LABELS: Record<ContactMethod, string> = { whatsapp: 'WhatsApp', call: 'Phone call', email: 'Email' };

export const MAX_ITEMS = 20;
export const TURNSTILE_FIELD = 'cf-turnstile-response';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const emailSchema = z.email();

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 and friends). */
export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const ENTER_NAME = 'Please enter your full name.';
const CHOOSE_DATE = 'Please choose a date for your visit.';
const CHOOSE_TIME = 'Please choose a time for your visit.';
const AGREE = 'Please tick the box to agree before booking.';

const detailFields = {
  name: z.string(ENTER_NAME).trim().min(2, ENTER_NAME).max(80, 'Please keep your name under 80 characters.'),
  phone: z
    .string('Please enter your phone number.')
    .trim()
    .min(1, 'Please enter your phone number.')
    .refine((value) => normaliseLkPhone(value) !== null, 'Please enter a valid Sri Lankan phone number, for example 077 123 4567.'),
  whatsappSame: z.boolean(),
  email: z
    .string()
    .trim()
    .max(200, 'That email address is too long.')
    .refine((value) => value === '' || emailSchema.safeParse(value).success, 'Please enter a valid email address, or leave it blank.'),
  city: z.string().trim().max(100, 'Please keep this under 100 characters.'),
  date: z.string(CHOOSE_DATE).regex(DATE_PATTERN, CHOOSE_DATE).refine(isRealDate, 'Please choose a valid date.'),
  slotId: z.number(CHOOSE_TIME).int(CHOOSE_TIME).positive(CHOOSE_TIME),
  notes: z.string().trim().max(2000, 'Please keep your notes under 2,000 characters.'),
  preferredContact: z.enum(CONTACT_METHODS, 'Please choose how we should contact you.'),
  consent: z.boolean(AGREE).refine((value) => value, AGREE),
};

const emailIsNeeded = (value: { preferredContact: ContactMethod; email: string }) => value.preferredContact !== 'email' || value.email !== '';
const emailIsNeededIssue = { error: 'Please add your email address so we can reach you that way.', path: ['email'] };

/** What the visitor types and picks: validated in the browser before anything is sent. */
export const bookingDetailsSchema = z.object(detailFields).refine(emailIsNeeded, emailIsNeededIssue);

const PIECES_UNREADABLE = 'Your pieces could not be read. Please refresh the page and try again.';
const QUANTITY_RANGE = `Each piece needs a quantity between 1 and ${MAX_ITEMS}.`;

export const bookingItemSchema = z.object(
  {
    productId: z.number(PIECES_UNREADABLE).int(PIECES_UNREADABLE).positive(PIECES_UNREADABLE),
    variantId: z.number(PIECES_UNREADABLE).int(PIECES_UNREADABLE).positive(PIECES_UNREADABLE).optional(),
    quantity: z.number(PIECES_UNREADABLE).int(QUANTITY_RANGE).min(1, QUANTITY_RANGE).max(MAX_ITEMS, QUANTITY_RANGE),
  },
  PIECES_UNREADABLE,
);

/** The same details plus the cart lines (which come from the browser cart, not from a field): validated again on the server. */
export const bookingSubmissionSchema = z
  .object({ ...detailFields, items: z.array(bookingItemSchema, PIECES_UNREADABLE).max(MAX_ITEMS, `You can book up to ${MAX_ITEMS} different pieces at once.`) })
  .refine(emailIsNeeded, emailIsNeededIssue);

export type BookingDetails = z.infer<typeof bookingDetailsSchema>;
export type BookingSubmission = z.infer<typeof bookingSubmissionSchema>;
export type BookingItemInput = z.infer<typeof bookingItemSchema>;

/** Fields in page order: the first one with an error gets the focus. */
export const DETAIL_FIELDS = ['name', 'phone', 'email', 'city', 'date', 'slotId', 'notes', 'preferredContact', 'consent'] as const satisfies ReadonlyArray<keyof BookingDetails>;
export type DetailField = (typeof DETAIL_FIELDS)[number];

/** First message per top-level field of a failed parse; problems with no field are filed under "form". */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = typeof issue.path[0] === 'string' ? issue.path[0] : 'form';
    result[key] ??= issue.message;
  }
  return result;
}

/** What the server action sends back when a booking does not go through (success redirects instead). */
export type BookingFormState = null | {
  code: 'invalid' | 'verification' | 'rate_limited' | 'slot_full' | 'slot_closed' | 'unknown';
  /** Always a sentence written for the visitor, never raw error text. */
  error: string;
  fieldErrors?: Record<string, string>;
  /** Fresh availability, so the pickers stop offering a slot that has just gone. */
  availability?: DayAvailability[];
};

/** Context sent along with a booking so the admin can see where it came from. Advisory only. */
export type BookingMeta = { visitorId?: string; sourcePage?: string; referrer?: string; utm?: Record<string, string> };

const metaSchema = z.object({
  visitorId: z.string().trim().min(1).max(200).optional(),
  sourcePage: z.string().trim().min(1).max(500).optional(),
  referrer: z.string().trim().min(1).max(1000).optional(),
  utm: z
    .record(z.string().max(100), z.string().max(300))
    .refine((record) => Object.keys(record).length <= 10)
    .optional(),
});

export function toBookingFormData(details: BookingDetails, extras: { items: BookingItemInput[]; turnstileToken?: string; meta?: BookingMeta }): FormData {
  const formData = new FormData();
  formData.set('name', details.name);
  formData.set('phone', details.phone);
  formData.set('whatsappSame', String(details.whatsappSame));
  formData.set('email', details.email);
  formData.set('city', details.city);
  formData.set('date', details.date);
  formData.set('slotId', String(details.slotId));
  formData.set('notes', details.notes);
  formData.set('preferredContact', details.preferredContact);
  formData.set('consent', String(details.consent));
  formData.set('items', JSON.stringify(extras.items));
  formData.set(TURNSTILE_FIELD, extras.turnstileToken ?? '');
  const { visitorId, sourcePage, referrer, utm } = extras.meta ?? {};
  if (visitorId) formData.set('visitorId', visitorId);
  if (sourcePage) formData.set('sourcePage', sourcePage);
  if (referrer) formData.set('referrer', referrer);
  if (utm && Object.keys(utm).length) formData.set('utm', JSON.stringify(utm));
  return formData;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Reads a submitted form back into a plain object for `bookingSubmissionSchema` (nothing is trusted yet). */
export function readBookingFormData(formData: FormData): { raw: Record<string, unknown>; turnstileToken: string; meta: BookingMeta } {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const optional = (key: string) => text(key) || undefined;
  const slot = text('slotId');
  const meta = metaSchema.safeParse({ visitorId: optional('visitorId'), sourcePage: optional('sourcePage'), referrer: optional('referrer'), utm: parseJson(text('utm')) });
  return {
    raw: {
      name: text('name'),
      phone: text('phone'),
      whatsappSame: text('whatsappSame') === 'true',
      email: text('email'),
      city: text('city'),
      date: text('date'),
      slotId: slot === '' ? undefined : Number(slot),
      notes: text('notes'),
      preferredContact: text('preferredContact'),
      consent: text('consent') === 'true',
      items: parseJson(text('items')),
    },
    turnstileToken: text(TURNSTILE_FIELD),
    // Meta never blocks a booking: anything malformed is simply dropped.
    meta: meta.success ? meta.data : {},
  };
}
