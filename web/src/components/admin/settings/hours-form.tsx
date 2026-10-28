'use client';

import { useState } from 'react';
import { saveHoursAction } from '@/app/admin/(panel)/settings/actions';
import { Input } from '@/components/ui/field';
import type { SlotInput } from '@/lib/admin/settings';
import { DAY_KEYS } from '@/lib/settings/hours';
import type { BookingSettings, DayKey, HoursSettings } from '@/lib/settings/types';
import { AreaField, ConfirmedField, FormCard, SaveBar, SectionTitle, TextField, useSettingsForm } from './form-kit';
import { SlotsEditor } from './slots-editor';

const DAY_NAMES: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

type DayRowProps = { day: DayKey; hours: HoursSettings['days'][DayKey]; errors: Record<string, string> };

function DayRow({ day, hours, errors }: DayRowProps) {
  const [closed, setClosed] = useState(hours === null);
  const base = `hours.days.${day}`;
  const problem = errors[`${base}.open`] ?? errors[`${base}.close`];
  return (
    <li className="py-3">
      <div className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-3 sm:grid-cols-[8rem_auto_1fr_1fr]">
        <span className="font-medium">{DAY_NAMES[day]}</span>
        <label className="order-last col-span-3 flex items-center gap-2 text-sm sm:order-none sm:col-span-1">
          <input
            type="checkbox"
            name={`${base}.closed`}
            checked={closed}
            onChange={(event) => setClosed(event.target.checked)}
            className="size-4 accent-maroon"
          />
          Closed
          <span className="sr-only"> on {DAY_NAMES[day]}</span>
        </label>
        <Input
          type="time"
          name={`${base}.open`}
          aria-label={`${DAY_NAMES[day]} opens`}
          defaultValue={hours?.open ?? '10:00'}
          disabled={closed}
          aria-invalid={problem ? true : undefined}
        />
        <Input
          type="time"
          name={`${base}.close`}
          aria-label={`${DAY_NAMES[day]} closes`}
          defaultValue={hours?.close ?? '18:00'}
          disabled={closed}
          aria-invalid={problem ? true : undefined}
        />
      </div>
      {problem ? (
        <p role="alert" className="mt-1.5 text-sm text-bad">
          {DAY_NAMES[day]}: {problem}
        </p>
      ) : null}
    </li>
  );
}

export function HoursForm({
  hours,
  booking,
  slots,
}: {
  hours: HoursSettings;
  booking: BookingSettings;
  slots: Required<SlotInput>[];
}) {
  const { state, pending, onSubmit, error } = useSettingsForm(saveHoursAction);
  return (
    <FormCard onSubmit={onSubmit} aria-label="Opening hours and visit slots">
      <section className="space-y-4">
        <SectionTitle title="Opening hours" confirmed={hours.confirmed}>
          Shown on the Visit page and in search listings once confirmed. Times are Sri Lanka time.
        </SectionTitle>
        <ul className="divide-y divide-line">
          {DAY_KEYS.map((day) => (
            <DayRow key={day} day={day} hours={hours.days[day]} errors={state?.errors ?? {}} />
          ))}
        </ul>
        <AreaField
          name="hours.closedDates"
          label="Closed dates"
          defaultValue={hours.closedDates.join('\n')}
          error={error('hours.closedDates')}
          rows={3}
          hint="One date per line, written YYYY-MM-DD, for holidays and other days the showroom is shut."
        />
        <TextField
          name="hours.note"
          label="Note about hours"
          defaultValue={hours.note ?? ''}
          error={error('hours.note')}
          hint="Optional, for example: closed on poya days."
        />
        <ConfirmedField name="hours.confirmed" defaultChecked={hours.confirmed} error={error('hours.confirmed')} />
      </section>

      <section className="space-y-4">
        <SectionTitle title="Booking rules" confirmed={booking.confirmed}>
          How far ahead a visit can be booked.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="booking.leadDays"
            label="Notice needed (days)"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={String(booking.leadDays)}
            error={error('booking.leadDays')}
            hint="0 allows a visit today."
          />
          <TextField
            name="booking.horizonDays"
            label="How far ahead (days)"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={String(booking.horizonDays)}
            error={error('booking.horizonDays')}
          />
        </div>
        <ConfirmedField
          name="booking.confirmed"
          defaultChecked={booking.confirmed}
          error={error('booking.confirmed')}
        />
      </section>

      <section>
        <SectionTitle title="Visit slots">
          Each slot is a time visitors can pick, with how many visits fit. Slots on the same day cannot overlap.
          A slot that already has bookings is switched off instead of deleted.
        </SectionTitle>
        <SlotsEditor key={JSON.stringify(slots)} initial={slots} errors={state?.errors ?? {}} />
      </section>

      <SaveBar state={state} pending={pending} />
    </FormCard>
  );
}
