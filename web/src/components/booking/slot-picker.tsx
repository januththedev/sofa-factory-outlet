'use client';

import type { DayAvailability } from '@/lib/bookings/api';
import { cn } from '@/lib/cn';

type SlotPickerProps = {
  day: DayAvailability | undefined;
  value: number | undefined;
  onChange: (slotId: number) => void;
  onBlur?: () => void;
};

/** Real radios preserve keyboard selection and the desktop booking helpers' label-click behaviour. */
export function SlotPicker({ day, value, onChange, onBlur }: SlotPickerProps) {
  if (!day) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4">Choose a date to see the available times.</p>
    );
  }
  if (!day.open || day.slots.length === 0) {
    return <p className="rounded-xl border border-dashed border-line p-4">This day is closed. Choose another date.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {day.slots.map((slot) => {
        const full = slot.remaining <= 0;
        const selected = value === slot.slotId;
        return (
          <label
            key={slot.slotId}
            className={cn(
              'relative flex min-h-12 min-w-0 flex-col justify-center rounded-xl border px-3 py-3',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              selected ? 'border-maroon bg-maroon/5' : 'border-line bg-paper',
              full ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            )}
          >
            <input
              type="radio"
              name="visit-slot"
              value={slot.slotId}
              checked={selected}
              disabled={full}
              onChange={() => onChange(slot.slotId)}
              onBlur={onBlur}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span className="text-base font-medium tabular-nums">{slot.label}</span>
            <span className="text-sm text-ink-2">
              {full ? 'Full — no places left' : `${slot.remaining} places left`}
            </span>
          </label>
        );
      })}
    </div>
  );
}
