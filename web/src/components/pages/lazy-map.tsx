'use client';

import { useNearViewport } from '@/lib/motion/hooks';

type LazyMapProps = {
  title: string;
  src: string;
  className?: string;
};

/** Google Maps embed that loads only when it comes near the viewport. */
export function LazyMap({ title, src, className }: LazyMapProps) {
  const [ref, near] = useNearViewport<HTMLDivElement>('500px');
  return (
    <div ref={ref} className={className ?? 'min-h-[22rem] overflow-hidden rounded-[var(--radius-card)] bg-bone-2'}>
      {near ? (
        <iframe
          title={title}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full min-h-[22rem] w-full border-0 grayscale-[0.35]"
        />
      ) : null}
    </div>
  );
}
