'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DayAvailability } from '@/lib/bookings/api';
import { cn } from '@/lib/cn';
import {
  addMonths,
  type CellState,
  cellState,
  clampDate,
  formatMonthLabel,
  formatVisitDate,
  monthOf,
  monthWeeks,
  moveDate,
  WEEKDAYS,
} from './calendar';

const STATE_NOTE: Record<CellState, string> = {
  open: '',
  full: ', fully booked',
  closed: ', closed',
  outside: ', not available',
};
const navButton = [
  'grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink',
  'disabled:opacity-35',
].join(' ');

type DatePickerProps = {
  availability: DayAvailability[];
  value: string;
  onChange: (date: string) => void;
  describedBy?: string;
};

/** Monday-first calendar, with one roving tab stop and keyboard movement inside the offered dates. */
export function DatePicker({ availability, value, onChange, describedBy }: DatePickerProps) {
  const instructionsId = useId();
  const monthId = useId();
  const byDate = useMemo(() => new Map(availability.map((day) => [day.date, day])), [availability]);
  const first = availability[0]?.date ?? '';
  const last = availability[availability.length - 1]?.date ?? '';
  const [navigation, setNavigation] = useState(() => ({
    date: byDate.has(value) ? value : (availability.find((day) => cellState(day) === 'open')?.date ?? first),
    selection: value,
  }));
  const focusedDate = navigation.selection !== value && byDate.has(value) ? value : navigation.date;
  const setFocusedDate = (date: string) => setNavigation({ date, selection: value });
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const moveFocusNext = useRef(false);
  const focused = clampDate(focusedDate, first, last);
  const month = monthOf(focused);
  const weeks = useMemo(() => month ? monthWeeks(month) : [], [month]);

  useEffect(() => {
    if (!moveFocusNext.current) return;
    moveFocusNext.current = false;
    buttons.current.get(focused)?.focus();
  }, [focused]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, date: string) => {
    const next = moveDate(date, event.key, first, last);
    if (!next) return;
    event.preventDefault();
    moveFocusNext.current = true;
    setFocusedDate(next);
  };
  const showMonth = (delta: number) => setFocusedDate(clampDate(addMonths(focused, delta), first, last));

  if (!month) return <p>No dates are available. Please try again later.</p>;

  return (
    <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-bone/40 p-2 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => showMonth(-1)}
          disabled={monthOf(first) >= month}
          aria-label="Previous month"
          className={navButton}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p id={monthId} aria-live="polite" className="font-display text-lg">{formatMonthLabel(month)}</p>
        <button
          type="button"
          onClick={() => showMonth(1)}
          disabled={monthOf(last) <= month}
          aria-label="Next month"
          className={navButton}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <p id={instructionsId} className="mb-3 text-xs text-mute">
        Scroll across on small screens. Arrow keys move between days; Enter chooses a day.
      </p>
      <div className="overflow-x-auto pb-2">
        <table
          role="grid"
          aria-labelledby={monthId}
          aria-describedby={[instructionsId, describedBy].filter(Boolean).join(' ')}
          className="w-full min-w-[22.75rem] table-fixed border-separate border-spacing-2"
        >
          <thead>
            <tr>
              {WEEKDAYS.map((weekday) => (
                <th key={weekday.short} scope="col" abbr={weekday.full} className="text-xs font-medium text-mute">
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
                    <td key={date} role="gridcell" aria-selected={selected} className="p-0 text-center">
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
                        onClick={() => {
                          if (state === 'open') onChange(date);
                        }}
                        onFocus={() => setFocusedDate(date)}
                        onKeyDown={(event) => onKeyDown(event, date)}
                        className={cn(
                          'flex min-h-11 min-w-11 w-full flex-col items-center justify-center rounded-full',
                          'text-sm tabular-nums',
                          selected && 'bg-maroon font-semibold text-bone',
                          !selected && state === 'open' && 'text-ink hover:bg-clay-soft',
                          !selected && state === 'full' && 'text-mute line-through',
                          !selected && state === 'closed' && 'text-mute',
                          !selected && state === 'outside' && 'text-mute/60',
                        )}
                      >
                        <span>{Number(date.slice(8))}</span>
                        {state !== 'open' ? (
                          <span aria-hidden className="text-xs leading-4">
                            {state === 'full' ? 'Full' : state === 'closed' ? 'Closed' : '—'}
                          </span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-base text-mute">
        Crossed-out days are fully booked. Closed and unavailable days cannot be selected.
      </p>
    </div>
  );
}
