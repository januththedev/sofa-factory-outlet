import { z } from 'zod';
import {
  isClockTime,
  parseClosedDates,
  parseModelList,
  parsePercentToBp,
  type SlotInput,
  validateSlots,
} from '@/lib/admin/settings';
import { normaliseLkPhone } from '@/lib/phone';
import { DAY_KEYS } from '@/lib/settings/hours';
import type {
  BookingSettings,
  BusinessSettings,
  ChatSettings,
  DayKey,
  DeliverySettings,
  HoursSettings,
  InvoiceSettings,
  OpeningHours,
  ProofSettings,
  SeoSettings,
} from '@/lib/settings/types';

// Form input to settings values. Form fields are named after the settings they
// fill ("address.street", "hours.days.mon.open"), so unflatten() gives zod an
// object shaped like the saved value and an error path is the field's own name.

export type SettingsFormState = {
  ok: boolean;
  message: string;
  /** Field name (as in the form) to message. */
  errors: Record<string, string>;
  /** Epoch milliseconds of the save, so repeat saves read differently to a screen reader. */
  at: number;
} | null;

export type StaffFormState = {
  ok: boolean;
  message: string;
  errors: Record<string, string>;
  /** Which row operation this answers. */
  intent?: 'create' | 'role' | 'active' | 'reset';
  /** Shown once, in the response to the request that set it. It is never stored in readable form. */
  tempPassword?: string;
  at: number;
} | null;

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

/** `{ 'a.b': 'x' }` entries to `{ a: { b: 'x' } }`. Files and unsafe names are ignored. */
export function unflatten(entries: Iterable<[string, unknown]>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [name, value] of entries) {
    if (typeof value !== 'string') continue;
    const path = name.split('.');
    if (path.some((part) => part === '' || FORBIDDEN_SEGMENTS.has(part))) continue;
    let node = root;
    for (const part of path.slice(0, -1)) {
      const next = Object.hasOwn(node, part) ? node[part] : undefined;
      if (typeof next === 'object' && next !== null) {
        node = next as Record<string, unknown>;
      } else {
        const created: Record<string, unknown> = {};
        node[part] = created;
        node = created;
      }
    }
    node[path[path.length - 1]] = value;
  }
  return root;
}

export const formInput = (formData: FormData): Record<string, unknown> => unflatten(formData.entries());

/** First message per field, keyed by the field's form name. Problems with no field go under "form". */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'form';
    out[key] ??= issue.message;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Field building blocks

const required = { error: 'Enter a value' };
// An unticked checkbox is not sent at all, so a missing field means false.
const flag = z
  .unknown()
  .optional()
  .transform((value) => value === 'on' || value === 'true' || value === true);

const text = (max: number) => z.string(required).trim().max(max, `Keep this under ${max} characters`);
const requiredText = (max: number) => text(max).min(1, 'Enter a value');
const optionalText = (max: number) => text(max).transform((value) => (value === '' ? null : value));

const lkPhone = z
  .string(required)
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const normalised = normaliseLkPhone(value);
    if (normalised) return normalised;
    ctx.addIssue({ code: 'custom', message: 'Enter a Sri Lankan number such as 077 123 4567' });
    return z.NEVER;
  });

const emailOrNull = z
  .string(required)
  .trim()
  .max(254, 'Keep this under 254 characters')
  .transform((value, ctx) => {
    if (value === '') return null;
    if (z.email().safeParse(value).success) return value.toLowerCase();
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email address' });
    return z.NEVER;
  });

const httpsOrNull = z
  .string(required)
  .trim()
  .max(300, 'Keep this under 300 characters')
  .transform((value, ctx) => {
    if (value === '') return null;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password) return value;
    } catch {
      // Falls through to the message below.
    }
    ctx.addIssue({ code: 'custom', message: 'Use a full link that starts with https://' });
    return z.NEVER;
  });

const wholeNumber = (min: number, max: number) =>
  z
    .string(required)
    .trim()
    .min(1, 'Enter a number')
    .transform(Number)
    .pipe(
      z
        .number({ error: 'Enter a number' })
        .int('Use a whole number')
        .min(min, `Use ${min} or more`)
        .max(max, `Use ${max} or fewer`),
    );

const optionalWholeNumber = (min: number, max: number) =>
  z
    .string(required)
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null;
      const number = Number(value);
      if (Number.isInteger(number) && number >= min && number <= max) return number;
      ctx.addIssue({ code: 'custom', message: `Use a whole number from ${min} to ${max}, or leave it empty` });
      return z.NEVER;
    });

const decimal = (min: number, max: number) =>
  z
    .string(required)
    .trim()
    .min(1, 'Enter a number')
    .transform(Number)
    .pipe(z.number({ error: 'Enter a number' }).min(min, `Use ${min} or more`).max(max, `Use ${max} or less`));

// ---------------------------------------------------------------------------
// Business

