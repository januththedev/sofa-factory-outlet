'use client';

import { Flag, PenLine } from 'lucide-react';
import { useId, useState } from 'react';
import { flagMessageAction, writeFaqFromMessageAction } from '@/app/admin/(panel)/chat/actions';
import { type FaqDraft, FaqFields } from '@/components/admin/knowledge/faq-fields';
import { Modal } from '@/components/admin/knowledge/modal';
import { Status } from '@/components/admin/knowledge/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function WriteFaqForm({
  messageId,
  question,
  onDone,
}: {
  messageId: number;
  question: string;
  onDone: () => void;
}) {
  const base = useId();
  const [draft, setDraft] = useState<FaqDraft>({ question, alternatives: '', answer: '', tags: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await writeFaqFromMessageAction({ messageId, ...draft });
      if (result.ok) {
        onDone();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors);
      }
    } catch {
      setError('The FAQ could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-mute">
        Write the answer the bot should have given. It becomes an instant FAQ, and the answer in the transcript is
        flagged as wrong.
      </p>
      <FaqFields idBase={base} value={draft} onChange={setDraft} errors={fieldErrors} />
      <Status tone="bad">{error}</Status>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save FAQ and flag'}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** "Flag / write FAQ" for one assistant answer in a transcript. */
export function MessageActions({
  messageId,
  flagged,
  question,
}: {
  messageId: number;
  flagged: boolean;
  question: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const result = await flagMessageAction({ messageId, flagged: !flagged });
      if (!result.ok) setError(result.error);
    } catch {
      setError('That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {flagged ? <Badge tone="maroon">Flagged as wrong</Badge> : null}
        <Button size="sm" variant="ghost" onClick={toggle} disabled={busy}>
          <Flag className="size-4" aria-hidden="true" />
          {flagged ? 'Remove the flag' : 'Flag as wrong'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <PenLine className="size-4" aria-hidden="true" />
          Write an FAQ
        </Button>
      </div>
      <Status tone="bad">{error}</Status>
      <Modal open={open} onClose={() => setOpen(false)} title="Write an FAQ for this question">
        <WriteFaqForm messageId={messageId} question={question} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
