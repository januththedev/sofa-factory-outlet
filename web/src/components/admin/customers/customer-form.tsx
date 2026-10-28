'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, Input, Textarea } from '@/components/ui/field';
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
  const value = (name: keyof CustomerFormValues) => state?.values?.[name] ?? initial[name];
  const error = (name: keyof CustomerFormValues) => state?.fieldErrors?.[name];
  return (
    <form action={formAction} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="customer-name" error={error('name')} className="sm:col-span-2">
          <Input
            id="customer-name"
            name="name"
            autoComplete="off"
            maxLength={80}
            required
            defaultValue={value('name')}
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
            autoComplete="off"
            placeholder="077 123 4567"
            required
            defaultValue={value('phone')}
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
            autoComplete="off"
            defaultValue={value('whatsapp')}
            aria-invalid={Boolean(error('whatsapp'))}
          />
        </Field>
        <Field label="Email" htmlFor="customer-email" error={error('email')}>
          <Input
            id="customer-email"
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={value('email')}
            aria-invalid={Boolean(error('email'))}
          />
        </Field>
        <Field label="City" htmlFor="customer-city" error={error('city')}>
          <Input
            id="customer-city"
            name="city"
            autoComplete="off"
            maxLength={100}
            defaultValue={value('city')}
            aria-invalid={Boolean(error('city'))}
          />
        </Field>
        <Field label="Address" htmlFor="customer-address" error={error('address')} className="sm:col-span-2">
          <Textarea
            id="customer-address"
            name="address"
            rows={2}
            maxLength={300}
            defaultValue={value('address')}
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
            rows={4}
            maxLength={2000}
            defaultValue={value('notes')}
            aria-invalid={Boolean(error('notes'))}
          />
        </Field>
      </div>

      <div aria-live="polite">
        <FieldError>{state?.error}</FieldError>
        {state?.existing ? (
          <p className="mt-1.5 text-sm">
            <Link href={`/admin/customers/${state.existing.id}/`} className="font-semibold text-maroon hover:underline">
              Open {state.existing.name}
            </Link>{' '}
            instead.
          </p>
        ) : null}
        {state?.message ? (
          <p role="status" className="text-sm text-good">
            {state.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
