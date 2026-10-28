import { afterEach, describe, expect, it, vi } from 'vitest';
import { earliestAvailable, next14OpenDays } from '@/components/booking/availability';
import { addDays } from '@/components/booking/calendar';
import {
  BOOKING_DRAFT_KEY,
  clearBookingDraft,
  type DraftStorage,
  restoreBookingDraft,
  saveBookingDraft,
} from '@/components/booking/draft';
import type { BookingDetails } from '@/components/booking/schema';
import type { DayAvailability } from '@/lib/bookings/api';

function fakeStorage(): DraftStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

const details: BookingDetails = {
  name: 'Nimal Perera',
  phone: '077 123 4567',
  whatsappSame: true,
  email: '',
  city: 'Dehiwala',
  date: '2026-11-03',
  slotId: 4,
  notes: 'Two seats please',
  preferredContact: 'whatsapp',
  consent: true,
};

function day(date: string, remaining: number[], open = true): DayAvailability {
  return {
    date,
    open,
    slots: remaining.map((places, index) => ({
      slotId: index + 1,
      start: `${10 + index * 2}:00`,
      end: `${12 + index * 2}:00`,
      label: `${10 + index * 2}:00–${12 + index * 2}:00`,
      capacity: 3,
      booked: 3 - places,
      remaining: places,
    })),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('booking draft storage', () => {
  it('round-trips every detail except consent and clears after success', () => {
    const storage = fakeStorage();
    saveBookingDraft(details, storage);
    expect(restoreBookingDraft(storage)).toEqual({
      name: details.name,
      phone: details.phone,
      whatsappSame: details.whatsappSame,
      email: details.email,
      city: details.city,
      date: details.date,
      slotId: details.slotId,
      notes: details.notes,
      preferredContact: details.preferredContact,
    });
    expect(storage.getItem(BOOKING_DRAFT_KEY)).not.toContain('consent');
    clearBookingDraft(storage);
    expect(restoreBookingDraft(storage)).toBeNull();
  });

  it('keeps unfinished values, whitespace and a false WhatsApp switch for later validation', () => {
    const storage = fakeStorage();
    saveBookingDraft({ name: 'N', phone: '077 ', email: 'nimal@', whatsappSame: false }, storage);
    expect(restoreBookingDraft(storage)).toEqual({
      name: 'N', phone: '077 ', email: 'nimal@', whatsappSame: false,
    });
  });

  it('drops consent and unrelated metadata even if written by an older client', () => {
    const storage = fakeStorage();
    storage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({ name: 'Nimal', consent: true, visitorId: 'private' }));
    expect(restoreBookingDraft(storage)).toEqual({ name: 'Nimal' });
  });

  it('handles absent, corrupt and incorrectly typed drafts', () => {
    const storage = fakeStorage();
    expect(restoreBookingDraft(storage)).toBeNull();
    for (const value of ['{bad json', 'null', '[]', '42', '{"phone":42}', '{"slotId":"4"}']) {
      storage.setItem(BOOKING_DRAFT_KEY, value);
      expect(restoreBookingDraft(storage)).toBeNull();
    }
  });

  it('never throws when storage reads, writes or removals fail', () => {
    const blocked = () => { throw new Error('Storage blocked'); };
    const storage: DraftStorage = { getItem: blocked, setItem: blocked, removeItem: blocked };
    expect(() => saveBookingDraft(details, storage)).not.toThrow();
    expect(restoreBookingDraft(storage)).toBeNull();
    expect(() => clearBookingDraft(storage)).not.toThrow();
  });

  it('catches an exception when accessing the browser storage property itself', () => {
    const browser = Object.defineProperty({}, 'sessionStorage', {
      get: () => { throw new Error('Private mode'); },
    });
    vi.stubGlobal('window', browser);
    expect(() => saveBookingDraft(details)).not.toThrow();
    expect(restoreBookingDraft()).toBeNull();
    expect(() => clearBookingDraft()).not.toThrow();
  });
});

describe('earliest available visit', () => {
  it('skips closed, empty and full days and selects the first free time', () => {
    const days = [
      day('2026-11-03', [3], false),
      day('2026-11-04', []),
      day('2026-11-05', [0, 0]),
      day('2026-11-06', [0, 2, 1]),
      day('2026-11-07', [3]),
    ];
    expect(earliestAvailable(days)).toEqual({ date: '2026-11-06', slotId: 2 });
  });

  it('orders days and times without mutating server availability', () => {
    const later = day('2026-11-05', [3]);
    const earlier = day('2026-11-04', [2, 1]);
    earlier.slots.reverse();
    const days = [later, earlier];
    const original = structuredClone(days);
    expect(earliestAvailable(days)).toEqual({ date: '2026-11-04', slotId: 1 });
    expect(days).toEqual(original);
  });

  it('finds the next free option after a capacity refresh', () => {
    const refreshed = [day('2026-11-03', [1]), day('2026-11-04', [0, 2])];
    expect(earliestAvailable(refreshed, '2026-11-04')).toEqual({ date: '2026-11-04', slotId: 2 });
    expect(earliestAvailable(refreshed, '2026-11-05')).toBeNull();
  });

  it('returns null when no free visit exists', () => {
    expect(earliestAvailable([])).toBeNull();
    expect(earliestAvailable([day('2026-11-03', [0]), day('2026-11-04', [2], false)])).toBeNull();
  });
});

describe('next 14 open days', () => {
  it('returns 14 scheduled days, skips closures and keeps full days for their explanation', () => {
    const days = Array.from({ length: 32 }, (_, index) => (
      day(addDays('2026-12-24', index), [index === 2 ? 0 : 3], index % 3 !== 0)
    ));
    days.reverse();
    const original = structuredClone(days);
    const selected = next14OpenDays(days);
    expect(selected).toHaveLength(14);
    expect(selected.every((item) => item.open)).toBe(true);
    expect(selected[0].date).toBe('2026-12-25');
    expect(selected[1].slots[0].remaining).toBe(0);
    expect(selected.map((item) => item.date)).toEqual(
      [...selected].map((item) => item.date).sort(),
    );
    expect(selected[13].date).toBe('2027-01-13');
    expect(days).toEqual(original);
  });

  it('returns fewer days near the booking horizon without inventing availability', () => {
    const only = day('2026-11-03', [2]);
    expect(next14OpenDays([only, day('2026-11-04', [3], false)])).toEqual([only]);
    expect(next14OpenDays([])).toEqual([]);
    expect(next14OpenDays([day('2026-11-04', [3], false)])).toEqual([]);
  });
});
