'use client';

import { startTransition, useActionState } from 'react';
import type { SettingsFormState } from '@/app/admin/(panel)/settings/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/cn';

// Shared pieces of the Settings forms. Each form submits through onSubmit rather
// than <form action>, because React clears a form's fields after an action: a
// rejected save would otherwise wipe what the owner had typed.

type FormResult = { ok: boolean; message: string; errors: Record<string, string>; at: number } | null;

const clock = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Colombo' });
const savedAt = (at: number) => clock.format(new Date(at));

type SettingsAction = (previous: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function useSettingsForm(action: SettingsAction) {
  const [state, dispatch, pending] = useActionState<SettingsFormState, FormData>(action, null);
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit, error: (name: string): string | undefined => state?.errors[name] };
}

/** The save result as live text. Always rendered, so the live region exists before it fills. */
export function FormStatus({ state, pending }: { state: FormResult; pending: boolean }) {
  let text = '';
  if (pending) text = 'Saving…';
  else if (state) text = state.ok ? `${state.message} (${savedAt(state.at)})` : state.message;
  const failed = Boolean(state && !state.ok && !pending);
  return (
    <p role="status" aria-live="polite" className={cn('min-h-5 text-sm', failed ? 'text-bad' : 'text-good')}>
      {text}
    </p>
  );
}

type SaveBarProps = { state: FormResult; pending: boolean; label?: string };

export function SaveBar({ state, pending, label = 'Save changes' }: SaveBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : label}
      </Button>
      <FormStatus state={state} pending={pending} />
    </div>
  );
}

export function PlaceholderBadge() {
  return <Badge tone="warn">Placeholder from the old site</Badge>;
}

/** A section heading with the amber badge while its details are unconfirmed. */
type SectionTitleProps = { title: string; confirmed?: boolean; children?: React.ReactNode };

export function SectionTitle({ title, confirmed, children }: SectionTitleProps) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        {confirmed === false ? <PlaceholderBadge /> : null}
      </div>
      {children ? <p className="mt-1 max-w-2xl text-sm text-mute">{children}</p> : null}
    </div>
  );
}

type FieldShell = { name: string; label: string; hint?: string; error?: string; className?: string };

const idOf = (name: string) => `f-${name.replaceAll('.', '-')}`;

function Shell({ name, label, hint, error, className, children }: FieldShell & { children: React.ReactNode }) {
  const id = idOf(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-mute">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = ({ name, hint, error }: Pick<FieldShell, 'name' | 'hint' | 'error'>) =>
  [hint ? `${idOf(name)}-hint` : null, error ? `${idOf(name)}-error` : null].filter(Boolean).join(' ') || undefined;

type TextFieldProps = FieldShell &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'className' | 'id'>;

export function TextField({ name, label, hint, error, className, ...input }: TextFieldProps) {
  return (
    <Shell name={name} label={label} hint={hint} error={error} className={className}>
      <Input
        id={idOf(name)}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ name, hint, error })}
        {...input}
      />
    </Shell>
  );
}

type AreaProps = FieldShell & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'className' | 'id'>;

export function AreaField({ name, label, hint, error, className, ...area }: AreaProps) {
  return (
    <Shell name={name} label={label} hint={hint} error={error} className={className}>
      <Textarea
        id={idOf(name)}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ name, hint, error })}
        {...area}
      />
    </Shell>
  );
}

type SelectProps = FieldShell & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'className' | 'id'>;

export function SelectField({ name, label, hint, error, className, children, ...select }: SelectProps) {
  return (
    <Shell name={name} label={label} hint={hint} error={error} className={className}>
      <Select
        id={idOf(name)}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ name, hint, error })}
        {...select}
      >
        {children}
      </Select>
    </Shell>
  );
}

type CheckProps = {
  name: string;
  label: string;
  defaultChecked: boolean;
  hint?: string;
  error?: string;
  className?: string;
};

export function CheckField({ name, label, defaultChecked, hint, error, className }: CheckProps) {
  const id = idOf(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({ name, hint, error })}
          className="mt-0.5 size-4 shrink-0 accent-maroon"
        />
        <span>
          <span className="font-medium text-ink-2">{label}</span>
          {hint ? (
            <span id={`${id}-hint`} className="mt-0.5 block text-mute">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The checkbox that turns a placeholder into a fact the public site may state. */
type ConfirmedProps = { name: string; defaultChecked: boolean; error?: string };

export function ConfirmedField({ name, defaultChecked, error }: ConfirmedProps) {
  return (
    <CheckField
      name={name}
      label="Confirmed by the client"
      hint="The public site and search listings only use details marked confirmed."
      defaultChecked={defaultChecked}
      error={error}
    />
  );
}

export function FormCard({ children, className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      noValidate
      className={cn('space-y-6 rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6', className)}
      {...props}
    >
      {children}
    </form>
  );
}
