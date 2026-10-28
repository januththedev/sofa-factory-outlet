'use client';

import { useId } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

type LazyMapProps = {
  title: string;
  src: string;
  className?: string;
};

/** No third-party request is made until the visitor chooses to show the map. */
export function LazyMap({ title, src, className }: LazyMapProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn('overflow-hidden rounded-[var(--radius-card)] bg-bone-2', className)}>
      <div className="relative aspect-[4/3] w-full sm:aspect-video">
        {visible ? (
          <>
            <p role="status" className="absolute left-4 top-4 bg-paper px-3 py-2 text-sm text-ink-2">
              {loaded ? 'Map loaded. You can also open it in Maps below.' : 'Loading the map…'}
            </p>
            <iframe
              id={id}
              title={title}
              src={src}
              onLoad={() => setLoaded(true)}
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="max-w-[40ch] text-base leading-relaxed text-ink-2">
              {title}. Google Maps loads only when you choose to show it.
            </p>
            <button
              type="button"
              onClick={() => setVisible(true)}
              className="btn-primary min-h-11 min-w-11 w-full px-6 py-3 sm:w-auto"
            >
              Show the map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
