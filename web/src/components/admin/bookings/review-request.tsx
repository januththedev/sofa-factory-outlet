'use client';

import { MessageCircle } from 'lucide-react';
import { useState, useTransition } from 'react';
import { buttonStyles } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import type { PlainAction } from './types';

/**
 * The one-tap WhatsApp message that asks a customer who visited for a Google review. The link
 * opens WhatsApp with the message filled in; the click also records that the request was sent.
 */
export function ReviewRequest({
  href,
  message,
  hasReviewLink,
  requestedAt,
  action,
}: {
  href: string | null;
  message: string;
  hasReviewLink: boolean;
  /** When staff last opened the request, already formatted, or null. */
  requestedAt: string | null;
  action: PlainAction;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function record() {
    startTransition(async () => {
      const result = await action(undefined);
      setError(result?.error ?? null);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        Ask everyone who visits. Google does not allow rewards for reviews or choosing who gets asked.
      </p>
      <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-bone-2 p-3 text-sm">{message}</blockquote>
      {hasReviewLink ? null : (
        <p className="text-sm text-mute">
          No Google review link is saved in Settings yet, so this sends a plain thank-you message.
        </p>
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={record}
          className={buttonStyles({ variant: 'primary', size: 'sm' })}
        >
          <MessageCircle className="size-4" aria-hidden />
          Send on WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <p className="text-sm text-mute">
          No WhatsApp number is saved for this customer, so it cannot be sent from here.
        </p>
      )}
      {requestedAt ? (
        <p role="status" className="text-sm text-good">
          Review request opened on {requestedAt}.
        </p>
      ) : null}
      <FieldError>{error ?? undefined}</FieldError>
    </div>
  );
}
