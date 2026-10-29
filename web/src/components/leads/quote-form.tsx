'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import {
  submissionToken,
  clearSubmissionToken,
} from '@/lib/security/submission-token';
import { submitQuote } from '@/app/(site)/request-quote/actions';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { TLink } from '@/components/site/transition';
import { useCart, useCartHydrated } from '@/lib/cart/store';
import { collectAttribution } from '@/lib/analytics/attribution';
import { toCartRef } from '@/lib/cart/types';
import type { QuoteState } from '@/lib/leads/schema';

export function QuoteForm() {
  const [state, action, pending] = useActionState<QuoteState, FormData>(
    async (previous, form) => {
      try {
        return await submitQuote(previous, form);
      } catch {
        return {
          ok: false,
          message:
            'We could not reach the showroom. Your details are still here; please try again.',
        };
      }
    },
    null,
  );
  const token = useRef<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.ok) clearSubmissionToken('quote');
    else if (state) errorRef.current?.focus();
  }, [state]);
  const formRef = useRef<HTMLFormElement>(null);
  const lines = useCart((s) => s.lines);
  const hydrated = useCartHydrated();
  const fields = state && !state.ok ? state.fields : undefined;
  if (state?.ok)
    return (
      <section
        role="status"
        className="rounded-2xl border border-line bg-paper p-6 sm:p-10"
      >
        <p className="eyebrow">Request received</p>
        <h2 className="mt-3 font-display text-3xl">
          Let’s find your perfect piece.
        </h2>
        <p className="mt-4">
          Your reference is <strong>{state.reference}</strong>. Our team will
          contact you using your preferred method to confirm pricing and
          options.
        </p>
        <p className="mt-3 text-mute">
          A quotation request does not reserve stock or take a payment.
        </p>
        <TLink href="/shop/" className="btn-primary mt-6 min-h-11 px-6">
          Continue exploring
        </TLink>
      </section>
    );
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        token.current ??= submissionToken('quote');
        const form = formRef.current;
        if (form) {
          (form.elements.namedItem('requestToken') as HTMLInputElement).value =
            token.current;
          (form.elements.namedItem('attribution') as HTMLInputElement).value =
            JSON.stringify(collectAttribution());
        }
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-6 rounded-2xl border border-line bg-paper p-5 sm:p-8"
      aria-busy={pending}
    >
      <input type="hidden" name="requestToken" />
      <input type="hidden" name="attribution" defaultValue="{}" />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(toCartRef(lines))}
      />
      <section aria-labelledby="quote-pieces">
        <h2 id="quote-pieces" className="font-display text-2xl">
          Your selected pieces
        </h2>
        {lines.length ? (
          <ul className="mt-3 divide-y divide-line">
            {lines.map((line) => (
              <li key={line.variantId} className="py-3">
                {line.quantity} × {line.name}
                <span className="block text-sm text-mute">
                  {line.colourName}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-mute">
            Tell us what you have in mind below, or{' '}
            <TLink href="/shop/" className="underline">
              choose some pieces
            </TLink>
            .
          </p>
        )}
        <TLink
          href="/cart/"
          className="mt-2 inline-flex min-h-11 items-center underline"
        >
          Edit selected pieces
        </TLink>
      </section>
      {state && !state.ok ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl bg-maroon/10 p-4 text-maroon"
        >
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="quote-name" error={fields?.name}>
          <Input
            id="quote-name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
          />
        </Field>
        <Field label="Phone number" htmlFor="quote-phone" error={fields?.phone}>
          <Input
            id="quote-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={30}
            placeholder="077 123 4567"
          />
        </Field>
        <Field
          label="City or district"
          htmlFor="quote-city"
          error={fields?.city}
        >
          <Input
            id="quote-city"
            name="city"
            autoComplete="address-level2"
            required
            minLength={2}
            maxLength={100}
          />
        </Field>
        <Field
          label="Preferred contact"
          htmlFor="quote-contact"
          error={fields?.preferredContact}
        >
          <Select id="quote-contact" name="preferredContact">
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Phone call</option>
            <option value="email">Email</option>
          </Select>
        </Field>
        <Field
          label="Email (optional unless preferred)"
          htmlFor="quote-email"
          error={fields?.email}
        >
          <Input
            id="quote-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
          />
        </Field>
        <Field
          label="Budget (optional)"
          htmlFor="quote-budget"
          error={fields?.budget}
        >
          <Input
            id="quote-budget"
            name="budget"
            maxLength={100}
            placeholder="For example, LKR 150,000"
          />
        </Field>
      </div>
      <Field
        label="Room dimensions (optional)"
        htmlFor="quote-room"
        error={fields?.room}
      >
        <Input
          id="quote-room"
          name="room"
          maxLength={200}
          placeholder="Width × length, with units"
        />
      </Field>
      <Field
        label="What are you looking for? (optional)"
        htmlFor="quote-notes"
        error={fields?.notes}
      >
        <Textarea
          id="quote-notes"
          name="notes"
          maxLength={2000}
          placeholder="Style, fabric, delivery area, or anything you would like us to know"
        />
      </Field>
      <Field
        label="Privacy agreement"
        htmlFor="quote-consent"
        error={fields?.consent}
      >
        <div className="flex gap-3">
          <input
            id="quote-consent"
            name="consent"
            type="checkbox"
            required
            className="mt-1 size-5 shrink-0"
          />
          <label htmlFor="quote-consent" className="text-sm">
            I agree that Sofa Factory Outlet may contact me about this request.{' '}
            <TLink href="/privacy/" className="underline">
              Privacy policy
            </TLink>
          </label>
        </div>
      </Field>
      <Button
        type="submit"
        disabled={pending || !hydrated}
        size="lg"
        className="w-full"
      >
        {pending ? 'Sending your request…' : 'Request my quote'}
      </Button>
      <p className="text-sm text-mute">
        No showroom appointment needed. Prices and delivery are confirmed by our
        team.
      </p>
    </form>
  );
}
