'use client';

import { startTransition } from 'react';
import { useActionState } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { unstable_rethrow } from 'next/navigation';
import type { SettingsFormState } from '@/app/admin/(panel)/settings/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import { cn } from '@/lib/cn';

// Shared pieces of the Settings forms. Each form submits through onSubmit rather
// than <form action>, because React clears a form's fields after an action: a
// rejected save would otherwise wipe what the owner had typed.

type FormResult = { ok: boolean; message: string; errors: Record<string, string>; at: number } | null;

const clock = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Colombo' });
const savedAt = (at: number) => clock.format(new Date(at));

type SettingsAction = (previous: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function useSettingsForm(action: SettingsAction) {
  const [state, dispatch, pending] = useActionState<SettingsFormState, FormData>(async (previous, data) => {
    try {
      return await action(previous, data);
    } catch (error) {
      unstable_rethrow(error);
      return {
        ok: false,
        message: 'Your changes could not be saved. They are kept here. Please try again.',
        errors: {},
        at: Date.now(),
      };
    }
  }, null);
  const submitted = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (!state || state.ok) return;
    const field = submitted.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    const section = field.closest('details');
    if (section) section.open = true;
    field.focus();
    field.scrollIntoView({ block: 'center' });
  }, [state]);
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    submitted.current = event.currentTarget;
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
    <p role="status" aria-live="polite"
      className={cn('min-h-5 text-base sm:text-sm', failed ? 'text-bad' : 'text-good')}>
      {text}
    </p>
  );
}

type SaveBarProps = { state: FormResult; pending: boolean; label?: string };

export function SaveBar({ state, pending, label = 'Save changes' }: SaveBarProps) {
  return (
    <div data-sticky-bar className={
      'sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-line bg-paper p-3 '
      + 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
    }>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : label}
      </Button>
      <div className="min-w-0">
        <FormStatus state={state} pending={pending} />
        {state && !state.ok && Object.keys(state.errors).length > 0 ? (
          <ul className="text-base text-bad sm:text-sm">
            {Object.entries(state.errors).map(([name, error]) => (
              <li key={name}>
                <a className="inline-flex min-h-11 items-center underline" href={`#${idOf(name)}`}>{error}</a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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
      {children ? <p className="mt-1 max-w-2xl text-base sm:text-sm text-mute">{children}</p> : null}
    </div>
  );
}

type FieldShell = { name: string; label: string; hint?: string; error?: string; className?: string };

const idOf = (name: string) => `f-${name.replaceAll('.', '-')}`;

function Shell({ name, label, hint, error, className, children }: FieldShell & { children: React.ReactNode }) {
  const id = idOf(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-base sm:text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-base sm:text-sm text-mute">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="status" aria-live="polite" className="mt-1.5 text-base sm:text-sm text-bad">
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
        autoComplete={input.type === 'email' ? 'email' : input.type === 'tel' ? 'tel' : 'off'}
        inputMode={input.type === 'number' ? 'decimal' : input.type === 'tel' ? 'tel' : undefined}
        enterKeyHint="next"
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
        autoComplete="off"
        enterKeyHint="enter"
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
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-base sm:text-sm">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({ name, hint, error })}
          className="size-11 shrink-0 accent-maroon"
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
        <p id={`${id}-error`} role="status" aria-live="polite" className="mt-1.5 text-base sm:text-sm text-bad">
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
      onBlurCapture={(event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          if (!input.checkValidity()) input.reportValidity();
        }
      }}
      className={cn(
        'min-w-0 space-y-6 rounded-[var(--radius-card)] border border-line bg-paper p-4 pb-24 sm:p-6 sm:pb-24',
        className,
      )}
      {...props}
    >
      {children}
    </form>
  );
}
