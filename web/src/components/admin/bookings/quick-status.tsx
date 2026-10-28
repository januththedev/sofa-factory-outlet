'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { BoundAction } from './types';

export function QuickStatus({
  action,
  target,
  label,
}: {
  action: BoundAction;
  target: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="min-w-0">
      <input type="hidden" name="status" value={target} />
      <Button type="submit" disabled={pending} className="w-full whitespace-normal px-3">
        {pending ? 'Saving…' : label}
      </Button>
      <p
        aria-live="polite"
        className={state?.error ? 'mt-2 text-base text-bad sm:text-sm' : 'mt-2 text-base text-good sm:text-sm'}
      >
        {state?.error ?? state?.message}
      </p>
    </form>
  );
}
