'use client';

import { unstable_rethrow } from 'next/navigation';
import { Check } from 'lucide-react';
import { Copy } from 'lucide-react';
import { X } from 'lucide-react';
import { startTransition } from 'react';
import { useActionState } from 'react';
import { useState } from 'react';
import { staffAction } from '@/app/admin/(panel)/settings/actions';
import type { StaffFormState } from '@/app/admin/(panel)/settings/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { roleLabel } from '@/lib/auth/roles';
import { Select } from '@/components/ui/field';
import { FormStatus } from './form-kit';
import { SectionTitle } from './form-kit';

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
      <p className="text-base sm:text-sm font-semibold">Temporary password, shown once</p>
      <p className="mt-1 text-base sm:text-sm text-ink-2">
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

function RowActions({ member, isSelf, dispatch, pending }: {
  member: StaffRowView;
  isSelf: boolean;
  dispatch: Dispatch;
  pending: boolean;
}) {
  const send = (event: React.FormEvent<HTMLFormElement>, confirmText?: string) => {
    event.preventDefault();
    if (pending) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form onSubmit={(event) => send(event)} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="role" />
        <input type="hidden" name="id" value={member.id} />
        <label className="text-xs text-mute">
          Role
          <Select name="role" defaultValue={member.role} aria-label={`Role for ${member.name}`} className="mt-1 py-2">
            <option value="staff">Admin</option>
            <option value="owner">Super admin</option>
          </Select>
        </label>
        <Button type="submit" size="sm" variant="subtle" disabled={pending}>
          Change role
        </Button>
      </form>
      <form onSubmit={(event) => send(event, resetWarning(member.name))}>
        <input type="hidden" name="intent" value="reset" />
        <input type="hidden" name="id" value={member.id} />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          Reset password
        </Button>
      </form>
      <form onSubmit={(event) => send(event, member.active
        ? `Disable ${member.name}? They will no longer be able to sign in.`
        : undefined)}>
        <input type="hidden" name="intent" value="active" />
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="active" value={member.active ? 'false' : 'true'} />
        <Button
          type="submit"
          size="sm"
          variant={member.active ? 'ghost' : 'primary'}
          disabled={pending || (member.active && isSelf)}
          title={member.active && isSelf ? 'You cannot deactivate your own account' : undefined}
        >
          {member.active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </form>
    </div>
  );
}

export function StaffManager({ members, currentUserId }: { members: StaffRowView[]; currentUserId: number }) {
  const [state, dispatch, pending] = useActionState<StaffFormState, FormData>(async (previous, data) => {
    try {
      return await staffAction(previous, data);
    } catch (error) {
      unstable_rethrow(error);
      return {
        ok: false,
        message: 'This account could not be updated. Please try again.',
        errors: {},
        at: Date.now(),
      };
    }
  }, null);
  const [hiddenAt, setHiddenAt] = useState(0);
  const send: Dispatch = (data) => dispatch(data);
  const created = state?.ok && state.intent === 'create' ? state.at : 0;
  const password = state?.tempPassword && state.at !== hiddenAt ? state.tempPassword : null;
  const nameError = state?.errors.name;
  const emailError = state?.errors.email;

  return (
    <div className="min-w-0 space-y-6 pb-28">
      {password ? <TempPassword password={password} onDone={() => setHiddenAt(state?.at ?? 0)} /> : null}

      <section className="rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6">
        <SectionTitle title="Admins">
          Admins can handle bookings, products, chat and invoices. Only super admins can open Settings or add, change or remove admins.
        </SectionTitle>
        <ul className="grid gap-4">
          {members.map((member) => (
            <li key={member.id} className="min-w-0 space-y-3 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-semibold">{member.name}</p>
                {member.id === currentUserId ? <Badge tone="neutral">You</Badge> : null}
                <Badge tone={member.role === 'owner' ? 'maroon' : 'neutral'}>
                  {roleLabel(member.role)}
                </Badge>
                <Badge tone={member.active ? 'good' : 'bad'}>{member.active ? 'Active' : 'Deactivated'}</Badge>
              </div>
              <p className="text-base sm:text-sm text-mute">
                {member.email} · Last signed in: {member.lastLoginLabel}
              </p>
              <RowActions member={member} isSelf={member.id === currentUserId} dispatch={send} pending={pending} />
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
    if (pending) return;
            const data = new FormData(event.currentTarget);
            startTransition(() => dispatch(data));
          }}
          className="grid gap-4 xl:grid-cols-[1fr_1fr_10rem_auto] md:items-start"
        >
          <input type="hidden" name="intent" value="create" />
          <div>
            <label htmlFor="staff-name" className="mb-1.5 block text-base sm:text-sm font-medium text-ink-2">
              Name
            </label>
            <Input id="staff-name" name="name" autoComplete="off" aria-invalid={nameError ? true : undefined} />
            {nameError ? (
              <p role="status" aria-live="polite" className="mt-1.5 text-base sm:text-sm text-bad">
                {nameError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="staff-email" className="mb-1.5 block text-base sm:text-sm font-medium text-ink-2">
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
              <p role="status" aria-live="polite" className="mt-1.5 text-base sm:text-sm text-bad">
                {emailError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="staff-role" className="mb-1.5 block text-base sm:text-sm font-medium text-ink-2">
              Role
            </label>
            <Select id="staff-role" name="role" defaultValue="staff">
              <option value="staff">Admin</option>
              <option value="owner">Super admin</option>
            </Select>
          </div>
          <div data-sticky-bar className={
            'sticky bottom-0 z-20 col-span-full border-t border-line bg-paper p-3 '
            + 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          }>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add account'}
            </Button>
            <FormStatus state={state} pending={pending} />
          </div>
        </form>
      </section>
    </div>
  );
}
