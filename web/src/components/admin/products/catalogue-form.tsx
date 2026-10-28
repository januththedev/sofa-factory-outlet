'use client';

import { useState } from 'react';

type Result = { ok: boolean; error?: string };

export function CatalogueForm({
  action,
  deleteAction,
  confirm,
  children,
  ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> & {
  action: (data: FormData) => Promise<Result>;
  deleteAction?: (data: FormData) => Promise<Result>;
  confirm?: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const deleting = submitter instanceof HTMLElement && submitter.dataset.delete === 'true';
    const warning = confirm ?? (deleting ? 'Delete this colour rule? This cannot be undone.' : undefined);
    if (warning && !window.confirm(warning)) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage('Saving…');
    try {
      const result = await (deleting && deleteAction ? deleteAction : action)(data);
      setMessage(result.ok ? 'Saved.' : result.error || 'This could not be saved. Check the fields and try again.');
    } catch {
      setMessage('This could not be saved. Your changes are kept. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form {...props} onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      <p role="status" aria-live="polite" className="col-span-full text-base">{message}</p>
    </form>
  );
}
