'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { Controller, type FieldErrors, useForm, useWatch } from 'react-hook-form';
import { submitBooking } from '@/app/(site)/book-visit/actions';
import { Card } from '@/components/ui/card';
import { getVisitorIds, trackEvent } from '@/lib/analytics/client';
import type { DayAvailability } from '@/lib/bookings/api';
import { useCart } from '@/lib/cart/store';
import { toCartRef } from '@/lib/cart/types';
import { isLkMobile, normaliseLkPhone } from '@/lib/phone';
import { cellState, formatVisitDate } from './calendar';
import { CartReview } from './cart-review';
import { DatePicker } from './date-picker';
import { Field, fieldId, Group, Switch, TextArea, TextInput } from './fields';
import {
  type BookingDetails,
  type BookingFormState,
  type BookingMeta,
  bookingDetailsSchema,
  CONTACT_LABELS,
  CONTACT_METHODS,
  DETAIL_FIELDS,
  type DetailField,
  toBookingFormData,
} from './schema';
import { SlotPicker } from './slot-picker';

type BookingFormProps = {
  availability: DayAvailability[];
  businessName: string;
  /** wa.me link to the showroom, offered when something goes wrong. */
  whatsappHref: string | null;
};

/** Failures where messaging the showroom is the useful next step. */
const WHATSAPP_CODES: ReadonlyArray<NonNullable<BookingFormState>['code']> = ['rate_limited', 'unknown'];

/** Moves the keyboard focus to the first control of a field, so a screen reader announces its error. */
function focusField(form: HTMLFormElement | null, name: DetailField) {
  const root = form?.querySelector<HTMLElement>(`#${fieldId(name)}`);
  if (!root) return;
  if (root.matches('input, textarea, select, button')) {
    root.focus();
    return;
  }
  const target = ['[role="grid"] [tabindex="0"]', 'input:checked:not(:disabled)', 'input:not(:disabled)']
    .map((selector) => root.querySelector<HTMLElement>(selector))
    .find(Boolean);
  (target ?? root).focus();
}

/** Where the visitor came from, for the admin. Advisory: the server never relies on it. */
function collectMeta(): BookingMeta {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign']) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value.slice(0, 200);
  }
  let sourcePage = window.location.pathname;
  let referrer: string | undefined;
  if (document.referrer) {
    try {
      const from = new URL(document.referrer);
      if (from.origin === window.location.origin) sourcePage = from.pathname;
      else referrer = from.href.slice(0, 900);
    } catch {
      // an unreadable referrer is simply left out
    }
  }
  return { visitorId: getVisitorIds().visitorId, sourcePage, referrer, utm };
}

