'use client';

import { useId, useState, useTransition } from 'react';
import { submitReviewAction } from '@/app/(site)/review/[token]/actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { REVIEW_LIMITS, type ReviewFormState } from './limits';

type FieldName = 'rating' | 'title' | 'body' | 'name';

const STAR_CLASS = cn(
  'cursor-pointer rounded-md p-1 text-4xl leading-none',
  'focus-within:ring-2 focus-within:ring-maroon/40',
);

const RATING_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

function Message({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-bad">
      {children}
    </p>
  );
}

/** The review form behind a review link. Nothing is published until the team has checked it. */
export function ReviewForm({ token, productName }: { token: string; productName: string }) {
  const id = useId();
  const [state, setState] = useState<ReviewFormState>({ status: 'idle' });
  const [rating, setRating] = useState(0);
  const [bodyLength, setBodyLength] = useState(0);
  const [pending, startTransition] = useTransition();
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const errorFor = (field: FieldName) => errors[field];
  const describedBy = (field: FieldName, hint?: string) =>
    [hint, errorFor(field) ? `${id}-${field}-error` : null].filter(Boolean).join(' ') || undefined;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      setState(await submitReviewAction(token, data));
    });
  }

  if (state.status === 'done') {
    return (
      <div role="status" className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
        <h2 className="text-2xl font-light">Thank you for your review</h2>
        <p className="mt-3 max-w-prose text-ink-2">
          It will appear after the team has checked it. We read every one, and it helps other families choosing a sofa.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6 rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8"
    >
      {state.status === 'error' ? (
        <p role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.message}
        </p>
      ) : null}

      <fieldset aria-describedby={describedBy('rating')}>
        <legend className="mb-1.5 block text-sm font-medium text-ink-2">
          How would you rate your {productName}?
        </legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex gap-1">
            {RATING_WORDS.map((word, index) => {
              const value = index + 1;
              return (
                <label
                  key={word}
                  className={STAR_CLASS}
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    className="sr-only"
                  />
                  <span className="sr-only">{`${value} out of 5, ${word}`}</span>
                  <span aria-hidden="true" className={cn(value <= rating ? 'text-warn' : 'text-line')}>
                    ★
                  </span>
                </label>
              );
            })}
          </div>
          <span aria-live="polite" className="text-sm text-mute">
            {rating > 0 ? RATING_WORDS[rating - 1] : 'Choose from 1 to 5 stars'}
          </span>
        </div>
        <Message id={`${id}-rating-error`}>{errorFor('rating')}</Message>
      </fieldset>

      <div>
        <Label htmlFor={`${id}-title`}>
          Title <span className="font-normal text-mute">(optional)</span>
        </Label>
        <Input
          id={`${id}-title`}
          name="title"
          maxLength={REVIEW_LIMITS.titleMax}
          autoComplete="off"
          aria-invalid={errorFor('title') ? true : undefined}
          aria-describedby={describedBy('title')}
        />
        <Message id={`${id}-title-error`}>{errorFor('title')}</Message>
      </div>

      <div>
        <Label htmlFor={`${id}-body`}>Your review</Label>
        <Textarea
          id={`${id}-body`}
          name="body"
          rows={6}
          maxLength={REVIEW_LIMITS.bodyMax}
          onChange={(event) => setBodyLength(event.target.value.length)}
          aria-required="true"
          aria-invalid={errorFor('body') ? true : undefined}
          aria-describedby={describedBy('body', `${id}-body-hint`)}
        />
        <p id={`${id}-body-hint`} className="mt-1.5 text-sm text-mute">
          What is it like to live with? Comfort, fabric, delivery and the showroom visit are all welcome. At least{' '}
          {REVIEW_LIMITS.bodyMin} characters ({bodyLength} of {REVIEW_LIMITS.bodyMax} used).
        </p>
        <Message id={`${id}-body-error`}>{errorFor('body')}</Message>
      </div>

      <div>
        <Label htmlFor={`${id}-name`}>Name to show with your review</Label>
        <Input
          id={`${id}-name`}
          name="name"
          maxLength={REVIEW_LIMITS.nameMax}
          autoComplete="name"
          aria-required="true"
          aria-invalid={errorFor('name') ? true : undefined}
          aria-describedby={describedBy('name', `${id}-name-hint`)}
        />
        <p id={`${id}-name-hint`} className="mt-1.5 text-sm text-mute">
          This is shown publicly. A first name and initial is fine.
        </p>
        <Message id={`${id}-name-error`}>{errorFor('name')}</Message>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Sending…' : 'Send my review'}
      </Button>
    </form>
  );
}
