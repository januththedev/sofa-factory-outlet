import { cn } from '@/lib/cn';

/** A short, honest note about something that is not known yet. Plain words, no jargon. */
export function Note({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[var(--radius-card)] border border-line bg-bone-2/70 p-6 lg:p-8', className)}>
      {label ? <p className="eyebrow">{label}</p> : null}
      <div className={cn('max-w-[62ch] leading-relaxed text-ink-2', label ? 'mt-3' : '')}>{children}</div>
    </div>
  );
}
