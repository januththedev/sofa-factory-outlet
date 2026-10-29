'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Controller,
  type FieldErrors,
  useForm,
  useWatch,
} from 'react-hook-form';
import { submissionToken } from '@/lib/security/submission-token';
import { submitBooking } from '@/app/(site)/book-visit/actions';
import { TLink } from '@/components/site/transition';
import { Card } from '@/components/ui/card';
import { collectAttribution } from '@/lib/analytics/attribution';
import { getVisitorIds, trackEvent } from '@/lib/analytics/client';
import type { DayAvailability } from '@/lib/bookings/api';
import { useCart } from '@/lib/cart/store';
import { toCartRef } from '@/lib/cart/types';
import { isLkMobile, normaliseLkPhone } from '@/lib/phone';
import { earliestAvailable } from './availability';
import { formatVisitDate } from './calendar';
import { CartReview } from './cart-review';
import { DatePicker } from './date-picker';
import { restoreBookingDraft, saveBookingDraft } from './draft';
import { Field, fieldId, Group, Switch, TextArea, TextInput } from './fields';
import { MobileDatePicker } from './mobile-date-picker';
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

const DEFAULTS = {
  name: '',
  phone: '',
  whatsappSame: true,
  email: '',
  city: '',
  date: '',
  notes: '',
  preferredContact: 'whatsapp' as const,
  consent: false,
};

const FIELD_LABELS: Record<DetailField, string> = {
  name: 'Full name',
  phone: 'Phone number',
  email: 'Email',
  city: 'City or district',
  date: 'Preferred date',
  slotId: 'Time slot',
  notes: 'Anything we should know?',
  preferredContact: 'Contact preference',
  consent: 'Privacy agreement',
};

type BookingFormProps = {
  availability: DayAvailability[];
  businessName: string;
  whatsappHref: string | null;
};

function fieldTarget(
  form: HTMLFormElement | null,
  name: DetailField,
): HTMLElement | null {
  const root = form?.querySelector<HTMLElement>(`#${fieldId(name)}`);
  if (!root) return null;
  if (root.matches('input, textarea, select, button')) return root;
  const choices = root.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled)',
  );
  return [...choices].find((item) => item.getClientRects().length > 0) ?? root;
}

function revealField(
  form: HTMLFormElement | null,
  name: DetailField,
  focus = true,
) {
  const target = fieldTarget(form, name);
  target?.scrollIntoView({ block: 'center', behavior: 'instant' });
  if (focus) target?.focus({ preventScroll: true });
}

function collectMeta(): BookingMeta {
  const utm = collectAttribution();
  let sourcePage = window.location.pathname;
  let referrer: string | undefined;
  if (document.referrer) {
    try {
      const from = new URL(document.referrer);
      if (from.origin === window.location.origin) sourcePage = from.pathname;
      else referrer = from.href.slice(0, 900);
    } catch {
      // An unreadable referrer is simply left out.
    }
  }
  return { visitorId: getVisitorIds().visitorId, sourcePage, referrer, utm };
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-8">
      <section aria-labelledby={`bv-step-${number}`}>
        <h2
          id={`bv-step-${number}`}
          className="flex items-center gap-3 text-2xl font-light"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-base text-bone"
          >
            {number}
          </span>
          {title}
        </h2>
        <div className="mt-6 space-y-6">{children}</div>
      </section>
    </Card>
  );
}

