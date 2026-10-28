import { format, parseISO } from 'date-fns';
import type { DayAvailability } from '@/lib/bookings/api';

// Pure date helpers for the visit calendar. Dates are plain 'YYYY-MM-DD' strings
// (the business works in Asia/Colombo and the booking core hands them out as
// strings), so all arithmetic is done in UTC and never depends on the browser's
// time zone.

const DAY_MS = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);
const pad = (value: number) => String(value).padStart(2, '0');
/** 0 = Monday … 6 = Sunday (the calendar starts its week on Monday). */
const mondayIndex = (date: string) => (new Date(toTime(date)).getUTCDay() + 6) % 7;

export const WEEKDAYS = [
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
  { short: 'Sun', full: 'Sunday' },
] as const;

export const addDays = (date: string, days: number): string => fromTime(toTime(date) + days * DAY_MS);
export const monthOf = (date: string): string => date.slice(0, 7);

export function daysInMonth(month: string): number {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

/** Same day of the month `delta` months away, shortened to fit shorter months (31 Jan + 1 month = 28 Feb). */
export function addMonths(date: string, delta: number): string {
  const [year, number, day] = date.split('-').map(Number);
  const month = new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
  return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
}

/** ISO dates compare correctly as strings. */
export const clampDate = (date: string, first: string, last: string): string => (date < first ? first : date > last ? last : date);

/** "Tuesday 3 November 2026" */
export const formatVisitDate = (date: string): string => format(parseISO(date), 'EEEE d MMMM yyyy');
/** "November 2026" for a 'YYYY-MM' month. */
export const formatMonthLabel = (month: string): string => format(parseISO(`${month}-01`), 'MMMM yyyy');

export type CellState = 'open' | 'full' | 'closed' | 'outside';

/** open: can be picked; full: open but every slot is taken; closed: not bookable; outside: not offered at all. */
export function cellState(day: DayAvailability | undefined): CellState {
  if (!day) return 'outside';
  if (!day.open) return 'closed';
  return day.slots.some((slot) => slot.remaining > 0) ? 'open' : 'full';
}

/** Weeks (Monday first) of a 'YYYY-MM' month; days outside the month are null. */
export function monthWeeks(month: string): Array<Array<string | null>> {
  const lead = mondayIndex(`${month}-01`);
  const cells: Array<string | null> = [
    ...new Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(month) }, (_, index) => `${month}-${pad(index + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

/** Where a calendar key press moves the focus, kept inside [first, last]; null for keys that do not move it. */
export function moveDate(date: string, key: string, first: string, last: string): string | null {
  const weekday = mondayIndex(date);
  switch (key) {
    case 'ArrowLeft':
      return clampDate(addDays(date, -1), first, last);
    case 'ArrowRight':
      return clampDate(addDays(date, 1), first, last);
    case 'ArrowUp':
      return clampDate(addDays(date, -7), first, last);
    case 'ArrowDown':
      return clampDate(addDays(date, 7), first, last);
    case 'Home':
      return clampDate(addDays(date, -weekday), first, last);
    case 'End':
      return clampDate(addDays(date, 6 - weekday), first, last);
    case 'PageUp':
      return clampDate(addMonths(date, -1), first, last);
    case 'PageDown':
      return clampDate(addMonths(date, 1), first, last);
    default:
      return null;
  }
}
