import { afterEach, describe, expect, it, vi } from 'vitest';
import { addMonths, cellState, formatMonthLabel, formatVisitDate, monthWeeks, moveDate } from '@/components/booking/calendar';
import {
  type BookingDetails,
  bookingDetailsSchema,
  bookingSubmissionSchema,
  fieldErrorsFromZod,
  readBookingFormData,
  toBookingFormData,
} from '@/components/booking/schema';
import type { DayAvailability } from '@/lib/bookings/api';

const valid: BookingDetails = {
  name: 'Nimal Perera',
  phone: '077 123 4567',
  whatsappSame: true,
  email: '',
  city: 'Dehiwala',
  date: '2026-11-03',
  slotId: 4,
  notes: '',
  preferredContact: 'whatsapp',
  consent: true,
};
const item = { productId: 3, variantId: 9, quantity: 2 };

const pathsOf = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.join('.'));

describe('booking details schema', () => {
  it('accepts a complete booking and keeps optional fields optional', () => {
    expect(bookingDetailsSchema.safeParse(valid).success).toBe(true);
    expect(bookingDetailsSchema.safeParse({ ...valid, email: 'nimal@example.com', city: '', notes: 'Two seater please' }).success).toBe(true);
  });

  it.each(['0771234567', '077 123 4567', '077-123-4567', '+94 77 123 4567', '0094771234567', '94771234567', '011 234 5678'])('accepts the phone number %s', (phone) => {
    expect(bookingDetailsSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });

  it.each(['', '   ', '12345', '0771234', 'abcdefg', '077 123 456 789', '+1 202 555 0143'])('rejects the phone number %j', (phone) => {
    const result = bookingDetailsSchema.safeParse({ ...valid, phone });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain('phone');
  });

  it('requires the consent box to be ticked', () => {
    for (const consent of [false, undefined]) {
      const result = bookingDetailsSchema.safeParse({ ...valid, consent });
      expect(result.success).toBe(false);
      expect(pathsOf(result)).toContain('consent');
    }
    const refused = bookingDetailsSchema.safeParse({ ...valid, consent: false });
    if (!refused.success) expect(fieldErrorsFromZod(refused.error).consent).toMatch(/tick the box/i);
  });

  it.each(['', '03/11/2026', '2026-11-3', '2026-13-01', '2026-02-30', 'tomorrow'])('rejects the date %j', (date) => {
    const result = bookingDetailsSchema.safeParse({ ...valid, date });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain('date');
  });

  it('accepts real dates including a leap day', () => {
    expect(bookingDetailsSchema.safeParse({ ...valid, date: '2028-02-29' }).success).toBe(true);
    expect(bookingDetailsSchema.safeParse({ ...valid, date: '2027-02-29' }).success).toBe(false);
  });

  it('checks the name, the time slot and the email', () => {
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, name: 'A' }))).toContain('name');
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, name: 'x'.repeat(81) }))).toContain('name');
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, slotId: undefined }))).toContain('slotId');
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, slotId: 0 }))).toContain('slotId');
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, slotId: 1.5 }))).toContain('slotId');
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, email: 'not-an-email' }))).toContain('email');
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, notes: 'x'.repeat(2001) }))).toContain('notes');
  });

  it('needs an email address when email is the preferred way to be contacted', () => {
    const missing = bookingDetailsSchema.safeParse({ ...valid, preferredContact: 'email', email: '' });
    expect(missing.success).toBe(false);
    expect(pathsOf(missing)).toContain('email');
    expect(bookingDetailsSchema.safeParse({ ...valid, preferredContact: 'email', email: 'nimal@example.com' }).success).toBe(true);
    expect(pathsOf(bookingDetailsSchema.safeParse({ ...valid, preferredContact: 'sms' }))).toContain('preferredContact');
  });
});

