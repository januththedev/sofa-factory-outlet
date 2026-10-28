'use client';

import { cn } from '@/lib/cn';

/** An on/off switch. `label` is read out by screen readers, for example "Enable Delivery". */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[""]',
        'disabled:opacity-60 motion-reduce:transition-none',
        checked ? 'bg-good' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-paper shadow transition-transform',
          'motion-reduce:transition-none',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
