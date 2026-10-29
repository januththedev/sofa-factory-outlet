import 'server-only';
import { newAccessToken, tokenHash } from '@/lib/security/access';
import { consumeLimit } from '@/lib/security/shared-limit';

import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { pictureData, type PictureData } from '@/lib/images/urls';
import { createNotification } from '@/lib/notify/bell';
import { isLkMobile, normaliseLkPhone } from '@/lib/phone';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import { getSettings } from '@/lib/settings/get';
import type { SettingsMap } from '@/lib/settings/types';
import { colomboToday, dateIsBookable, weekdayForDate } from './rules';

export type SlotAvailability = {
  slotId: number;
  label: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
  remaining: number;
};
export type DayAvailability = {
  date: string;
  open: boolean;
  slots: SlotAvailability[];
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const labelFor = (start: string, end: string) => `${start}–${end}`;

function mergeSetting<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base))
    return override as T;
  if (typeof override !== 'object' || Array.isArray(override))
    return override as T;
  const result: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(
    override as Record<string, unknown>,
  )) {
    result[key] = key in result ? mergeSetting(result[key], value) : value;
  }
  return result as T;
}

async function bookingSettings(): Promise<SettingsMap> {
  try {
    return await getSettings();
  } catch (error) {
    // `unstable_cache` has no request cache in plain database tests. Production
    // always takes the cached path; this fallback preserves database overrides.
    if (
      !(error instanceof Error) ||
      !error.message.includes('incrementalCache missing')
    )
      throw error;
    const db = await getDb();
    const rows = await db.select().from(s.settings);
    const result = structuredClone(DEFAULT_SETTINGS);
    for (const row of rows) {
      if (row.key in result) {
        const key = row.key as keyof SettingsMap;
        (result as Record<string, unknown>)[key] = mergeSetting(
          result[key],
          row.value,
        );
      }
    }
    return result;
  }
}

function offsetDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function getAvailability(
  options: { from?: string; days?: number } = {},
): Promise<DayAvailability[]> {
  const settings = await bookingSettings();
  const from = options.from ?? colomboToday();
  const days = options.days ?? settings.booking.horizonDays;
  if (!datePattern.test(from) || !Number.isInteger(days) || days < 0) return [];
  const dates = Array.from({ length: days }, (_, offset) =>
    offsetDate(from, offset),
  );
  const db = await getDb();
  const slots = await db
    .select()
    .from(s.bookingSlots)
    .where(eq(s.bookingSlots.active, true))
    .orderBy(asc(s.bookingSlots.start));
  const counts = dates.length
    ? await db
        .select({
          date: s.bookings.visitDate,
          slotId: s.bookings.slotId,
          booked: sql<number>`count(*)::int`,
        })
        .from(s.bookings)
        .where(
          and(
            inArray(s.bookings.visitDate, dates),
            ne(s.bookings.status, 'cancelled'),
            ne(s.bookings.status, 'lost'),
          ),
        )
        .groupBy(s.bookings.visitDate, s.bookings.slotId)
    : [];
  const countMap = new Map(
    counts.map((row) => [`${row.date}:${row.slotId}`, row.booked]),
  );
  return dates.map((date) => {
    const weekday = weekdayForDate(date);
    const matching = slots.filter((slot) => slot.weekday === weekday);
    const hoursOpen =
      !settings.hours.confirmed ||
      settings.hours.days[dayKeys[weekday]] !== null;
    return {
      date,
      open:
        dateIsBookable(date, settings.booking, settings.hours.closedDates) &&
        hoursOpen &&
        matching.length > 0,
      slots: matching.map((slot) => {
        const booked = countMap.get(`${date}:${slot.id}`) ?? 0;
        return {
          slotId: slot.id,
          label: labelFor(slot.start, slot.end),
          start: slot.start,
          end: slot.end,
          capacity: slot.capacity,
          booked,
          remaining: Math.max(0, slot.capacity - booked),
        };
      }),
    };
  });
}

export type BookingInput = {
  requestToken?: string;
  name: string;
  phone: string;
  whatsappSame: boolean;
  email?: string;
  city?: string;
  date: string;
  slotId: number;
  notes?: string;
  preferredContact: 'whatsapp' | 'call' | 'email';
  consent: true;
  items: Array<{ productId: number; variantId?: number; quantity: number }>;
  meta?: {
    sourcePage?: string;
    referrer?: string;
    utm?: Record<string, string>;
    visitorId?: string;
    conversationId?: number;
  };
};
export type BookingResult =
  | { ok: true; reference: string; bookingId: number; accessToken: string }
  | {
      ok: false;
      code:
        | 'slot_full'
        | 'slot_closed'
        | 'invalid'
        | 'rate_limited'
        | 'unknown';
      message: string;
      fieldErrors?: Record<string, string>;
    };

