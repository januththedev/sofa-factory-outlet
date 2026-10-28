'use client';

import { useState } from 'react';
import { setDocumentEnabledAction } from '@/app/admin/(panel)/knowledge/actions';
import { Switch } from './switch';

/** Turns a document on or off for the chatbot. Off documents stay stored but are never searched. */
export function DocumentSwitch({ id, title, enabled }: { id: number; title: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next);
    setBusy(true);
    setError(null);
    try {
      const result = await setDocumentEnabledAction({ id, enabled: next });
      if (!result.ok) {
        setOn(!next);
        setError(result.error);
      }
    } catch {
      setOn(!next);
      setError('The switch could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Switch checked={on} onChange={change} label={`Use ${title} in chat answers`} disabled={busy} />
      <span className="text-xs text-mute">{on ? 'On' : 'Off'}</span>
      {error ? (
        <span role="status" aria-live="polite" className="text-xs text-bad">
          {error}
        </span>
      ) : null}
    </div>
  );
}
