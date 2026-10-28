'use client';

import { useId, useState, useTransition } from 'react';
import {
  createRedirectAction,
  deleteRedirectAction,
  type RedirectFormState,
  updateRedirectAction,
} from '@/app/admin/(panel)/seo/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { TD, TR } from '@/components/ui/table';
import type { RedirectRow as RedirectData } from '@/lib/admin/seo';

const IDLE: RedirectFormState = { status: 'idle' };

const REASON_LABEL: Record<RedirectData['reason'], string> = {
  'hidden-product': 'Hidden product',
  'slug-change': 'Address changed',
  deleted: 'Deleted',
  manual: 'Added by hand',
};

function fieldError(state: RedirectFormState, field: 'from' | 'to' | 'status'): string | undefined {
  return state.status === 'error' ? state.fieldErrors[field] : undefined;
}

type FormFieldsProps = {
  idPrefix: string;
  state: RedirectFormState;
  initial: { from: string; to: string; status: 301 | 410 };
};

/** The three fields shared by the add form and the edit form. */
function RedirectFields({ idPrefix, state, initial }: FormFieldsProps) {
  const [status, setStatus] = useState<string>(String(initial.status));
  const gone = status === '410';
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_9rem_1fr]">
      <Field label="Old address" htmlFor={`${idPrefix}-from`} error={fieldError(state, 'from')}>
        <Input
          id={`${idPrefix}-from`}
          name="from"
          defaultValue={initial.from}
          placeholder="/old-page/"
          autoComplete="off"
          aria-invalid={fieldError(state, 'from') ? true : undefined}
          required
        />
      </Field>
      <Field label="What happens" htmlFor={`${idPrefix}-status`} error={fieldError(state, 'status')}>
        <Select
          id={`${idPrefix}-status`}
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="301">301 moved</option>
          <option value="410">410 gone</option>
        </Select>
      </Field>
      <Field
        label="New address"
        htmlFor={`${idPrefix}-to`}
        hint={gone ? 'Not needed: visitors and Google are told the page is gone.' : undefined}
        error={fieldError(state, 'to')}
      >
        <Input
          id={`${idPrefix}-to`}
          name="to"
          defaultValue={initial.to}
          placeholder="/shop/"
          autoComplete="off"
          disabled={gone}
          aria-invalid={fieldError(state, 'to') ? true : undefined}
        />
      </Field>
    </div>
  );
}

function FormMessage({ state }: { state: RedirectFormState }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={state.status === 'error' ? 'text-sm text-bad' : 'text-sm text-good'}
    >
      {state.status === 'idle' ? '' : state.message}
    </p>
  );
}

export function RedirectAddForm() {
  const id = useId();
  const [state, setState] = useState<RedirectFormState>(IDLE);
  const [pending, startTransition] = useTransition();
  // A new key after each save gives the fields back their empty values.
  const [round, setRound] = useState(0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createRedirectAction(data);
      setState(result);
      if (result.status === 'saved') setRound((value) => value + 1);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <RedirectFields key={round} idPrefix={`${id}-add`} state={state} initial={{ from: '', to: '', status: 301 }} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add redirect'}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function RedirectEditForm({ redirect, onDone }: { redirect: RedirectData; onDone: () => void }) {
  const id = useId();
  const [state, setState] = useState<RedirectFormState>(IDLE);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateRedirectAction(data);
      setState(result);
      if (result.status === 'saved') onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={redirect.id} />
      <RedirectFields
        idPrefix={`${id}-edit`}
        state={state}
        initial={{ from: redirect.from, to: redirect.to ?? '', status: redirect.status }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function RedirectRow({ redirect, canDelete }: { redirect: RedirectData; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Delete the redirect from ${redirect.from}? Visitors to that address will get a 404.`)) return;
    const data = new FormData();
    data.set('id', String(redirect.id));
    startTransition(async () => {
      await deleteRedirectAction(data);
    });
  }

  return (
    <>
      <TR>
        <TD className="max-w-[18rem] break-all font-medium">{redirect.from}</TD>
        <TD className="max-w-[18rem] break-all">{redirect.to ?? <span className="text-mute">Gone (no page)</span>}</TD>
        <TD>
          <Badge tone={redirect.status === 301 ? 'neutral' : 'warn'}>{redirect.status}</Badge>
        </TD>
        <TD className="text-mute">{REASON_LABEL[redirect.reason]}</TD>
        <TD className="text-right tabular-nums">{redirect.hits}</TD>
        <TD>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={editing}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? 'Close' : 'Edit'}
            </Button>
            {canDelete ? (
              <Button size="sm" variant="danger" onClick={remove} disabled={pending}>
                Delete
              </Button>
            ) : null}
          </div>
        </TD>
      </TR>
      {editing ? (
        <TR className="bg-bone/60 hover:bg-bone/60">
          <TD colSpan={6}>
            <RedirectEditForm redirect={redirect} onDone={() => setEditing(false)} />
          </TD>
        </TR>
      ) : null}
    </>
  );
}
