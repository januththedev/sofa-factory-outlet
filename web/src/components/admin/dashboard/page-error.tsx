'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

export function AdminPageError({ retry }: { retry?: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <section role="alert" className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
      <h1 className="font-display text-2xl">This page could not be loaded</h1>
      <p className="mt-3 text-base text-mute">Please try again. Your saved records are still there.</p>
      <Button
        className="mt-5"
        disabled={pending}
        onClick={() => startTransition(() => {
          if (retry) retry();
          else window.location.reload();
        })}
      >
        {pending ? 'Trying again…' : 'Try again'}
      </Button>
    </section>
  );
}
