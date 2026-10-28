'use client';

import { useId } from 'react';
import { useState } from 'react';
import { answerGapAction } from '@/app/admin/(panel)/knowledge/actions';
import { dismissGapAction } from '@/app/admin/(panel)/knowledge/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FaqDraft } from './faq-fields';
import { FaqFields } from './faq-fields';
import { Status } from './status';

export type GapView = {
  id: number;
  question: string;
  timesAsked: number;
  status: 'open' | 'answered' | 'dismissed';
  lastAskedLabel: string;
  resolvedFaqId: number | null;
};

function AnswerForm({ gap, onClose }: { gap: GapView; onClose: () => void }) {
  const base = useId();
  const [draft, setDraft] = useState<FaqDraft>({ question: gap.question, alternatives: '', answer: '', tags: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await answerGapAction({ gapId: gap.id, ...draft, enabled: true });
      if (result.ok) onClose();
      else {
        setError(result.error);
        setFieldErrors(result.fieldErrors);
      }
    } catch {
      setError('The answer could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-line bg-bone/40 p-4">
      <p className="text-base sm:text-sm text-mute">
        This becomes an instant FAQ. The visitor&apos;s own words are kept as another way of asking it.
      </p>
      <FaqFields idBase={base} value={draft} onChange={setDraft} errors={fieldErrors} />
      <Status tone="bad">{error}</Status>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save as an FAQ'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** One question the bot could not answer. Open ones can be answered inline or dismissed. */
export function GapItem({ gap }: { gap: GapView }) {
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dismiss() {
    if (busy || !window.confirm('Dismiss this question? It will move out of the waiting list.')) return;
    setBusy(true);
    setError(null);
    try {
      const result = await dismissGapAction({ gapId: gap.id });
      if (!result.ok) setError(result.error);
    } catch {
      setError('That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="m-3 min-w-0 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-semibold">{gap.question}</p>
          <p className="mt-1 text-base sm:text-sm text-mute">
            Asked {gap.timesAsked} {gap.timesAsked === 1 ? 'time' : 'times'}, last on {gap.lastAskedLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {gap.status === 'answered' ? (
            <Badge tone="good">Answered{gap.resolvedFaqId ? ` by FAQ ${gap.resolvedFaqId}` : ''}</Badge>
          ) : null}
          {gap.status === 'dismissed' ? <Badge tone="neutral">Dismissed</Badge> : null}
          {gap.status === 'open' && !writing ? (
            <>
              <Button size="sm" onClick={() => setWriting(true)}>
                Write the answer
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
                Dismiss
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <Status tone="bad">{error}</Status>
      {writing && gap.status === 'open' ? <AnswerForm gap={gap} onClose={() => setWriting(false)} /> : null}
    </li>
  );
}
