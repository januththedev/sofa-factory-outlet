'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import type { SlotInput } from '@/lib/admin/settings';

type Row = { key: number; id?: number; weekday: number; start: string; end: string; capacity: string; active: boolean };

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
    <div>
      <input type="hidden" name="slots" value={JSON.stringify(payload)} />
      {rows.length === 0 ? (
        <p className="rounded-xl bg-bone-2 px-4 py-3 text-sm text-ink-2">
          No visit slots. Visitors cannot book a visit until you add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const problem = errors[`slots.${index}`];
            const label = `slot ${index + 1}`;
            return (
              <li key={row.key} className="rounded-xl border border-line p-3">
                <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1.3fr_1fr_1fr_5.5rem_auto_auto]">
                  <label className={cell}>
                    Day
                    <Select
                      aria-label={`Day for ${label}`}
                      value={row.weekday}
                      onChange={(event) => patch(row.key, { weekday: Number(event.target.value) })}
                    >
                      {WEEKDAY_ORDER.map((weekday) => (
                        <option key={weekday} value={weekday}>
                          {dayName(weekday)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className={cell}>
                    Starts
                    <Input
                      type="time"
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
                  <label className="flex items-center gap-2 pb-3 text-sm">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(event) => patch(row.key, { active: event.target.checked })}
                      className="size-4 accent-maroon"
                    />
                    Active
                  </label>
                  <Button
                    variant="subtle"
                    size="sm"
                    aria-label={`Remove ${label}`}
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remove
                  </Button>
                </div>
                {problem ? (
                  <p role="alert" className="mt-2 text-sm text-bad">
                    {problem}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {errors.slots ? (
        <p role="alert" className="mt-2 text-sm text-bad">
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
