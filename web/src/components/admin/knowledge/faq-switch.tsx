'use client';

import { useState } from 'react';
import { setFaqEnabledAction } from '@/app/admin/(panel)/knowledge/actions';
import { Switch } from './switch';

/** Turns one FAQ on or off. Off FAQs are kept but never used for instant answers. */
export function FaqSwitch({ id, question, enabled }: { id: number; question: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next);
    setBusy(true);
    setError(null);
    try {
      const result = await setFaqEnabledAction({ id, enabled: next });
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
      <Switch checked={on} onChange={change} label={`Use the FAQ "${question}" in chat answers`} disabled={busy} />
      {error ? (
        <span role="status" aria-live="polite" className="text-xs text-bad">
          {error}
        </span>
      ) : null}
    </div>
  );
}
