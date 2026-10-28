'use client';

import { useState } from 'react';
import type { DayAvailability } from '@/lib/bookings/api';
import { cn } from '@/lib/cn';
import { earliestAvailable } from './availability';
import { next14OpenDays, type VisitSelection } from './availability';
import { formatVisitDate } from './calendar';
import { DatePicker } from './date-picker';

type Props = {
  availability: DayAvailability[];
  value: string;
  onChange: (date: string) => void;
  onEarliest: (selection: VisitSelection) => void;
};

export function MobileDatePicker({ availability, value, onChange, onEarliest }: Props) {
  const [expanded, setExpanded] = useState(false);
  const earliest = earliestAvailable(availability);
  const days = next14OpenDays(availability);

  return (
    <div className="min-w-0 space-y-3 lg:hidden">
      <button
        type="button"
        disabled={!earliest}
        onClick={() => earliest && onEarliest(earliest)}
        className="min-h-11 rounded-full border border-maroon px-4 text-base font-medium text-maroon"
      >
        Earliest available
      </button>
      <div
        role="group"
        aria-label="Next 14 open days"
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-3"
      >
        {days.map((day) => {
          const remaining = day.slots.reduce((total, slot) => total + slot.remaining, 0);
          const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
          return (
            <button
              key={day.date}
              type="button"
              disabled={remaining === 0}
              aria-pressed={value === day.date}
              aria-label={`${formatVisitDate(day.date)}, ${remaining ? `${remaining} places left` : 'Full'}`}
              onClick={() => onChange(day.date)}
              className={cn(
                'flex h-16 w-14 shrink-0 snap-start flex-col items-center justify-center rounded-xl border',
                'text-xs leading-3 disabled:opacity-60',
                value === day.date ? 'border-maroon bg-maroon text-bone' : 'border-line bg-paper',
              )}
            >
              <span>{weekday.format(new Date(`${day.date}T00:00:00Z`))}</span>
              <span className="text-lg font-semibold leading-5">{Number(day.date.slice(8))}</span>
              <span className="text-xs leading-3">
                {remaining ? <>{remaining}<br />places left</> : 'Full'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-base text-mute">
        Scroll for more days. Full days have no places left. Closed days are omitted.
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="bv-mobile-calendar"
        onClick={() => setExpanded(!expanded)}
        className="min-h-11 rounded-full border border-line px-4 text-base"
      >
        Pick another date
      </button>
      <div id="bv-mobile-calendar" hidden={!expanded}>
        {expanded ? <DatePicker availability={availability} value={value} onChange={onChange} /> : null}
      </div>
    </div>
  );
}
