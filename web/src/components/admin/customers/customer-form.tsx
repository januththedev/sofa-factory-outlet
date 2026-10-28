'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import { isLkMobile } from '@/lib/phone';
import { normaliseLkPhone } from '@/lib/phone';
import type { CustomerFormAction } from './types';

export type CustomerFormValues = {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  address: string;
  notes: string;
};

export const EMPTY_CUSTOMER: CustomerFormValues = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  city: '',
  address: '',
  notes: '',
};

/** Add or edit a customer. The same fields are used for a walk-in and for an existing record. */
export function CustomerForm({
  action,
  initial,
  submitLabel,
}: {
  action: CustomerFormAction;
  initial: CustomerFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const value = (name: keyof CustomerFormValues) => values[name];
  const error = (name: keyof CustomerFormValues) => state?.fieldErrors?.[name];
  useEffect(() => {
    if (state?.error) {
      const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      const summary = formRef.current?.querySelector<HTMLElement>('#customer-feedback');
      (first ?? summary)?.focus();
    }
  }, [state]);
  return (
    <form
      ref={formRef}
      action={formAction}
      className={
        'space-y-5 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-0 ' +
        '[&_input]:scroll-mb-36 [&_textarea]:scroll-mb-36'
      }
      onBlur={(event) => {
        const field = event.target;
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          if (field.name === 'phone' || field.name === 'whatsapp') {
            const phone = normaliseLkPhone(field.value);
            const valid = field.name === 'whatsapp'
              ? field.value.trim() === '' || (phone !== null && isLkMobile(phone))
              : phone !== null;
            field.setCustomValidity(valid ? '' : 'Enter a valid Sri Lankan phone number.');
          }
          field.reportValidity();
        }
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="customer-name" error={error('name')} className="sm:col-span-2">
          <Input
            id="customer-name"
            name="name"
            autoComplete="name"
            enterKeyHint="next"
            minLength={2}
            maxLength={80}
            required
            value={value('name')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, name: event.target.value }));
            }}
            aria-invalid={Boolean(error('name'))}
          />
        </Field>
        <Field
          label="Phone"
          htmlFor="customer-phone"
          error={error('phone')}
          hint="Customers are matched by phone, so each number belongs to one customer."
        >
          <Input
            id="customer-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            enterKeyHint="next"
            placeholder="077 123 4567"
            required
            value={value('phone')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, phone: event.target.value }));
            }}
            aria-invalid={Boolean(error('phone'))}
          />
        </Field>
        <Field
          label="WhatsApp number"
          htmlFor="customer-whatsapp"
          error={error('whatsapp')}
          hint="Only if it differs from the phone. Leave empty otherwise."
        >
          <Input
            id="customer-whatsapp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            enterKeyHint="next"
            value={value('whatsapp')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, whatsapp: event.target.value }));
            }}
            aria-invalid={Boolean(error('whatsapp'))}
          />
        </Field>
        <Field label="Email" htmlFor="customer-email" error={error('email')}>
          <Input
            id="customer-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={value('email')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, email: event.target.value }));
            }}
            aria-invalid={Boolean(error('email'))}
          />
        </Field>
        <Field label="City" htmlFor="customer-city" error={error('city')}>
          <Input
            id="customer-city"
            name="city"
            autoComplete="address-level2"
            enterKeyHint="next"
            maxLength={100}
            value={value('city')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, city: event.target.value }));
            }}
            aria-invalid={Boolean(error('city'))}
          />
        </Field>
        <Field label="Address" htmlFor="customer-address" error={error('address')} className="sm:col-span-2">
          <Textarea
            id="customer-address"
            name="address"
            inputMode="text"
            enterKeyHint="enter"
            autoComplete="street-address"
            rows={2}
            maxLength={300}
            value={value('address')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, address: event.target.value }));
            }}
            aria-invalid={Boolean(error('address'))}
          />
        </Field>
        <Field
          label="Notes"
          htmlFor="customer-notes"
          error={error('notes')}
          hint="Only staff see these."
          className="sm:col-span-2"
        >
          <Textarea
            id="customer-notes"
            name="notes"
            inputMode="text"
            enterKeyHint="enter"
            autoComplete="off"
            rows={4}
            maxLength={2000}
            value={value('notes')}
            onChange={(event) => {
              event.target.setCustomValidity('');
              setValues((previous) => ({ ...previous, notes: event.target.value }));
            }}
            aria-invalid={Boolean(error('notes'))}
          />
        </Field>
      </div>

      <div id="customer-feedback" tabIndex={-1} aria-live="polite">
        <FieldError>{state?.error}</FieldError>
        {state?.fieldErrors ? (
          <ul className="space-y-2 text-base sm:text-sm text-bad">
            {Object.entries(state.fieldErrors).map(([field, message]) => (
              <li key={field}>
                <a href={`#customer-${field}`} className="inline-flex min-h-11 items-center underline">
                  {message}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {state?.existing ? (
          <p className="mt-1.5 text-base sm:text-sm">
            <Link
              href={`/admin/customers/${state.existing.id}/`}
              className={
                'inline-flex min-h-11 min-w-11 items-center break-words font-semibold text-maroon ' +
                'hover:underline'
              }
            >
              Open {state.existing.name}
            </Link>{' '}
            instead.
          </p>
        ) : null}
        {state?.message ? (
          <p role="status" className="text-base sm:text-sm text-good">
            {state.message}
          </p>
        ) : null}
      </div>

      <div
        data-sticky-bar
        className={
          'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 pt-3 ' +
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:p-0'
        }
      >
        <p aria-live="polite" className="mb-2 text-base sm:text-sm text-good lg:hidden">{state?.message}</p>
        <Button type="submit" disabled={pending} className="w-full lg:w-auto">
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