describe('booking submission schema (items)', () => {
  const submission = { ...valid, items: [item] };

  it('accepts pieces with or without a colour, and an empty cart', () => {
    expect(bookingSubmissionSchema.safeParse(submission).success).toBe(true);
    expect(bookingSubmissionSchema.safeParse({ ...valid, items: [{ productId: 3, quantity: 1 }] }).success).toBe(true);
    expect(bookingSubmissionSchema.safeParse({ ...valid, items: [] }).success).toBe(true);
  });

  it.each([
    ['quantity 0', [{ ...item, quantity: 0 }]],
    ['quantity 21', [{ ...item, quantity: 21 }]],
    ['a fractional quantity', [{ ...item, quantity: 1.5 }]],
    ['product id 0', [{ ...item, productId: 0 }]],
    ['a negative product id', [{ ...item, productId: -4 }]],
    ['a text product id', [{ ...item, productId: 'three' }]],
    ['more than 20 pieces', Array.from({ length: 21 }, (_, index) => ({ productId: index + 1, quantity: 1 }))],
  ])('rejects %s', (_label, items) => {
    const result = bookingSubmissionSchema.safeParse({ ...valid, items });
    expect(result.success).toBe(false);
    expect(pathsOf(result).some((path) => path.startsWith('items'))).toBe(true);
    // The message is shown to the visitor, so it must be our wording and not the validator's.
    if (!result.success) expect(fieldErrorsFromZod(result.error).items).not.toMatch(/expected|invalid input|too (small|big)/i);
  });

  it('rejects a piece that is not an object in plain words', () => {
    const result = bookingSubmissionSchema.safeParse({ ...valid, items: ['sofa'] });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrorsFromZod(result.error).items).toMatch(/could not be read/i);
  });

  it('rejects a missing or non-list items value and reports it under "items"', () => {
    for (const items of [undefined, 'oops', { productId: 1 }]) {
      const result = bookingSubmissionSchema.safeParse({ ...valid, items });
      expect(result.success).toBe(false);
      if (!result.success) expect(fieldErrorsFromZod(result.error).items).toBeTruthy();
    }
  });

  it('keeps the first message per field', () => {
    const result = bookingSubmissionSchema.safeParse({ ...valid, name: '', phone: '', items: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrorsFromZod(result.error);
    expect(Object.keys(errors).sort()).toEqual(['name', 'phone']);
    expect(errors.name).toMatch(/full name/i);
  });
});

describe('form data round trip', () => {
  const extras = {
    items: [item],
    meta: { visitorId: 'v-1', sourcePage: '/cart/', referrer: 'https://www.google.com/', utm: { source: 'facebook' } },
  };

  it('reads back exactly what the browser sent', () => {
    const read = readBookingFormData(toBookingFormData(valid, extras));
    const parsed = bookingSubmissionSchema.safeParse(read.raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ ...valid, items: [item] });
    expect(read.meta).toEqual(extras.meta);
  });

  it('keeps a false switch and an unticked box false', () => {
    const read = readBookingFormData(toBookingFormData({ ...valid, whatsappSame: false, consent: false }, extras));
    expect(read.raw.whatsappSame).toBe(false);
    expect(read.raw.consent).toBe(false);
  });

  it('drops malformed context instead of failing the booking', () => {
    const formData = toBookingFormData(valid, { ...extras, meta: { visitorId: 'v-1', referrer: 'x'.repeat(2000) } });
    expect(readBookingFormData(formData).meta).toEqual({});
    const bad = toBookingFormData(valid, extras);
    bad.set('utm', '{not json');
    expect(readBookingFormData(bad).meta).toMatchObject({ visitorId: 'v-1' });
  });

  it('treats broken items, a missing slot and a missing token as invalid input, not as a crash', () => {
    const formData = toBookingFormData(valid, extras);
    formData.set('items', '[{"productId":');
    formData.delete('slotId');
    const read = readBookingFormData(formData);
    const result = bookingSubmissionSchema.safeParse(read.raw);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toEqual(expect.arrayContaining(['slotId', 'items']));
  });
});

describe('calendar helpers', () => {
  const first = '2026-10-29';
  const last = '2026-12-12';

  it('lays a month out Monday first', () => {
    const weeks = monthWeeks('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('moves the focus with the keyboard and never leaves the offered range', () => {
    expect(moveDate('2026-11-05', 'ArrowDown', first, last)).toBe('2026-11-12');
    expect(moveDate('2026-11-05', 'ArrowUp', first, last)).toBe('2026-10-29');
    expect(moveDate('2026-11-05', 'ArrowRight', first, last)).toBe('2026-11-06');
    expect(moveDate('2026-11-05', 'ArrowLeft', first, last)).toBe('2026-11-04');
    expect(moveDate('2026-11-05', 'Home', first, last)).toBe('2026-11-02');
    expect(moveDate('2026-11-05', 'End', first, last)).toBe('2026-11-08');
    expect(moveDate('2026-11-05', 'PageDown', first, last)).toBe('2026-12-05');
    expect(moveDate(first, 'ArrowLeft', first, last)).toBe(first);
    expect(moveDate(last, 'ArrowRight', first, last)).toBe(last);
    expect(moveDate('2026-12-10', 'PageDown', first, last)).toBe(last);
    expect(moveDate('2026-11-05', 'Enter', first, last)).toBeNull();
  });

  it('shortens the day when the next month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('tells open, full, closed and unoffered days apart', () => {
    const slot = (remaining: number) => ({ slotId: 1, label: '10:00–12:00', start: '10:00', end: '12:00', capacity: 3, booked: 3 - remaining, remaining });
    const day = (open: boolean, ...slots: number[]): DayAvailability => ({ date: '2026-11-03', open, slots: slots.map(slot) });
    expect(cellState(undefined)).toBe('outside');
    expect(cellState(day(false, 3))).toBe('closed');
    expect(cellState(day(true, 0, 0))).toBe('full');
    expect(cellState(day(true))).toBe('full');
    expect(cellState(day(true, 0, 2))).toBe('open');
  });

  it('formats dates the British way', () => {
    expect(formatVisitDate('2026-11-03')).toBe('Tuesday 3 November 2026');
    expect(formatMonthLabel('2026-11')).toBe('November 2026');
  });
});

