'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Puts the plain-text version of the report on the clipboard, ready to paste into a message or an email. */
export function CopyReportButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('done');
    } catch {
      setState('failed');
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={copy}>
        Copy as text
      </Button>
      <span role="status" aria-live="polite" className={state === 'failed' ? 'text-sm text-bad' : 'text-sm text-good'}>
        {state === 'done' ? 'Copied.' : state === 'failed' ? 'Could not copy. Select the text below instead.' : ''}
      </span>
    </>
  );
}
