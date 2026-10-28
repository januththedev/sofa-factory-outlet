import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { calendarAgenda } from '@/components/admin/bookings/calendar-agenda';
import type { Calendar } from '@/lib/admin/bookings';

const week: Calendar = {
  view: 'week',
  date: '2026-12-31',
  from: '2026-12-28',
  to: '2027-01-03',
  today: '2026-12-30',
  prev: '2026-12-24',
  next: '2027-01-07',
  title: '28 Dec – 3 Jan 2027',
  days: [
    { date: '2026-12-30', label: 'Wed 30 Dec', isToday: true, slots: [] },
    {
      date: '2026-12-31',
      label: 'Thu 31 Dec',
      isToday: false,
      slots: [{
        key: '1',
        label: '10:00–11:00',
        capacity: 1,
        booked: 1,
        bookings: [{ id: 42, reference: 'SFO-B-0042', customerName: 'Test visitor', pieces: 2, status: 'new' }],
      }],
    },
    { date: '2027-01-01', label: 'Fri 1 Jan', isToday: false, slots: [] },
  ],
};

describe('phone calendar agenda', () => {
  it('shows the selected day with its bookings and capacity', () => {
    const agenda = calendarAgenda(week);
    expect(agenda.view).toBe('day');
    expect(agenda.from).toBe('2026-12-31');
    expect(agenda.to).toBe('2026-12-31');
    expect(agenda.title).toMatch(/^Thu,? 31 Dec 2026$/);
    expect(agenda.days).toEqual([week.days[1]]);
    expect(week.days).toHaveLength(3);
    expect(week.view).toBe('week');
  });

  it('moves a single day across a month and year boundary', () => {
    const agenda = calendarAgenda(week);
    expect(agenda.prev).toBe('2026-12-30');
    expect(agenda.next).toBe('2027-01-01');
    expect(agenda.today).toBe('2026-12-30');
  });

  it('preserves an existing day view and a day with no slots', () => {
    const agenda = calendarAgenda(week);
    expect(calendarAgenda(agenda)).toBe(agenda);
    expect(calendarAgenda({ ...week, date: '2027-01-01' }).days[0].slots).toEqual([]);
  });
});