const bookingSchema = z.object({
  requestToken: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().transform((value, context) => {
    const phone = normaliseLkPhone(value);
    if (!phone)
      context.addIssue({
        code: 'custom',
        message: 'Enter a valid Sri Lankan phone number.',
      });
    return phone ?? '';
  }),
  whatsappSame: z.boolean(),
  email: z.email().optional(),
  city: z.string().trim().max(100).optional(),
  date: z
    .string()
    .regex(datePattern)
    .refine(
      (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      'Enter a valid date.',
    ),
  slotId: z.number().int().positive(),
  notes: z.string().trim().max(2000).optional(),
  preferredContact: z.enum(['whatsapp', 'call', 'email']),
  consent: z.literal(true),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive().optional(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(20),
  meta: z
    .object({
      sourcePage: z.string().max(500).optional(),
      referrer: z.string().max(1000).optional(),
      utm: z.record(z.string(), z.string()).optional(),
      visitorId: z.string().max(200).optional(),
      conversationId: z.number().int().positive().optional(),
    })
    .optional(),
});

const expectedFailure = (
  code: 'slot_full' | 'slot_closed',
  message: string,
): BookingResult => ({ ok: false, code, message });

export async function createBooking(
  input: BookingInput,
): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path.join('.') || 'form'] ??= issue.message;
    return {
      ok: false,
      code: 'invalid',
      message: 'Please check the highlighted fields.',
      fieldErrors,
    };
  }
  try {
    const settings = await bookingSettings();
    const db = await getDb();
    return await db.transaction(async (tx) => {
      const accessToken = parsed.data.requestToken ?? newAccessToken();
      const accessHash = tokenHash(accessToken);
      // Serialize retries even when they target different slots. Never store the raw bearer token.
      await tx
        .insert(s.rateBuckets)
        .values({
          key: `request:${accessHash}`,
          count: 0,
          expiresAt: new Date(Date.now() + 86400000),
        })
        .onConflictDoNothing();
      await tx
        .select()
        .from(s.rateBuckets)
        .where(eq(s.rateBuckets.key, `request:${accessHash}`))
        .for('update');
      const fingerprint = tokenHash(
        JSON.stringify({
          ...parsed.data,
          requestToken: undefined,
          meta: undefined,
        }),
      );
      const [existing] = await tx
        .select()
        .from(s.bookings)
        .where(eq(s.bookings.accessHash, accessHash))
        .limit(1);
      if (existing) {
        if (existing.requestFingerprint !== fingerprint)
          return {
            ok: false as const,
            code: 'invalid' as const,
            message:
              'This request was already submitted with different details.',
          };
        return {
          ok: true as const,
          reference: existing.reference,
          bookingId: existing.id,
          accessToken,
        };
      }
      if (!(await consumeLimit(`booking:${parsed.data.phone}`, 5, 3600000, tx)))
        return {
          ok: false as const,
          code: 'rate_limited' as const,
          message: 'Too many booking requests. Please try again later.',
        };
      if (parsed.data.meta?.visitorId && !await consumeLimit(`booking-visitor:${parsed.data.meta.visitorId}`, 5, 3600000, tx)) {
        return { ok: false as const, code: 'rate_limited' as const, message: 'Too many booking requests. Please try again later.' };
      }
      await tx.execute(
        sql`select id from booking_slots where id = ${parsed.data.slotId} for update`,
      );
      const [slot] = await tx
        .select()
        .from(s.bookingSlots)
        .where(eq(s.bookingSlots.id, parsed.data.slotId))
        .limit(1);
      const weekday = weekdayForDate(parsed.data.date);
      const hoursOpen =
        !settings.hours.confirmed ||
        settings.hours.days[dayKeys[weekday]] !== null;
      if (
        !slot ||
        !slot.active ||
        slot.weekday !== weekday ||
        !hoursOpen ||
        !dateIsBookable(
          parsed.data.date,
          settings.booking,
          settings.hours.closedDates,
        )
      ) {
        return expectedFailure(
          'slot_closed',
          'That time slot is not available.',
        );
      }
      const [{ booked }] = await tx
        .select({ booked: sql<number>`count(*)::int` })
        .from(s.bookings)
        .where(
          and(
            eq(s.bookings.visitDate, parsed.data.date),
            eq(s.bookings.slotId, slot.id),
            ne(s.bookings.status, 'cancelled'),
            ne(s.bookings.status, 'lost'),
          ),
        );
      if (booked >= slot.capacity)
        return expectedFailure('slot_full', 'That time slot is full.');

      const mobileWhatsapp =
        parsed.data.whatsappSame && isLkMobile(parsed.data.phone)
          ? parsed.data.phone
          : undefined;
      const [customer] = await tx
        .insert(s.customers)
        .values({
          name: parsed.data.name,
          phone: parsed.data.phone,
          whatsapp: mobileWhatsapp ?? null,
          email: parsed.data.email ?? null,
          city: parsed.data.city ?? null,
        })
        .onConflictDoUpdate({
          target: s.customers.phone,
          set: { phone: parsed.data.phone },
        })
        .returning({ id: s.customers.id });

      const snapshots: Array<typeof s.bookingItems.$inferInsert> = [];
      for (const item of parsed.data.items) {
        const [product] = await tx
          .select()
          .from(s.products)
          .where(
            and(
              eq(s.products.id, item.productId),
              eq(s.products.status, 'published'),
            ),
          )
          .limit(1);
        if (!product) continue;
        const variantWhere = item.variantId
          ? and(
              eq(s.productVariants.id, item.variantId),
              eq(s.productVariants.productId, product.id),
            )
          : and(
              eq(s.productVariants.productId, product.id),
              eq(s.productVariants.isDefault, true),
            );
        const [variant] = await tx
          .select()
          .from(s.productVariants)
          .where(variantWhere)
          .orderBy(asc(s.productVariants.sortOrder))
          .limit(1);
        if (!variant) continue;
        snapshots.push({
          bookingId: 0,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productSlug: product.slug,
          colourName: variant.colourName,
          hex: variant.hex,
          image: variant.images[0] ?? null,
          quantity: item.quantity,
          priceMinor: product.priceMinor,
        });
      }

      const sequenceResult = await tx.execute(
        sql`select nextval('booking_ref_seq')::int as value`,
      );
      const rows = (
        sequenceResult as unknown as {
          rows?: Array<{ value: number | string }>;
        }
      ).rows;
      const number = Number(rows?.[0]?.value);
      if (!Number.isInteger(number))
        throw new Error('booking_ref_seq did not return a number');
      const reference = `SFO-B-${String(number).padStart(4, '0')}`;
      const slotLabel = labelFor(slot.start, slot.end);
      const [booking] = await tx
        .insert(s.bookings)
        .values({
          reference,
          accessHash,
          requestFingerprint: fingerprint,
          accessExpiresAt: new Date(Date.now() + 60 * 86400000),
          contactSnapshot: {
            name: parsed.data.name,
            phone: parsed.data.phone,
            email: parsed.data.email,
            city: parsed.data.city,
          },
          customerId: customer.id,
          visitDate: parsed.data.date,
          slotId: slot.id,
          slotLabel,
          customerNotes: parsed.data.notes ?? null,
          preferredContact: parsed.data.preferredContact,
          city: parsed.data.city ?? null,
          sourcePage: parsed.data.meta?.sourcePage ?? null,
          referrer: parsed.data.meta?.referrer ?? null,
          utm: parsed.data.meta?.utm ?? null,
          visitorId: parsed.data.meta?.visitorId ?? null,
          conversationId: parsed.data.meta?.conversationId ?? null,
          consentAt: new Date(),
        })
        .returning({ id: s.bookings.id });
      if (snapshots.length)
        await tx
          .insert(s.bookingItems)
          .values(
            snapshots.map((item) => ({ ...item, bookingId: booking.id })),
          );
      await createNotification(
        {
          type: 'booking',
          title: `New booking ${reference}`,
          body: `${parsed.data.name} · ${parsed.data.date} · ${slotLabel}`,
          link: `/admin/bookings/${booking.id}/`,
        },
        tx,
      );
      return { ok: true, reference, bookingId: booking.id, accessToken };
    });
  } catch (error) {
    console.error('[bookings] could not create booking:', error);
    return {
      ok: false,
      code: 'unknown',
      message: 'We could not save your booking. Please try again.',
    };
  }
}

