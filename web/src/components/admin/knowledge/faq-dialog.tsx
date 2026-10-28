'use client';

import { Pencil } from 'lucide-react';
import { Plus } from 'lucide-react';
import { useId } from 'react';
import { useState } from 'react';
import { deleteFaqAction } from '@/app/admin/(panel)/knowledge/actions';
import { saveFaqAction } from '@/app/admin/(panel)/knowledge/actions';
import { Button } from '@/components/ui/button';
import type { FaqDraft } from './faq-fields';
import { FaqFields } from './faq-fields';
import { Modal } from './modal';
import { Status } from './status';

export type FaqFormValues = {
  id: number;
  question: string;
  alternatives: string[];
  answer: string;
  tags: string[];
  enabled: boolean;
};

function FaqForm({ faq, onDone, onSaved }: {
  faq?: FaqFormValues;
  onDone: () => void;
  onSaved: (message: string) => void;
}) {
  const base = useId();
  const [draft, setDraft] = useState<FaqDraft>({
    question: faq?.question ?? '',
    alternatives: faq?.alternatives.join('\n') ?? '',
    answer: faq?.answer ?? '',
    tags: faq?.tags.join(', ') ?? '',
  });
  const [enabled, setEnabled] = useState(faq?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await saveFaqAction({ id: faq?.id, ...draft, enabled });
      if (result.ok) {
        onSaved('FAQ saved.');
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

  async function remove() {
    if (!faq) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteFaqAction({ id: faq.id });
      if (result.ok) onSaved('FAQ deleted.');
      else setError(result.error);
    } catch {
      setError('The FAQ could not be deleted. Please try again.');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FaqFields idBase={base} value={draft} onChange={setDraft} errors={fieldErrors} />
      <label className="flex items-center gap-2 text-base sm:text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Use this FAQ in chat answers
      </label>
      <Status tone="bad">{error}</Status>
      <div data-sticky-bar className={
        'sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-line bg-paper p-3 '
        + 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
      }>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save FAQ'}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        {faq && !confirmDelete ? (
          <Button variant="link" onClick={() => setConfirmDelete(true)} disabled={busy} className="ml-auto text-bad">
            Delete this FAQ
          </Button>
        ) : null}
        {faq && confirmDelete ? (
          <span className="flex flex-wrap items-center gap-2 text-base sm:text-sm">
            Delete it for good?
            <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
              Yes, delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Keep it
            </Button>
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** A button that opens the add / edit dialog for one FAQ. Delete is inside the edit dialog. */
export function FaqDialog({ faq }: { faq?: FaqFormValues }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <>
      <Button size="sm" variant={faq ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>
        {faq ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        {faq ? 'Edit' : 'Add an FAQ'}
        {faq ? <span className="sr-only"> {faq.question}</span> : null}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={faq ? 'Edit FAQ' : 'Add an FAQ'}>
        <FaqForm faq={faq} onDone={() => setOpen(false)} onSaved={(message) => {
          setNotice(message);
          setOpen(false);
        }} />
      </Modal>
      <Status tone="good">{notice}</Status>
    </>
  );
}
