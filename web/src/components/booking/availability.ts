import type { DayAvailability } from '@/lib/bookings/api';

/** Open means scheduled for visits; fully booked days stay in the rail with an explanation. */
export function next14OpenDays(availability: readonly DayAvailability[]): DayAvailability[] {
  return [...availability].sort((a, b) => a.date.localeCompare(b.date)).filter((day) => day.open).slice(0, 14);
}

export type VisitSelection = { date: string; slotId: number };

export function earliestAvailable(
  availability: readonly DayAvailability[],
  from?: string,
): VisitSelection | null {
  const days = [...availability].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) {
    if (!day.open || (from && day.date < from)) continue;
    const slot = [...day.slots].sort((a, b) => a.start.localeCompare(b.start)).find((item) => item.remaining > 0);
    if (slot) return { date: day.date, slotId: slot.slotId };
  }
  return null;
}
