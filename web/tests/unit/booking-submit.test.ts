import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), limited: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/bookings/api', () => ({ createBooking: mocks.create, getAvailability: vi.fn(), getBookingByReference: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  isRateLimited: mocks.limited,
  phoneKey: (phone: string) => `phone:${phone}`,
  visitorKey: (id: string) => `visitor:${id}`,
}));
vi.mock('@/lib/env', () => ({ hasEmail: () => false }));
vi.mock('@/lib/notify/email', () => ({ sendOwnerBookingEmail: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/server', () => ({ after: vi.fn() }));

import { submitBooking } from '@/app/(site)/book-visit/actions';
import { toBookingFormData } from '@/components/booking/schema';

function formData() {
  return toBookingFormData({
    name: 'Test Visitor', phone: '077 123 4567', whatsappSame: true,
    email: '', city: '', date: '2026-11-03', slotId: 1, notes: '', preferredContact: 'whatsapp', consent: true,
  }, { items: [], meta: { visitorId: 'test-visitor' } });
}

describe('booking submissions without an external CAPTCHA service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limited.mockResolvedValue(false);
    mocks.create.mockResolvedValue({ ok: true, reference: 'SFO-B-0001', bookingId: 1 });
    mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
  });

  it('saves a valid submission and redirects without requiring an external token', async () => {
    await expect(submitBooking(null, formData())).rejects.toThrow('redirect:/book-visit/done/SFO-B-0001/');
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ phone: '+94771234567', consent: true }));
    expect(mocks.limited).toHaveBeenCalledWith(expect.objectContaining({ key: 'phone:+94771234567', limit: 5 }));
    expect(mocks.limited).toHaveBeenCalledWith(expect.objectContaining({ key: 'visitor:test-visitor', limit: 5 }));
  });

  it('keeps the booking rate limit', async () => {
    mocks.limited.mockResolvedValue(true);
    expect(await submitBooking(null, formData())).toMatchObject({ code: 'rate_limited' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects invalid input before accessing the booking service', async () => {
    const data = formData();
    data.set('phone', 'invalid');
    expect(await submitBooking(null, data)).toMatchObject({ code: 'invalid', fieldErrors: { phone: expect.any(String) } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
