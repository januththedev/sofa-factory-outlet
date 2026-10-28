'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useId } from 'react';
import { useRef } from 'react';
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto',
        'sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:w-[min(42rem,calc(100vw-2rem))] sm:max-w-2xl',
        'border border-line bg-paper p-0 text-ink backdrop:bg-ink/40 sm:rounded-[var(--radius-card)]',
      )}
    >
      {open ? (
        <div>
          <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-line bg-paper p-4">
            <h2 id={titleId} className="font-display text-xl">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid min-h-11 min-w-11 place-items-center rounded-full text-mute hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0 p-4 pb-28 sm:p-6 sm:pb-28">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
