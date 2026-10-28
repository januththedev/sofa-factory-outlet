'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/cn';

/** A modal dialog on the native <dialog> element: focus is trapped and Escape closes it. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-0 m-auto max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto',
        'rounded-[var(--radius-card)] border border-line bg-paper p-0 text-ink backdrop:bg-ink/40',
      )}
    >
      {open ? (
        <div>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <h2 id={titleId} className="font-display text-xl">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-mute hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
