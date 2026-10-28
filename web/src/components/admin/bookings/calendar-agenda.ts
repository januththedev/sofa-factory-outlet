import { addDays } from '@/lib/admin/bookings';
import { formatVisitDate } from '@/lib/admin/bookings';
import type { Calendar } from '@/lib/admin/bookings';

/** Keep the selected day and its slot data, with navigation moving one Colombo date at a time. */
export function calendarAgenda(calendar: Calendar): Calendar {
  if (calendar.view === 'day') return calendar;
  return {
    ...calendar,
    view: 'day',
    from: calendar.date,
    to: calendar.date,
    title: formatVisitDate(calendar.date),
    prev: addDays(calendar.date, -1),
    next: addDays(calendar.date, 1),
    days: calendar.days.filter((day) => day.date === calendar.date),
  };
}
