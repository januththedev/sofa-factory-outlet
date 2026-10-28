'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DayAvailability } from '@/lib/bookings/api';
import { cn } from '@/lib/cn';
import { addMonths, type CellState, cellState, clampDate, formatMonthLabel, formatVisitDate, monthOf, monthWeeks, moveDate, WEEKDAYS } from './calendar';

const STATE_NOTE: Record<CellState, string> = { open: '', full: ', fully booked', closed: ', closed', outside: ', not available' };

const navButton =
  'grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-35';

type DatePickerProps = {
  availability: DayAvailability[];
  /** The chosen date (YYYY-MM-DD) or ''. */
  value: string;
  onChange: (date: string) => void;
  describedBy?: string;
};

/**
 * Month calendar of the days the showroom offers. Only open days with a free
 * slot can be chosen. Keyboard: one tab stop (roving tabindex); arrow keys move
 * by day and week, Home/End to the week's ends, PageUp/PageDown by month,
 * Enter or Space to choose.
 */
export function DatePicker({ availability, value, onChange, describedBy }: DatePickerProps) {
  const instructionsId = useId();
  const monthId = useId();
  const byDate = useMemo(() => new Map(availability.map((day) => [day.date, day])), [availability]);
  const first = availability[0]?.date ?? '';
  const last = availability[availability.length - 1]?.date ?? '';
  const [focusedDate, setFocusedDate] = useState(() => (byDate.has(value) ? value : (availability.find((day) => cellState(day) === 'open')?.date ?? first)));
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const moveFocusNext = useRef(false);

  // The roving tab stop always stays inside the offered range, even after availability is refreshed.
  const focused = clampDate(focusedDate, first, last);
  const month = monthOf(focused);
  const weeks = useMemo(() => monthWeeks(month), [month]);

  // After a key press moves the focus to another day, put the real focus there once it has rendered.
  useEffect(() => {
    if (!moveFocusNext.current) return;
    moveFocusNext.current = false;
    buttons.current.get(focused)?.focus();
  }, [focused]);

  const choose = (date: string) => {
    if (cellState(byDate.get(date)) === 'open') onChange(date);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, date: string) => {
    const next = moveDate(date, event.key, first, last);
    if (!next) return;
    event.preventDefault();
    moveFocusNext.current = true;
    setFocusedDate(next);
  };

  const showMonth = (delta: number) => setFocusedDate(clampDate(addMonths(focused, delta), first, last));

  return (
    <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-bone/40 p-2 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => showMonth(-1)} disabled={monthOf(first) >= month} aria-label="Previous month" className={navButton}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p id={monthId} aria-live="polite" className="font-display text-lg">
          {formatMonthLabel(month)}
        </p>
        <button type="button" onClick={() => showMonth(1)} disabled={monthOf(last) <= month} aria-label="Next month" className={navButton}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p id={instructionsId} className="sr-only">
        Use the arrow keys to move between days and Enter to choose a day. Page up and page down change the month.
      </p>
      <table role="grid" aria-labelledby={monthId} aria-describedby={[instructionsId, describedBy].filter(Boolean).join(' ')} className="w-full table-fixed border-separate border-spacing-y-1">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday.short} scope="col" abbr={weekday.full} className="pb-1 text-center text-xs font-medium uppercase tracking-wider text-mute">
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((date, column) => {
                if (!date) return <td key={`blank-${column}`} />;
                const state = cellState(byDate.get(date));
                const selected = date === value;
                const inRange = date >= first && date <= last;
                return (
                  <td key={date} role="gridcell" aria-selected={selected} className="p-0.5 text-center">
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) buttons.current.set(date, node);
                        else buttons.current.delete(date);
                      }}
                      tabIndex={inRange && date === focused ? 0 : -1}
                      disabled={!inRange}
                      aria-disabled={inRange && state !== 'open' ? true : undefined}
                      aria-label={`${formatVisitDate(date)}${STATE_NOTE[state]}${selected ? ', selected' : ''}`}
                      onClick={() => choose(date)}
                      onFocus={() => setFocusedDate(date)}
                      onKeyDown={(event) => onKeyDown(event, date)}
                      className={cn(
                        'grid h-11 w-full place-items-center rounded-full text-sm tabular-nums transition-colors',
                        selected && 'bg-maroon font-semibold text-bone',
                        !selected && state === 'open' && 'text-ink hover:bg-clay-soft',
                        !selected && state === 'full' && 'cursor-not-allowed text-mute/70 line-through',
                        !selected && state === 'closed' && 'cursor-not-allowed text-mute/55',
                        !selected && state === 'outside' && 'cursor-not-allowed text-mute/30',
                      )}
                    >
                      {Number(date.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-mute">Crossed-out days are fully booked. Grey days are not open for visits.</p>
    </div>
  );
}
