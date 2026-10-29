import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/admin/bookings/status-badge';
import { STATUS_ACCENT } from '@/components/admin/bookings/status-badge';
import { buttonStyles } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { Calendar } from '@/lib/admin/bookings';
import type { CalendarDay } from '@/lib/admin/bookings';
import type { CalendarSlot } from '@/lib/admin/bookings';
import type { CalendarView as View } from '@/lib/admin/bookings';

const CALENDAR_PATH = '/admin/bookings/calendar/';
const calendarHref = (view: View, date: string) => `${CALENDAR_PATH}?view=${view}&date=${date}`;

function SlotBlock({ slot }: { slot: CalendarSlot }) {
  const full = slot.capacity !== null && slot.booked >= slot.capacity;
  const share = slot.capacity ? Math.min(100, Math.round((slot.booked / slot.capacity) * 100)) : 0;
  return (
    <div className="rounded-xl bg-bone/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <h3 className="text-base sm:text-sm font-semibold">{slot.label}</h3>
        <p className={cn('text-xs font-semibold', full ? 'text-bad' : 'text-ink-2')}>
          {slot.capacity === null ? `${slot.booked} booked` : `${slot.booked}/${slot.capacity} booked`}
          {full ? <span className="sr-only"> (full)</span> : null}
        </p>
      </div>
      {slot.capacity ? (
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className={cn('h-full rounded-full', full ? 'bg-bad' : 'bg-maroon')} style={{ width: `${share}%` }} />
        </div>
      ) : (
        <p className="mt-1 text-xs text-mute">This slot is no longer offered.</p>
      )}
      {slot.bookings.length === 0 ? (
        <p className="mt-2 text-xs text-mute">No bookings</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slot.bookings.map((entry) => {
            const released = entry.status === 'cancelled' || entry.status === 'lost';
            return (
              <li key={entry.id}>
                <Link
                  href={`/admin/bookings/${entry.id}/`}
                  className={cn(
                    'block rounded-lg border border-l-4 border-line bg-paper px-3 py-2 text-base sm:text-sm',
                    'transition-colors hover:bg-bone',
                    STATUS_ACCENT[entry.status],
                    released && 'opacity-60',
                  )}
                >
                  <span className="block truncate font-medium">{entry.customerName}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
                    {entry.pieces} {entry.pieces === 1 ? 'piece' : 'pieces'}
                    <StatusBadge status={entry.status} />
                  </span>
                  <span className="sr-only">{entry.reference}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DayBlock({ day, prefix }: { day: CalendarDay; prefix: string }) {
  const headingId = `${prefix}-day-${day.date}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'min-w-0 rounded-[var(--radius-card)] border bg-paper',
        day.isToday ? 'border-maroon' : 'border-line',
      )}
    >
      <h2
        id={headingId}
        className={
          'flex items-center justify-between gap-2 border-b border-line px-4 py-3 text-base ' +
          'sm:text-sm font-semibold'
        }
      >
        {day.label}
        {day.isToday ? <Badge tone="maroon">Today</Badge> : null}
      </h2>
      <div className="space-y-3 p-3">
        {day.slots.length === 0 ? (
          <p className="px-1 py-2 text-base sm:text-sm text-mute">No visit slots on this day.</p>
        ) : (
          day.slots.map((slot) => <SlotBlock key={slot.key} slot={slot} />)
        )}
      </div>
    </section>
  );
}

const navButton = buttonStyles({ variant: 'ghost', size: 'sm' });

/**
 * Day or week of visit slots, built from plain links so it works from the keyboard and without
 * script. Below a wide screen the days stack as a list.
 */
function CalendarPanel({ calendar, prefix }: { calendar: Calendar; prefix: string }) {
  const { view } = calendar;
  const unit = view === 'week' ? 'week' : 'day';
  const toggle = (target: View, label: string) => (
    <Link
      href={calendarHref(target, calendar.date)}
      aria-current={view === target ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 ' +
        'text-base sm:text-sm font-semibold',
        view === target ? 'bg-ink text-bone' : 'text-ink-2 hover:bg-bone-2',
      )}
    >
      {label}
    </Link>
  );
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Calendar dates" className="flex items-center gap-2">
          <Link href={calendarHref(view, calendar.prev)} className={navButton}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Previous {unit}</span>
          </Link>
          <Link href={calendarHref(view, calendar.today)} className={navButton}>
            Today
          </Link>
          <Link href={calendarHref(view, calendar.next)} className={navButton}>
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Next {unit}</span>
          </Link>
        </nav>
        <p className="order-last w-full font-display text-xl sm:order-none sm:w-auto" aria-live="polite">
          {calendar.title}
        </p>
        <nav
          aria-label="Calendar view"
          className="hidden rounded-full border border-line bg-paper p-1 md:inline-flex md:gap-2"
        >
          {toggle('day', 'Day')}
          {toggle('week', 'Week')}
        </nav>
      </div>
      <div
        className={cn(
          'grid gap-4',
          view === 'week' ? 'md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7' : 'max-w-2xl',
        )}
      >
        {calendar.days.map((day) => (
          <DayBlock key={day.date} day={day} prefix={prefix} />
        ))}
      </div>
    </div>
  );
}

export function CalendarView({ calendar, dayCalendar }: { calendar: Calendar; dayCalendar: Calendar }) {
  return (
    <>
      <div className="md:hidden">
        <CalendarPanel calendar={dayCalendar} prefix="agenda" />
      </div>
      <div className="hidden md:block">
        <CalendarPanel calendar={calendar} prefix="calendar" />
      </div>
    </>
  );
}