function Step({ id, number, title, children }: { id: string; number: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-8">
      <section aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`} className="flex items-center gap-3 text-2xl font-light">
          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-sans text-sm font-medium text-bone">
            {number}
          </span>
          {title}
        </h2>
        <div className="mt-6 space-y-6">{children}</div>
      </section>
    </Card>
  );
}

export function BookingForm({ availability: initialAvailability, businessName, whatsappHref }: BookingFormProps) {
  const [state, formAction, pending] = useActionState(submitBooking, null);
  const lines = useCart((cart) => cart.lines);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [clientNotice, setClientNotice] = useState<string | null>(null);
  // The server result the visitor has already acted on, so its message is no longer shown.
  const [dismissed, setDismissed] = useState<BookingFormState>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    resetField,
    getValues,
    formState: { errors },
  } = useForm<BookingDetails>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: { name: '', phone: '', whatsappSame: true, email: '', city: '', date: '', notes: '', preferredContact: 'whatsapp', consent: false },
    shouldFocusError: false,
  });

  const date = useWatch({ control, name: 'date' });
  const slotId: number | undefined = useWatch({ control, name: 'slotId' });
  const phone = useWatch({ control, name: 'phone' });

  // Fresh availability from a failed attempt replaces what the page loaded with.
  const availability = state?.availability ?? initialAvailability;
  const chosenDay = date ? availability.find((day) => day.date === date) : undefined;
  const chosenSlot = chosenDay?.slots.find((slot) => slot.slotId === slotId);
  const normalisedPhone = normaliseLkPhone(phone);
  const landline = normalisedPhone !== null && !isLkMobile(normalisedPhone);

  const serverState = state && state !== dismissed ? state : null;
  const notice = clientNotice ?? serverState?.error ?? null;
  const offerWhatsapp = Boolean(whatsappHref && !clientNotice && serverState && WHATSAPP_CODES.includes(serverState.code));

  useEffect(() => {
    trackEvent('booking_start');
  }, []);

  // When the server sends a problem back, show it on the right fields and move the focus there.
  useEffect(() => {
    if (!state) return;
    const fieldErrors = state.fieldErrors ?? {};
    const failed = DETAIL_FIELDS.filter((name) => fieldErrors[name]);
    for (const name of failed) setError(name, { type: 'server', message: fieldErrors[name] });
    let target: DetailField | undefined = failed[0];
    if (state.code === 'slot_full' || state.code === 'slot_closed') {
      // That time has gone. Clear it, and the date too if nothing is left on it.
      resetField('slotId');
      const dateGone = state.availability !== undefined && cellState(state.availability.find((day) => day.date === getValues('date'))) !== 'open';
      if (dateGone) resetField('date');
      target = dateGone ? 'date' : 'slotId';
      setError(target, { type: 'server', message: state.error });
    }
    if (target) focusField(formRef.current, target);
    else noticeRef.current?.focus();
  }, [state, setError, resetField, getValues]);

  const onInvalid = (invalid: FieldErrors<BookingDetails>) => {
    setDismissed(state);
    const names = DETAIL_FIELDS.filter((name) => invalid[name]);
    setClientNotice(names.length === 1 ? 'Please check the highlighted field.' : `Please check the ${names.length} highlighted fields.`);
    if (names[0]) focusField(formRef.current, names[0]);
  };

  const onValid = (details: BookingDetails) => {
    setDismissed(state);
    setClientNotice(null);
    const formData = toBookingFormData(details, { items: toCartRef(lines), meta: collectMeta() });
    startTransition(() => formAction(formData));
  };

  const message = (name: DetailField) => errors[name]?.message;

  return (
    <form ref={formRef} onSubmit={(event) => void handleSubmit(onValid, onInvalid)(event)} noValidate aria-busy={pending} className="space-y-6">
      <Step id="bv-pieces" number={1} title="Your pieces">
        <CartReview />
      </Step>

      <Step id="bv-details" number={2} title="Your details">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="name" label="Full name" error={message('name')}>
            {(a11y) => <TextInput {...a11y} type="text" autoComplete="name" maxLength={80} {...register('name')} />}
          </Field>
          <Field name="phone" label="Phone number" hint="So we can reach you about your visit." error={message('phone')}>
            {(a11y) => <TextInput {...a11y} type="tel" inputMode="tel" autoComplete="tel" placeholder="077 123 4567" {...register('phone')} />}
          </Field>
        </div>

        <Controller
          control={control}
          name="whatsappSame"
          render={({ field }) => (
            <Switch
              id={fieldId('whatsappSame')}
              label="Same number on WhatsApp"
              checked={field.value && !landline}
              disabled={landline}
              onChange={field.onChange}
              hint={landline ? 'WhatsApp needs a mobile number, so we will use your phone number to call.' : undefined}
            />
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="email" label="Email" optional error={message('email')}>
            {(a11y) => <TextInput {...a11y} type="email" inputMode="email" autoComplete="email" maxLength={200} {...register('email')} />}
          </Field>
          <Field name="city" label="City or district" optional error={message('city')}>
            {(a11y) => <TextInput {...a11y} type="text" autoComplete="address-level2" maxLength={100} placeholder="For example Dehiwala" {...register('city')} />}
          </Field>
        </div>

        <Group name="date" legend="Preferred date" error={message('date')}>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker
                availability={availability}
                value={field.value}
                describedBy={message('date') ? `${fieldId('date')}-error` : undefined}
                onChange={(next) => {
                  if (next === field.value) return;
                  field.onChange(next);
                  // Times belong to a day, so a new day starts without one.
                  resetField('slotId');
                }}
              />
            )}
          />
        </Group>

        <Group name="slotId" legend="Time slot" error={message('slotId')}>
          <Controller control={control} name="slotId" render={({ field }) => <SlotPicker day={chosenDay} value={field.value} onChange={field.onChange} />} />
          <p aria-live="polite" className="mt-3 text-sm font-medium text-ink-2">
            {chosenDay && chosenSlot ? `Your visit: ${formatVisitDate(chosenDay.date)}, ${chosenSlot.label}` : ''}
          </p>
        </Group>

        <Field name="notes" label="Anything we should know?" optional hint="For example room size, colours you like or pieces you want to see." error={message('notes')}>
          {(a11y) => <TextArea {...a11y} maxLength={2000} {...register('notes')} />}
        </Field>

        <Group name="preferredContact" legend="How should we contact you?" error={message('preferredContact')}>
          <div className="flex flex-wrap gap-2">
            {CONTACT_METHODS.map((method) => (
              <label key={method} className="relative">
                <input type="radio" value={method} {...register('preferredContact')} className="peer sr-only" />
                <span className="inline-flex h-11 cursor-pointer items-center rounded-full border border-line bg-paper px-5 text-sm font-medium text-ink-2 transition-colors hover:border-ink/40 peer-checked:border-maroon peer-checked:bg-maroon peer-checked:text-bone peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-maroon">
                  {CONTACT_LABELS[method]}
                </span>
              </label>
            ))}
          </div>
        </Group>
      </Step>

      <Step id="bv-confirm" number={3} title="Confirm your visit">
        <div>
          <label className="flex items-start gap-3 text-sm text-ink-2">
            <input
              id={fieldId('consent')}
              type="checkbox"
              aria-describedby={message('consent') ? `${fieldId('consent')}-error` : undefined}
              aria-invalid={message('consent') ? true : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 accent-maroon"
              {...register('consent')}
            />
            <span>
              I agree that {businessName} may use these details to arrange my visit, as set out in the{' '}
              <a href="/privacy/" target="_blank" rel="noopener noreferrer" className="font-semibold text-maroon underline underline-offset-4">
                privacy policy (opens in a new tab)
              </a>
              .
            </span>
          </label>
          {message('consent') ? (
            <p id={`${fieldId('consent')}-error`} className="mt-1.5 text-sm text-bad">
              {message('consent')}
            </p>
          ) : null}
        </div>

        {notice ? (
          <div ref={noticeRef} role="alert" tabIndex={-1} className="rounded-xl border border-bad/30 bg-bad/5 p-4 text-sm outline-none">
            <p className="font-medium text-bad">{notice}</p>
            {offerWhatsapp && whatsappHref ? (
              <p className="mt-1.5 text-ink-2">
                Prefer to talk?{' '}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-maroon underline underline-offset-4">
                  Message us on WhatsApp
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <button type="submit" disabled={pending} className="btn-primary w-full px-8 py-4 disabled:opacity-60 sm:w-auto">
            {pending ? 'Booking your visit…' : 'Book my visit'}
          </button>
          <p className="text-sm text-mute">Nothing is paid online. Prices, fabrics and delivery are confirmed at your visit.</p>
        </div>
      </Step>
    </form>
  );
}
