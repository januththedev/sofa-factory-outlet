import { describe, expect, it } from 'vitest';
import { buildIcs } from '@/lib/bookings/ics';
import { colomboToday, dateIsBookable, isWithinHorizon, isWithinLeadTime, weekdayForDate } from '@/lib/bookings/rules';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

describe('booking date rules', () => {
  it('uses the Colombo date across UTC midnight', () => {
    expect(colomboToday(new Date('2026-10-26T18:29:59Z'))).toBe('2026-10-26');
    expect(colomboToday(new Date('2026-10-26T18:30:00Z'))).toBe('2026-10-27');
  });

  it('calculates weekdays without depending on the process timezone', () => {
    expect(weekdayForDate('2026-10-25')).toBe(0);
    expect(weekdayForDate('2026-10-26')).toBe(1);
  });

  it('treats the lead edge as the first bookable day', () => {
    expect(isWithinLeadTime('2026-10-27', 1, '2026-10-27')).toBe(true);
    expect(isWithinLeadTime('2026-10-28', 1, '2026-10-27')).toBe(false);
  });

  it('uses an exclusive horizon edge and rejects closed dates', () => {
    expect(isWithinHorizon('2026-11-10', 15, '2026-10-27')).toBe(true);
    expect(isWithinHorizon('2026-11-11', 15, '2026-10-27')).toBe(false);
    expect(dateIsBookable('2026-10-28', { leadDays: 1, horizonDays: 15 }, ['2026-10-28'], '2026-10-27')).toBe(false);
  });
});

describe('iCalendar output', () => {
  it('escapes text, folds at 75 octets and uses CRLF throughout', () => {
    const calendar = buildIcs({
      reference: 'SFO-B-0042', status: 'new', visitDate: '2026-10-28', slotLabel: '10:00–12:00',
      customerName: 'Test Customer', phone: '+94771234567', createdAt: '2026-10-27T10:11:12.000Z',
      items: [{ name: `Long sofa, with semicolon; and ${'é'.repeat(50)}`, slug: 'long-sofa', colourName: 'Blue', quantity: 2, image: null }],
    }, DEFAULT_SETTINGS.business);

    expect(calendar).toContain('DTSTART;TZID=Asia/Colombo:20261028T100000\r\n');
    expect(calendar.replace(/\r\n /g, '')).toContain('Long sofa\\, with semicolon\\;');
    expect(calendar).not.toMatch(/(^|[^\r])\n/);
    for (const line of calendar.split('\r\n').filter(Boolean)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(calendar.split('\r\n').some((line) => line.startsWith(' '))).toBe(true);
  });
});