// The helpers below read the environment when they are first imported, so each
// test loads a fresh copy of them with the environment it wants.
function freshEnvironment(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock('resend');
});

describe('owner booking email', () => {
  const summary = {
    reference: 'SFO-B-0042',
    bookingId: 42,
    customerName: 'Nimal Perera',
    phone: '+94771234567',
    email: 'nimal@example.com',
    city: 'Dehiwala',
    preferredContact: 'whatsapp' as const,
    notes: 'Two seater please',
    visitDate: '2026-11-03',
    slotLabel: '10:00–12:00',
    items: [{ name: 'Emerald L-Shape', colourName: 'Emerald velvet', quantity: 1 }],
  };

  async function load(env: Record<string, string | undefined>, send = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })) {
    const constructed = vi.fn();
    vi.doMock('resend', () => ({
      Resend: class {
        emails = { send };
        constructor(apiKey: string) {
          constructed(apiKey);
        }
      },
    }));
    freshEnvironment(env);
    const email = await import('@/lib/notify/email');
    return { ...email, send, constructed };
  }

  it('does nothing without Resend configuration', async () => {
    for (const env of [{ RESEND_API_KEY: undefined, ADMIN_ALERT_EMAIL: undefined }, { RESEND_API_KEY: 're_test_key', ADMIN_ALERT_EMAIL: undefined }, { RESEND_API_KEY: undefined, ADMIN_ALERT_EMAIL: 'owner@example.com' }]) {
      const { sendOwnerBookingEmail, send, constructed } = await load(env);
      await expect(sendOwnerBookingEmail(summary)).resolves.toBeUndefined();
      expect(constructed).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('sends the alert to every owner address with the booking details', async () => {
    const { sendOwnerBookingEmail, send, constructed } = await load({ RESEND_API_KEY: 're_test_key', ADMIN_ALERT_EMAIL: 'owner@example.com, manager@example.com' });
    await sendOwnerBookingEmail(summary);
    expect(constructed).toHaveBeenCalledWith('re_test_key');
    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0] as { from: string; to: string[]; subject: string; html: string; text: string; replyTo?: string };
    expect(message.to).toEqual(['owner@example.com', 'manager@example.com']);
    expect(message.from).toContain('@');
    expect(message.subject).toContain('SFO-B-0042');
    expect(message.replyTo).toBe('nimal@example.com');
    for (const body of [message.html, message.text]) {
      expect(body).toContain('Nimal Perera');
      expect(body).toContain('+94 77 123 4567');
      expect(body).toContain('Emerald L-Shape');
      expect(body).toContain('10:00–12:00');
      expect(body).toContain('/admin/bookings/42/');
    }
  });

  it('escapes whatever the visitor typed', async () => {
    const { buildOwnerBookingEmail } = await load({ RESEND_API_KEY: 're_test_key', ADMIN_ALERT_EMAIL: 'owner@example.com' });
    const { html, subject } = buildOwnerBookingEmail({ ...summary, customerName: '<script>alert(1)</script>', notes: 'a "quote" & <b>bold</b>\nsecond line', items: [] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('No pieces selected');
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it('never throws: a failing send is logged and swallowed', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = await load({ RESEND_API_KEY: 're_test_key', ADMIN_ALERT_EMAIL: 'owner@example.com' }, vi.fn().mockRejectedValue(new Error('boom')));
    await expect(failing.sendOwnerBookingEmail(summary)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(1);

    const refusing = await load({ RESEND_API_KEY: 're_test_key', ADMIN_ALERT_EMAIL: 'owner@example.com' }, vi.fn().mockResolvedValue({ data: null, error: { message: 'domain not verified' } }));
    await expect(refusing.sendOwnerBookingEmail(summary)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(2);
  });
});
