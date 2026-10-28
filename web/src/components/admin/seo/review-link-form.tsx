'use client';

import { useId, useState, useTransition } from 'react';
import { generateReviewLinkAction } from '@/app/admin/(panel)/seo/actions';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type { PreparedReviewLink, ReviewLinkBooking } from '@/lib/admin/reviews';

const visitFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const visitLabel = (date: string): string => visitFormat.format(new Date(`${date}T00:00:00Z`));

/** Staff pick a booking and one of its products, get a signed link, and send it over WhatsApp. */
export function ReviewLinkForm({ bookings }: { bookings: ReviewLinkBooking[] }) {
  const id = useId();
  const [bookingId, setBookingId] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState<PreparedReviewLink | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [pending, startTransition] = useTransition();
  const booking = bookings.find((candidate) => String(candidate.id) === bookingId);

  function chooseBooking(value: string) {
    const chosen = bookings.find((candidate) => String(candidate.id) === value);
    setBookingId(value);
    setProductId(chosen?.items.length === 1 ? String(chosen.items[0].productId) : '');
    setResult(null);
    setCopied('idle');
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingId || !productId) return;
    setCopied('idle');
    startTransition(async () => {
      setResult(await generateReviewLinkAction(Number(productId), Number(bookingId)));
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  }

  if (bookings.length === 0) {
    return (
      <p className="text-sm text-mute">
        Review links are made for bookings marked as visited or purchased, and there are none yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Booking" htmlFor={`${id}-booking`}>
          <Select
            id={`${id}-booking`}
            value={bookingId}
            onChange={(event) => chooseBooking(event.target.value)}
            required
          >
            <option value="">Choose a booking</option>
            {bookings.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.customerName}, {visitLabel(candidate.visitDate)} ({candidate.reference})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Product" htmlFor={`${id}-product`}>
          <Select
            id={`${id}-product`}
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setResult(null);
            }}
            disabled={!booking}
            required
          >
            <option value="">{booking ? 'Choose a product' : 'Choose a booking first'}</option>
            {booking?.items.map((item) => (
              <option key={item.productId} value={item.productId}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending || !bookingId || !productId}>
          {pending ? 'Creating…' : 'Create review link'}
        </Button>
      </form>
      <div aria-live="polite">
        {result && !result.ok ? <p className="text-sm text-bad">{result.error}</p> : null}
        {result?.ok ? (
          <div className="space-y-3 rounded-xl bg-bone-2 p-4">
            <p className="text-sm text-ink-2">
              Link for <strong className="font-semibold text-ink">{result.productName}</strong>. It works for 60 days
              and takes one review.
            </p>
            <Input readOnly value={result.url} aria-label="Review link" onFocus={(event) => event.target.select()} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="dark" onClick={() => copy(result.url)}>
                Copy link
              </Button>
              {result.whatsappUrl ? (
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonStyles({ size: 'sm' })}
                >
                  Send on WhatsApp
                </a>
              ) : (
                <span className="text-sm text-mute">No mobile number on file, so copy the link instead.</span>
              )}
              {copied === 'done' ? <span className="text-sm text-good">Copied.</span> : null}
              {copied === 'failed' ? (
                <span className="text-sm text-bad">Could not copy; select the link instead.</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
