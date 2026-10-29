'use client';
import { startTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { saveLead, startQuotation } from '@/app/admin/(panel)/leads/actions';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { LEAD_STAGES, STAGE_LABELS } from '@/lib/leads/schema';
import type { LeadStage } from '@/lib/db/schema/leads';

export function LeadEditor({
  lead,
  staff,
}: {
  lead: {
    id: number;
    stage: LeadStage;
    assigneeId: number | null;
    followUp: string;
    lostReason: string | null;
    priority: boolean;
  };
  staff: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveLead, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-5"
    >
      <input type="hidden" name="id" value={lead.id} />
      {state ? (
        <p
          role={state.ok ? 'status' : 'alert'}
          className={state.ok ? 'text-good' : 'text-bad'}
        >
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Stage" htmlFor="lead-stage">
          <Select id="lead-stage" name="stage" defaultValue={lead.stage}>
            {LEAD_STAGES.map((stage) => (
              <option value={stage} key={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assigned salesperson" htmlFor="lead-assignee">
          <Select
            id="lead-assignee"
            name="assigneeId"
            defaultValue={lead.assigneeId ?? ''}
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next follow-up (Colombo time)" htmlFor="lead-follow">
          <Input
            id="lead-follow"
            name="followUp"
            type="datetime-local"
            defaultValue={lead.followUp}
          />
        </Field>
        <Field label="Lost reason (required if lost)" htmlFor="lead-lost">
          <Input
            id="lead-lost"
            name="lostReason"
            maxLength={300}
            defaultValue={lead.lostReason ?? ''}
          />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="priority"
          defaultChecked={lead.priority}
          className="size-5"
        />
        Priority lead
      </label>
      <Field label="Activity note" htmlFor="lead-note">
        <Textarea
          id="lead-note"
          name="note"
          maxLength={2000}
          placeholder="Contact outcome, agreed next step, or customer feedback"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save lead'}
      </Button>
    </form>
  );
}
function QuoteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Opening…' : 'Prepare quotation'}
    </Button>
  );
}
export function LeadQuoteButton({ id }: { id: number }) {
  return (
    <form action={startQuotation}>
      <input type="hidden" name="id" value={id} />
      <QuoteSubmit />
    </form>
  );
}
