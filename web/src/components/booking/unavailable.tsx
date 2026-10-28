import { Card } from '@/components/ui/card';

/** Shown instead of the form when the visit calendar cannot be loaded or has no open day. */
export function VisitTimesNotice({ kind, whatsappHref }: { kind: 'error' | 'none'; whatsappHref: string | null }) {
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-2xl font-light">{kind === 'error' ? 'We could not load visit times' : 'No visit times are open right now'}</h2>
      <p className="mt-3 max-w-prose text-ink-2">
        {kind === 'error'
          ? 'Something went wrong on our side, so the calendar cannot be shown just now. Please message us on WhatsApp and we will find a time with you, or try again in a moment.'
          : 'Please message us on WhatsApp and we will find a time with you.'}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-primary px-7 py-4">
            Message us on WhatsApp
          </a>
        ) : null}
        {kind === 'error' ? (
          <a href="/book-visit/" className="btn-ghost px-7 py-4">
            Try again
          </a>
        ) : null}
      </div>
    </Card>
  );
}
