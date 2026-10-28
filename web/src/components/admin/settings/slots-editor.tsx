'use client';

import { Plus } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import type { SlotInput } from '@/lib/admin/settings';

type Row = {
  key: number;
  id?: number;
  weekday: number;
  start: string;
  end: string;
  capacity: string;
  active: boolean;
};

// Monday first, the way the showroom thinks of its week; weekday numbers stay 0 = Sunday.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// 3 May 2026 was a Sunday, so day number n is n days later.
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
const dayName = (weekday: number) => dayFormat.format(new Date(Date.UTC(2026, 4, 3 + weekday)));

const cell = 'flex min-w-0 flex-col gap-1 text-xs text-mute';

/**
 * The visit-slot table. It keeps the rows in state and sends them as one JSON
 * field, which the server validates again (end after start, no overlaps on a day).
 */
export function SlotsEditor({
  initial,
  errors,
}: {
  initial: Required<SlotInput>[];
  errors: Record<string, string>;
}) {
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((slot, index) => ({ ...slot, key: index, capacity: String(slot.capacity) })),
  );

  const patch = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const add = () => {
    const last = rows[rows.length - 1];
    nextKey.current += 1;
    setRows((current) => [
      ...current,
      {
        key: nextKey.current,
        weekday: last?.weekday ?? 1,
        start: last?.end ?? '10:00',
        end: '',
        capacity: last?.capacity ?? '3',
        active: true,
      },
    ]);
  };

  const payload: SlotInput[] = rows.map((row) => ({
    ...(row.id === undefined ? {} : { id: row.id }),
    weekday: row.weekday,
    start: row.start,
    end: row.end,
    capacity: Number.isFinite(Number(row.capacity)) && row.capacity.trim() !== '' ? Number(row.capacity) : 0,
    active: row.active,
  }));

  return (
    <div id="f-slots" tabIndex={-1}>
      <input type="hidden" name="slots" value={JSON.stringify(payload)} />
      {rows.length === 0 ? (
        <p className="rounded-xl bg-bone-2 px-4 py-3 text-base sm:text-sm text-ink-2">
          No visit slots. Visitors cannot book a visit until you add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const problem = errors[`slots.${index}`];
            const label = `slot ${index + 1}`;
            return (
              <li key={row.key} className="rounded-xl border border-line p-3">
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                  <fieldset className="col-span-full min-w-0">
                    <legend className="mb-2 text-sm text-mute">Day for {label}</legend>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_ORDER.map((weekday) => (
                        <Button key={weekday} size="sm" variant={row.weekday === weekday ? 'primary' : 'ghost'}
                          aria-pressed={row.weekday === weekday}
                          aria-label={`${dayName(weekday)} for ${label}`}
                          onClick={() => patch(row.key, { weekday })}>
                          {dayName(weekday).slice(0, 3)}
                        </Button>
                      ))}
                    </div>
                  </fieldset>
                  <label className={cell}>
                    Starts
                    <Input
                      type="time"
                      id={`f-slots-${index}`}
                      aria-label={`Start time for ${label}`}
                      value={row.start}
                      onChange={(event) => patch(row.key, { start: event.target.value })}
                      aria-invalid={problem ? true : undefined}
                    />
                  </label>
                  <label className={cell}>
                    Ends
                    <Input
                      type="time"
                      aria-label={`End time for ${label}`}
                      value={row.end}
                      onChange={(event) => patch(row.key, { end: event.target.value })}
                      aria-invalid={problem ? true : undefined}
                    />
                  </label>
                  <label className={cell}>
                    Visits
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      inputMode="numeric"
                      aria-label={`How many visits fit in ${label}`}
                      value={row.capacity}
                      onChange={(event) => patch(row.key, { capacity: event.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2 pb-3 text-base sm:text-sm">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(event) => patch(row.key, { active: event.target.checked })}
                      className="size-11 accent-maroon"
                    />
                    Active
                  </label>
                  <Button
                    variant="subtle"
                    size="sm"
                    aria-label={`Remove ${label}`}
                    onClick={() => {
                      if (window.confirm('Remove this visit slot? Save changes to apply it.')) {
                        setRows((current) => current.filter((item) => item.key !== row.key));
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remove
                  </Button>
                </div>
                {problem ? (
                  <p role="status" aria-live="polite" className="mt-2 text-base sm:text-sm text-bad">
                    {problem}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {errors.slots ? (
        <p role="status" aria-live="polite" className="mt-2 text-base sm:text-sm text-bad">
          {errors.slots}
        </p>
      ) : null}
      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus className="size-4" aria-hidden />
          Add a slot
        </Button>
      </div>
    </div>
  );
}
