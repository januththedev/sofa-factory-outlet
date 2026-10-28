import type { BookingSettings } from '@/lib/settings/types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function colomboToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function dayNumber(date: string): number {
  if (!DATE.test(date)) return Number.NaN;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(parsed) ? Number.NaN : Math.floor(parsed / 86_400_000);
}
export function weekdayForDate(date: string): number {
  const day = dayNumber(date);
  return Number.isNaN(day) ? -1 : new Date(day * 86_400_000).getUTCDay();
}
export function isWithinLeadTime(date: string, leadDays: number, today = colomboToday()): boolean {
  return dayNumber(date) - dayNumber(today) < leadDays;
}
export function isWithinHorizon(date: string, horizonDays: number, today = colomboToday()): boolean {
  const difference = dayNumber(date) - dayNumber(today);
  return difference >= 0 && difference < horizonDays;
}
export function dateIsBookable(date: string, booking: Pick<BookingSettings, 'leadDays' | 'horizonDays'>, closedDates: readonly string[], today = colomboToday()): boolean {
  return !closedDates.includes(date) && !isWithinLeadTime(date, booking.leadDays, today) && isWithinHorizon(date, booking.horizonDays, today);
}
