import type { LineError } from '@/lib/admin/knowledge';
import { cn } from '@/lib/cn';

/** A message under a form or button. The wrapper stays mounted so screen readers announce text that appears later. */
export function Status({ tone = 'info', children }: { tone?: 'good' | 'bad' | 'info'; children?: React.ReactNode }) {
  return (
    <div aria-live="polite">
      {children ? (
        <p
          className={cn(
            'rounded-xl px-4 py-3 text-sm',
            tone === 'good' && 'bg-good/10 text-good',
            tone === 'bad' && 'bg-bad/10 text-bad',
            tone === 'info' && 'bg-bone-2 text-ink-2',
          )}
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** Problems found in a file, one per line, with the line number when the checker knows it. */
export function ErrorList({ errors, title }: { errors: LineError[]; title?: string }) {
  return (
    <div role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
      <p className="font-semibold">{title ?? 'This file cannot be used yet. Please fix:'}</p>
      <ul className="mt-2 space-y-1">
        {errors.map((error, index) => (
          <li key={`${error.line ?? 'x'}-${index}`}>
            {error.line ? <span className="font-semibold">Line {error.line}: </span> : null}
            {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