export function BookingForm({
  availability: initialAvailability,
  businessName,
  whatsappHref,
}: BookingFormProps) {
  const submissionLock = useRef(false);
  const requestToken = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState<
    BookingFormState,
    FormData
  >(async (previous, data) => {
    try {
      return await submitBooking(previous, data);
    } catch (error) {
      // Next handles successful action redirects; transport failures remain retryable in this form.
      if (
        error &&
        typeof error === 'object' &&
        'digest' in error &&
        typeof error.digest === 'string' &&
        error.digest.startsWith('NEXT_REDIRECT')
      )
        throw error;
      return {
        code: 'unknown',
        error: 'We could not connect. Please try again.',
      };
    } finally {
      submissionLock.current = false;
    }
  }, null);
  const lines = useCart((cart) => cart.lines);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [clientNotice, setClientNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<BookingFormState>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    resetField,
    setValue,
    getValues,
    subscribe,
    trigger,
    formState: { errors },
  } = useForm<BookingDetails>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: DEFAULTS,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldFocusError: false,
  });
  const date = useWatch({ control, name: 'date' });
  const slotId = useWatch({ control, name: 'slotId' });
  const phone = useWatch({ control, name: 'phone' });
  const availability = state?.availability ?? initialAvailability;
  const chosenDay = availability.find((day) => day.date === date);
  const chosenSlot = chosenDay?.slots.find((slot) => slot.slotId === slotId);
  const normalisedPhone = normaliseLkPhone(phone);
  const landline = normalisedPhone !== null && !isLkMobile(normalisedPhone);
  const serverState = state && state !== dismissed ? state : null;
  const notice = clientNotice ?? serverState?.error ?? null;
  const errorFields = DETAIL_FIELDS.filter((name) => errors[name]);
  const summaryVisible = Boolean(notice || errorFields.length);

  useEffect(() => {
    trackEvent('booking_start');
    const saved = restoreBookingDraft();
    if (saved)
      reset(
        { ...DEFAULTS, ...saved, consent: false },
        { keepDefaultValues: true },
      );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    const flush = () => {
      clearTimeout(timer);
      if (dirty) saveBookingDraft(getValues());
      dirty = false;
    };
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: () => {
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(flush, 300);
      },
    });
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      flush();
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [reset, getValues, subscribe]);

  useEffect(() => {
    if (!state) return;
    const fieldErrors = state.fieldErrors ?? {};
    const failed = DETAIL_FIELDS.filter((name) => fieldErrors[name]);
    for (const name of failed)
      setError(name, { type: 'server', message: fieldErrors[name] });
    if (state.code === 'slot_full' || state.code === 'slot_closed') {
      const refreshed = state.availability ?? initialAvailability;
      const currentDate = getValues('date');
      // Prefer the next free time on the same day, then later days, then any remaining day.
      const next =
        earliestAvailable(refreshed, currentDate) ??
        earliestAvailable(refreshed);
      resetField('slotId');
      if (next) {
        setValue('date', next.date);
        setValue('slotId', next.slotId);
        clearErrors(['date', 'slotId']);
      } else {
        setValue('date', '');
        setError('date', {
          type: 'server',
          message: 'No free times remain. Please try again later.',
        });
      }
      revealField(formRef.current, 'date', false);
      summaryRef.current?.focus({ preventScroll: true });
    } else {
      if (failed[0]) revealField(formRef.current, failed[0], false);
      summaryRef.current?.focus({ preventScroll: failed.length > 0 });
    }
  }, [
    state,
    setError,
    resetField,
    getValues,
    setValue,
    clearErrors,
    initialAvailability,
  ]);

  const onInvalid = (invalid: FieldErrors<BookingDetails>) => {
    submissionLock.current = false;
    setDismissed(state);
    setClientNotice('Please check the following details.');
    const first = DETAIL_FIELDS.find((name) => invalid[name]);
    requestAnimationFrame(() => {
      if (first) revealField(formRef.current, first, false);
      summaryRef.current?.focus({ preventScroll: true });
    });
  };

  const onValid = (details: BookingDetails) => {
    setDismissed(state);
    setClientNotice(null);
    const data = toBookingFormData(details, {
      items: toCartRef(lines),
      meta: collectMeta(),
    });
    requestToken.current ??= submissionToken('booking');
    data.set('requestToken', requestToken.current);
    startTransition(() => formAction(data));
  };

  const message = (name: DetailField) => errors[name]?.message;
  const chooseDate = (next: string) => {
    if (next === getValues('date')) return;
    setValue('date', next, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    resetField('slotId');
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (submissionLock.current || pending) return;
        submissionLock.current = true;
        void handleSubmit(onValid, onInvalid)(event);
      }}
      noValidate
      aria-busy={pending}
      className="min-w-0 space-y-6 pb-28"
    >
      {summaryVisible ? (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          aria-label="Booking needs attention"
          className="scroll-mb-32 rounded-xl border border-bad/30 bg-paper p-4 focus:ring-2 focus:ring-maroon"
        >
          <p className="font-medium text-bad">
            {notice ?? 'Please check the following details.'}
          </p>
          {serverState?.code === 'slot_full' ||
          serverState?.code === 'slot_closed' ? (
            <p className="mt-2">
              The next free option is selected below, if one is available.
              Please check the time.
            </p>
          ) : null}
          <ul className="mt-2 space-y-2">
            {errorFields.map((name) => (
              <li key={name}>
                <a
                  href={`#${fieldId(name)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    revealField(formRef.current, name);
                  }}
                  className="underline underline-offset-4"
                >
                  {FIELD_LABELS[name]}: {message(name)}
                </a>
              </li>
            ))}
          </ul>
          {serverState ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 rounded-full border px-5"
              >
                Try again
              </button>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  className="inline-flex min-h-11 items-center px-3 underline"
                >
                  Message us on WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Step number={1} title="Your pieces">
        <CartReview />
      </Step>
      <Step number={2} title="Your details">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="name" label="Full name" error={message('name')}>
            {(a11y) => (
              <TextInput
                {...a11y}
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                {...register('name')}
              />
            )}
          </Field>
          <Field
            name="phone"
            label="Phone number"
            hint="For example 077 123 4567"
            error={message('phone')}
          >
            {(a11y) => (
              <TextInput
                {...a11y}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder="077 123 4567"
                {...register('phone')}
              />
            )}
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
              hint={
                landline
                  ? 'WhatsApp needs a mobile number, so we will call this number.'
                  : undefined
              }
            />
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="email" label="Email" optional error={message('email')}>
            {(a11y) => (
              <TextInput
                {...a11y}
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
                {...register('email')}
              />
            )}
          </Field>
          <Field
            name="city"
            label="City or district"
            optional
            error={message('city')}
          >
            {(a11y) => (
              <TextInput
                {...a11y}
                type="text"
                autoComplete="address-level2"
                enterKeyHint="next"
                {...register('city')}
              />
            )}
          </Field>
        </div>
        <Group
          name="date"
          legend="Preferred date"
          error={message('date')}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              void trigger('date');
          }}
        >
          {serverState?.code === 'slot_full' ||
          serverState?.code === 'slot_closed' ? (
            <p role="status" className="mb-3 text-base text-bad">
              {serverState.error} Check the available days and times below.
            </p>
          ) : null}
          <MobileDatePicker
            availability={availability}
            value={date}
            onChange={chooseDate}
            onEarliest={(next) => {
              setValue('date', next.date, {
                shouldValidate: true,
                shouldDirty: true,
              });
              setValue('slotId', next.slotId, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <div className="hidden lg:block">
            <DatePicker
              availability={availability}
              value={date}
              onChange={chooseDate}
            />
          </div>
        </Group>
        <Group name="slotId" legend="Time slot" error={message('slotId')}>
          <Controller
            control={control}
            name="slotId"
            render={({ field }) => (
              <SlotPicker
                day={chosenDay}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(next) => {
                  field.onChange(next);
                  void trigger('slotId');
                }}
              />
            )}
          />
          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 min-h-12 text-base font-medium text-ink-2"
          >
            {chosenDay && chosenSlot
              ? `${formatVisitDate(chosenDay.date)}, ${chosenSlot.start} to ${chosenSlot.end}`
              : 'Choose a day and time, or tap Earliest available.'}
          </p>
        </Group>
        <Field
          name="notes"
          label="Anything we should know?"
          optional
          hint="For example room size, colours you like or pieces you want to see."
          error={message('notes')}
        >
          {(a11y) => (
            <TextArea {...a11y} enterKeyHint="done" {...register('notes')} />
          )}
        </Field>
        <Group
          name="preferredContact"
          legend="How should we contact you?"
          error={message('preferredContact')}
        >
          <div className="flex flex-wrap gap-2">
            {CONTACT_METHODS.map((method) => (
              <label
                key={method}
                className="relative inline-flex min-h-11 cursor-pointer"
              >
                <input
                  type="radio"
                  value={method}
                  {...register('preferredContact', {
                    onChange: () => void trigger('email'),
                  })}
                  className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  className={[
                    'inline-flex min-h-11 items-center rounded-full border border-line px-4 text-base',
                    'peer-checked:bg-maroon peer-checked:text-bone peer-focus-visible:outline-2',
                  ].join(' ')}
                >
                  {CONTACT_LABELS[method]}
                </span>
              </label>
            ))}
          </div>
        </Group>
      </Step>
      <Step number={3} title="Confirm your visit">
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-base text-ink-2">
            <input
              id={fieldId('consent')}
              type="checkbox"
              aria-describedby={
                message('consent') ? `${fieldId('consent')}-error` : undefined
              }
              aria-invalid={message('consent') ? true : undefined}
              className="size-11 shrink-0 accent-maroon md:mt-1 md:size-6"
              {...register('consent')}
            />
            <span>
              I agree that {businessName} may use these details to arrange my
              visit, as set out in the{' '}
              <TLink
                href="/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-maroon underline"
              >
                privacy policy (opens in a new tab)
              </TLink>
              .
            </span>
          </label>
          {message('consent') ? (
            <p
              id={`${fieldId('consent')}-error`}
              className="mt-2 text-base text-bad"
            >
              {message('consent')}
            </p>
          ) : null}
        </div>
        <p className="text-base text-mute">
          Nothing is paid online. Prices are confirmed at your visit.
        </p>
      </Step>
      <div
        data-sticky-bar
        className={[
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone px-4 pt-3',
          'lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-2',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        ].join(' ')}
      >
        <button
          type="submit"
          disabled={pending}
          className="btn-primary mx-auto flex min-h-12 w-full max-w-xl items-center justify-center gap-2 px-6 lg:mx-0 lg:w-auto lg:max-w-none"
        >
          {pending ? (
            <LoaderCircle
              aria-hidden
              className="size-5 motion-safe:animate-spin"
            />
          ) : null}
          {pending ? 'Booking...' : 'Book my visit'}
        </button>
      </div>
    </form>
  );
}
