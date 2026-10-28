'use client';

import type { DayAvailability } from '@/lib/bookings/api';
import { cn } from '@/lib/cn';

const places = (remaining: number) => `${remaining} ${remaining === 1 ? 'place' : 'places'} left`;

type SlotPickerProps = {
  /** The chosen day's availability, or undefined before a date is chosen. */
  day: DayAvailability | undefined;
  value: number | undefined;
  onChange: (slotId: number) => void;
};

/**
 * Time slots for the chosen day as a radio group: Tab reaches the group once,
 * the arrow keys move between slots, and full slots (remaining === 0) are
 * disabled but still announced with their "Full" label.
 */
export function SlotPicker({ day, value, onChange }: SlotPickerProps) {
  if (!day) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-mute">Choose a date to see the available times.</p>;
  }
  if (day.slots.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-mute">No times are open on this date. Please choose another day.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {day.slots.map((slot) => {
        const full = slot.remaining === 0;
        const selected = value === slot.slotId;
        return (
          <label
            key={slot.slotId}
            className={cn(
              'relative flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-maroon',
              selected ? 'border-maroon bg-maroon/5' : 'border-line bg-paper',
              full ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-ink/40',
            )}
          >
            <input type="radio" name="visit-slot" value={slot.slotId} checked={selected} disabled={full} onChange={() => onChange(slot.slotId)} className="sr-only" />
            <span className="flex items-center gap-3">
              <span aria-hidden className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border', selected ? 'border-maroon' : 'border-ink/30')}>
                {selected ? <span className="h-2.5 w-2.5 rounded-full bg-maroon" /> : null}
              </span>
              <span className="font-medium tabular-nums">{slot.label}</span>
            </span>
            <span className={cn('text-sm', full ? 'text-mute' : 'text-ink-2')}>{full ? 'Full' : places(slot.remaining)}</span>
          </label>
        );
      })}
    </div>
  );
}
