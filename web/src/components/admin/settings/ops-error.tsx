'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function OpsError({ reset }: { reset: () => void }) {
  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-5">
      <h1 className="font-display text-2xl">This page could not be loaded</h1>
      <p role="status" aria-live="polite">Check your connection and try again. Your saved work is kept.</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/admin/" className="btn btn-ghost min-h-11 min-w-11">Back to admin</Link>
      </div>
    </section>
  );
}
