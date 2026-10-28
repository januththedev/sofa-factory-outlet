'use client';

import { Pencil, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { deleteFaqAction, saveFaqAction } from '@/app/admin/(panel)/knowledge/actions';
import { Button } from '@/components/ui/button';
import { type FaqDraft, FaqFields } from './faq-fields';
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

function FaqForm({ faq, onDone }: { faq?: FaqFormValues; onDone: () => void }) {
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
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await saveFaqAction({ id: faq?.id, ...draft, enabled });
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

  async function remove() {
    if (!faq) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteFaqAction({ id: faq.id });
      if (result.ok) onDone();
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Use this FAQ in chat answers
      </label>
      <Status tone="bad">{error}</Status>
      <div className="flex flex-wrap items-center gap-3">
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
          <span className="ml-auto flex items-center gap-2 text-sm">
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
  return (
    <>
      <Button size="sm" variant={faq ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>
        {faq ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        {faq ? 'Edit' : 'Add an FAQ'}
        {faq ? <span className="sr-only"> {faq.question}</span> : null}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={faq ? 'Edit FAQ' : 'Add an FAQ'}>
        <FaqForm faq={faq} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
