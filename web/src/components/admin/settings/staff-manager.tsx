'use client';

import { Check, Copy, X } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';
import { staffAction } from '@/app/admin/(panel)/settings/actions';
import type { StaffFormState } from '@/app/admin/(panel)/settings/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { FormStatus, SectionTitle } from './form-kit';

export type StaffRowView = {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  active: boolean;
  lastLoginLabel: string;
};

type Dispatch = (data: FormData) => void;

function TempPassword({ password, onDone }: { password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="group" aria-label="Temporary password" className="rounded-xl border border-warn/40 bg-warn/10 p-4">
      <p className="text-sm font-semibold">Temporary password, shown once</p>
      <p className="mt-1 text-sm text-ink-2">
        Copy it now and send it to them privately. It is not stored in readable form, so it cannot be shown again; you
        can set a new one at any time.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-paper px-3 py-2 font-mono text-base tracking-wider">{password}</code>
        <Button size="sm" variant="ghost" onClick={() => void copy()}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="subtle" onClick={onDone}>
          <X className="size-4" aria-hidden />
          Hide it
        </Button>
      </div>
    </div>
  );
}

const resetWarning = (name: string) =>
  `Set a new temporary password for ${name}? Their old password stops working.`;

function RowActions({ member, isSelf, dispatch }: { member: StaffRowView; isSelf: boolean; dispatch: Dispatch }) {
  const send = (event: React.FormEvent<HTMLFormElement>, confirmText?: string) => {
    event.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form onSubmit={(event) => send(event)} className="flex items-end gap-2">
        <input type="hidden" name="intent" value="role" />
        <input type="hidden" name="id" value={member.id} />
        <label className="text-xs text-mute">
          Role
          <Select name="role" defaultValue={member.role} aria-label={`Role for ${member.name}`} className="mt-1 py-2">
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </Select>
        </label>
        <Button type="submit" size="sm" variant="subtle">
          Change role
        </Button>
      </form>
      <form onSubmit={(event) => send(event, resetWarning(member.name))}>
        <input type="hidden" name="intent" value="reset" />
        <input type="hidden" name="id" value={member.id} />
        <Button type="submit" size="sm" variant="ghost">
          Reset password
        </Button>
      </form>
      <form onSubmit={(event) => send(event)}>
        <input type="hidden" name="intent" value="active" />
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="active" value={member.active ? 'false' : 'true'} />
        <Button
          type="submit"
          size="sm"
          variant={member.active ? 'ghost' : 'primary'}
          disabled={member.active && isSelf}
          title={member.active && isSelf ? 'You cannot deactivate your own account' : undefined}
        >
          {member.active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </form>
    </div>
  );
}

export function StaffManager({ members, currentUserId }: { members: StaffRowView[]; currentUserId: number }) {
  const [state, dispatch, pending] = useActionState<StaffFormState, FormData>(staffAction, null);
  const [hiddenAt, setHiddenAt] = useState(0);
  const send: Dispatch = (data) => dispatch(data);
  const created = state?.ok && state.intent === 'create' ? state.at : 0;
  const password = state?.tempPassword && state.at !== hiddenAt ? state.tempPassword : null;
  const nameError = state?.errors.name;
  const emailError = state?.errors.email;

  return (
    <div className="space-y-6">
      <FormStatus state={state} pending={pending} />
      {password ? <TempPassword password={password} onDone={() => setHiddenAt(state?.at ?? 0)} /> : null}

      <section className="rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6">
        <SectionTitle title="Staff accounts">
          Staff can handle bookings, products, chat and invoices. Only owners can open Settings or change accounts.
        </SectionTitle>
        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li key={member.id} className="space-y-3 py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-semibold">{member.name}</p>
                {member.id === currentUserId ? <Badge tone="neutral">You</Badge> : null}
                <Badge tone={member.role === 'owner' ? 'maroon' : 'neutral'}>
                  {member.role === 'owner' ? 'Owner' : 'Staff'}
                </Badge>
                <Badge tone={member.active ? 'good' : 'bad'}>{member.active ? 'Active' : 'Deactivated'}</Badge>
              </div>
              <p className="text-sm text-mute">
                {member.email} · Last signed in: {member.lastLoginLabel}
              </p>
              <RowActions member={member} isSelf={member.id === currentUserId} dispatch={send} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6">
        <SectionTitle title="Add an account">
          A temporary password is made for the new account and shown once, right after you add it.
        </SectionTitle>
        <form
          key={created}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(() => dispatch(data));
          }}
          className="grid gap-4 md:grid-cols-[1fr_1fr_10rem_auto] md:items-start"
        >
          <input type="hidden" name="intent" value="create" />
          <div>
            <label htmlFor="staff-name" className="mb-1.5 block text-sm font-medium text-ink-2">
              Name
            </label>
            <Input id="staff-name" name="name" autoComplete="off" aria-invalid={nameError ? true : undefined} />
            {nameError ? (
              <p role="alert" className="mt-1.5 text-sm text-bad">
                {nameError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="staff-email" className="mb-1.5 block text-sm font-medium text-ink-2">
              Email
            </label>
            <Input
              id="staff-email"
              name="email"
              type="email"
              autoComplete="off"
              aria-invalid={emailError ? true : undefined}
            />
            {emailError ? (
              <p role="alert" className="mt-1.5 text-sm text-bad">
                {emailError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="staff-role" className="mb-1.5 block text-sm font-medium text-ink-2">
              Role
            </label>
            <Select id="staff-role" name="role" defaultValue="staff">
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </Select>
          </div>
          <div className="md:pt-7">
            <Button type="submit" disabled={pending}>
              Add account
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
