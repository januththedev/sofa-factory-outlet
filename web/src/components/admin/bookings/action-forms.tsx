'use client';

import { useActionState } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import type { RescheduleDay } from '@/lib/admin/bookings';
import type { ActionState } from './types';
import type { BoundAction } from './types';
import type { PlainAction } from './types';

/** The result of the last action: an error to fix, or a short confirmation. */
function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      <FieldError>{state?.error}</FieldError>
      {state?.message ? (
        <p role="status" className="mt-1.5 text-base sm:text-sm text-good">
          {state.message}
        </p>
      ) : null}
    </>
  );
}

export function StatusForm({
  action,
  options,
}: {
  action: BoundAction;
  options: Array<{ value: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (options.length === 0) {
    return <p className="text-base sm:text-sm text-mute">This status is final, so it cannot change again.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="booking-status">Change status</Label>
        <Select id="booking-status" name="status" defaultValue={options[0].value}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-base sm:text-sm text-mute">
          Lost and cancelled bookings cannot be reopened, and they free their slot.
        </p>
      </div>
      <Button type="submit" size="sm" variant="subtle" disabled={pending}>
        {pending ? 'Saving…' : 'Update status'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** One tap: sets the status to Visited. */
export function VisitedForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="status" value="visited" />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Mark as visited'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function NotesForm({ action, initial }: { action: BoundAction; initial: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [notes, setNotes] = useState(initial);
  return (
    <form action={formAction} className="space-y-3">
      <Label htmlFor="staff-notes">
        Staff notes
      </Label>
      <Textarea
        id="staff-notes"
        name="notes"
        inputMode="text"
        autoComplete="off"
        enterKeyHint="enter"
        rows={6}
        maxLength={4000}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        className="scroll-mt-20 scroll-mb-56"
        placeholder="Calls made, what they liked, anything to remember for the visit"
        aria-invalid={Boolean(state?.error)}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save notes'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function RescheduleForm({ action, days }: { action: BoundAction; days: RescheduleDay[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [chosen, setChosen] = useState('');
  if (days.length === 0) {
    return <p className="text-base sm:text-sm text-mute">No date in the booking window has a free place right now.</p>;
  }
  const day = days.find((candidate) => candidate.date === chosen) ?? days[0];
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="reschedule-date">New date</Label>
        <Select id="reschedule-date" name="date" value={day.date} onChange={(event) => setChosen(event.target.value)}>
          {days.map((candidate) => (
            <option key={candidate.date} value={candidate.date}>
              {candidate.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="reschedule-slot">Time slot</Label>
        {/* Keyed by the date so the slot list starts again from its first choice. */}
        <Select key={day.date} id="reschedule-slot" name="slotId" defaultValue={String(day.slots[0].slotId)}>
          {day.slots.map((slot) => (
            <option key={slot.slotId} value={slot.slotId}>
              {slot.label} ({slot.remaining} {slot.remaining === 1 ? 'place' : 'places'} left)
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-base sm:text-sm text-mute">Only open days with a free place are listed.</p>
      </div>
      <Button type="submit" size="sm" variant="subtle" disabled={pending}>
        {pending ? 'Moving…' : 'Move booking'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Makes the invoice from the booking, then the action sends staff to it. */
export function ConvertForm({ action }: { action: PlainAction }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction}>
      <Button type="submit" variant="dark" className="w-full" disabled={pending}>
        {pending ? 'Creating the invoice…' : 'Convert to invoice'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