export type BookingSummary = {
  reference: string;
  status: string;
  visitDate: string;
  slotLabel: string;
  customerName: string;
  phone: string;
  items: Array<{
    name: string;
    slug: string | null;
    colourName: string | null;
    quantity: number;
    image: PictureData | null;
  }>;
  createdAt: string;
};

export async function getBookingByReference(
  reference: string,
): Promise<BookingSummary | null> {
  const db = await getDb();
  const [row] = await db
    .select({ booking: s.bookings, customer: s.customers })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(sql`lower(${s.bookings.reference}) = lower(${reference.trim()})`)
    .limit(1);
  if (!row) return null;
  const items = await db
    .select()
    .from(s.bookingItems)
    .where(eq(s.bookingItems.bookingId, row.booking.id))
    .orderBy(asc(s.bookingItems.id));
  return {
    reference: row.booking.reference,
    status: row.booking.status,
    visitDate: row.booking.visitDate,
    slotLabel: row.booking.slotLabel,
    customerName: row.booking.contactSnapshot?.name ?? row.customer.name,
    phone: row.booking.contactSnapshot?.phone ?? row.customer.phone,
    items: items.map((item) => ({
      name: item.productName,
      slug: item.productSlug,
      colourName: item.colourName,
      quantity: item.quantity,
      image: item.image ? pictureData(item.image) : null,
    })),
    createdAt: row.booking.createdAt.toISOString(),
  };
}