export const businessSchema = z
  .object({
    name: requiredText(120),
    tagline: text(200),
    address: z.object({
      street: requiredText(160),
      locality: requiredText(120),
      city: requiredText(120),
      postalCode: optionalText(16),
      confirmed: flag,
    }),
    phone: z.object({ number: lkPhone, confirmed: flag }),
    whatsapp: z.object({ number: lkPhone, confirmed: flag }),
    email: z.object({ address: emailOrNull, confirmed: flag }),
    social: z.object({ facebook: httpsOrNull, instagram: httpsOrNull, tiktok: httpsOrNull, youtube: httpsOrNull }),
    map: z.object({ placeUrl: httpsOrNull, googleReviewUrl: httpsOrNull, confirmed: flag }),
    priceRange: requiredText(40),
  })
  .superRefine((form, ctx) => {
    const needs = (path: string[], present: boolean, confirmed: boolean, what: string) => {
      if (confirmed && !present) ctx.addIssue({ code: 'custom', path, message: `Add ${what} before confirming it` });
    };
    needs(['phone', 'confirmed'], form.phone.number !== null, form.phone.confirmed, 'the number');
    needs(['whatsapp', 'confirmed'], form.whatsapp.number !== null, form.whatsapp.confirmed, 'the number');
    needs(['email', 'confirmed'], form.email.address !== null, form.email.confirmed, 'the address');
    needs(['map', 'confirmed'], form.map.placeUrl !== null, form.map.confirmed, 'the map link');
  });

export type BusinessForm = z.output<typeof businessSchema>;

export function applyBusiness(current: BusinessSettings, form: BusinessForm): BusinessSettings {
  return {
    ...current,
    name: form.name,
    tagline: form.tagline,
    address: { ...current.address, ...form.address },
    phone: form.phone,
    whatsapp: form.whatsapp,
    email: form.email,
    social: form.social,
    map: { ...current.map, ...form.map },
    priceRange: form.priceRange,
  };
}

// ---------------------------------------------------------------------------
// Hours and visits

const dayForm = z
  .object({ closed: flag, open: z.string().trim().default(''), close: z.string().trim().default('') })
  .superRefine((day, ctx) => {
    if (day.closed) return;
    const openOk = isClockTime(day.open);
    const closeOk = isClockTime(day.close);
    if (!openOk) ctx.addIssue({ code: 'custom', path: ['open'], message: 'Use a time like 10:00' });
    if (!closeOk) ctx.addIssue({ code: 'custom', path: ['close'], message: 'Use a time like 18:00' });
    if (openOk && closeOk && day.close <= day.open) {
      ctx.addIssue({ code: 'custom', path: ['close'], message: 'Closing time must be after opening time' });
    }
  })
  .transform((day): OpeningHours => (day.closed ? null : { open: day.open, close: day.close }));

const daysShape = Object.fromEntries(DAY_KEYS.map((key) => [key, dayForm])) as Record<DayKey, typeof dayForm>;

const slotRows = z
  .array(
    z.object({
      id: z.number().int().positive().optional(),
      weekday: z.number(),
      start: z.string(),
      end: z.string(),
      capacity: z.number(),
      active: z.boolean(),
    }),
  )
  .max(120, 'That is too many slots');

const slotsJson = z.string().transform((value, ctx): SlotInput[] => {
  try {
    const parsed = slotRows.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
    ctx.addIssue({ code: 'custom', message: 'The slot table could not be read. Reload the page and try again.' });
  } catch {
    ctx.addIssue({ code: 'custom', message: 'The slot table could not be read. Reload the page and try again.' });
  }
  return z.NEVER;
});

export const hoursSchema = z
  .object({
    hours: z.object({
      days: z.object(daysShape),
      closedDates: z
        .string()
        .default('')
        .transform((value, ctx) => {
          const { dates, invalid } = parseClosedDates(value);
          if (invalid.length === 0) return dates;
          ctx.addIssue({ code: 'custom', message: `Not a date (use YYYY-MM-DD): ${invalid.slice(0, 3).join(', ')}` });
          return z.NEVER;
        }),
      note: optionalText(300),
      confirmed: flag,
    }),
    booking: z.object({
      leadDays: wholeNumber(0, 60),
      horizonDays: wholeNumber(1, 365),
      confirmed: flag,
    }),
    slots: slotsJson,
  })
  .superRefine((form, ctx) => {
    if (!Array.isArray(form.slots)) return;
    if (form.booking.horizonDays <= form.booking.leadDays) {
      ctx.addIssue({
        code: 'custom',
        path: ['booking', 'horizonDays'],
        message: 'Must be longer than the notice days',
      });
    }
    for (const problem of validateSlots(form.slots)) {
      ctx.addIssue({ code: 'custom', path: ['slots', problem.index], message: problem.message });
    }
  });

export type HoursForm = z.output<typeof hoursSchema>;

export const applyHours = (current: HoursSettings, form: HoursForm): HoursSettings => ({
  ...current,
  days: form.hours.days,
  closedDates: form.hours.closedDates,
  note: form.hours.note,
  confirmed: form.hours.confirmed,
});

export const applyBooking = (current: BookingSettings, form: HoursForm): BookingSettings => ({
  ...current,
  leadDays: form.booking.leadDays,
  horizonDays: form.booking.horizonDays,
  confirmed: form.booking.confirmed,
});

// ---------------------------------------------------------------------------
// Invoices

const prefix = z
  .string(required)
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{0,11}$/, 'Use up to 12 letters, digits or hyphens');

export const invoiceSchema = z
  .object({
    prefix,
    quotationPrefix: prefix,
    taxEnabled: flag,
    taxLabel: requiredText(20),
    taxRatePercent: z
      .string(required)
      .trim()
      .transform((value, ctx) => {
        const bp = parsePercentToBp(value);
        if (bp !== null) return bp;
        ctx.addIssue({ code: 'custom', message: 'Use a percentage from 0 to 100 with up to two decimals' });
        return z.NEVER;
      }),
    vatNumber: optionalText(40),
    bank: z.object({
      bank: optionalText(80),
      branch: optionalText(80),
      accountName: optionalText(120),
      accountNumber: optionalText(40),
    }),
    terms: requiredText(2000),
    warranty: requiredText(1000),
    confirmed: flag,
  })
  .superRefine((form, ctx) => {
    if (form.prefix === form.quotationPrefix) {
      ctx.addIssue({ code: 'custom', path: ['quotationPrefix'], message: 'Use a different prefix from invoices' });
    }
  });

export type InvoiceForm = z.output<typeof invoiceSchema>;

export const applyInvoice = (current: InvoiceSettings, form: InvoiceForm): InvoiceSettings => ({
  ...current,
  prefix: form.prefix,
  quotationPrefix: form.quotationPrefix,
  taxEnabled: form.taxEnabled,
  taxLabel: form.taxLabel,
  taxRateBp: form.taxRatePercent,
  vatNumber: form.vatNumber,
  bank: form.bank,
  terms: form.terms,
  warranty: form.warranty,
  confirmed: form.confirmed,
});

// ---------------------------------------------------------------------------
// Delivery and proof

export const deliverySchema = z.object({
  delivery: z.object({
    colomboDays: requiredText(120),
    islandwideDays: requiredText(120),
    colomboCharge: requiredText(200),
    islandwideCharge: requiredText(200),
    warranty: requiredText(300),
    confirmed: flag,
  }),
});

export const applyDelivery = (form: z.output<typeof deliverySchema>): DeliverySettings => form.delivery;

export const proofSchema = z
  .object({
    proof: z.object({
      years: optionalWholeNumber(0, 200),
      homes: optionalWholeNumber(0, 1_000_000),
      districts: optionalWholeNumber(0, 25),
      confirmed: flag,
    }),
  })
  .superRefine((form, ctx) => {
    const { years, homes, districts, confirmed } = form.proof;
    if (confirmed && years === null && homes === null && districts === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['proof', 'confirmed'],
        message: 'Add at least one number before confirming',
      });
    }
  });

export const applyProof = (form: z.output<typeof proofSchema>): ProofSettings => form.proof;

// ---------------------------------------------------------------------------
// Chat and SEO

export const chatSeoSchema = z.object({
  chat: z.object({
    dailyModelBudget: wholeNumber(0, 10_000),
    bufferCalls: wholeNumber(0, 1_000),
    perSessionModelAnswers: wholeNumber(0, 50),
    messagesPer10Min: wholeNumber(1, 500),
    models: z
      .string()
      .default('')
      .transform((value, ctx) => {
        const { models, invalid } = parseModelList(value);
        if (invalid.length === 0) return models;
        ctx.addIssue({ code: 'custom', message: `Not a model id: ${invalid.slice(0, 3).join(', ')}` });
        return z.NEVER;
      }),
    temperature: decimal(0, 2),
    maxTokens: wholeNumber(16, 4096),
    timeoutMs: wholeNumber(1000, 60_000),
  }),
  seo: z.object({ aiCrawlers: z.enum(['allow', 'block'], { error: 'Choose allow or block' }), indexNow: flag }),
});

export type ChatSeoForm = z.output<typeof chatSeoSchema>;

/** The embeddings controls live in the knowledge-base admin: keep whatever is stored. */
export const applyChat = (current: ChatSettings, form: ChatSeoForm): ChatSettings => ({
  ...current,
  ...form.chat,
});

export const applySeo = (form: ChatSeoForm): SeoSettings => form.seo;

// ---------------------------------------------------------------------------
// Staff accounts

const staffId = z.string(required).trim().transform(Number).pipe(z.number().int().positive());
const staffRole = z.enum(['owner', 'staff'], { error: 'Choose owner or staff' });

export const staffSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create'),
    name: requiredText(100),
    email: z.string(required).trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
    role: staffRole,
  }),
  z.object({ intent: z.literal('role'), id: staffId, role: staffRole }),
  z.object({
    intent: z.literal('active'),
    id: staffId,
    active: z.enum(['true', 'false']).transform((value) => value === 'true'),
  }),
  z.object({ intent: z.literal('reset'), id: staffId }),
]);
