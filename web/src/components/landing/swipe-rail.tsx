'use client';

import type { ReactNode } from 'react';
import type { RefObject } from 'react';
import { useEffect } from 'react';
import { useId } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { railProgress } from './rail-progress';

type SwipeRailProps = {
  children: ReactNode;
  label: string;
  className?: string;
  trackClassName?: string;
  trackRef?: RefObject<HTMLUListElement | null>;
  pinned?: boolean;
  gridOnDesktop?: boolean;
};

/** Native scrolling stays usable before hydration; the bar also follows keyboard scrolling. */
export function SwipeRail({
  children,
  label,
  className = '',
  trackClassName = '',
  trackRef,
  pinned = false,
  gridOnDesktop = false,
}: SwipeRailProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const localTrack = useRef<HTMLUListElement>(null);
  const [progress, setProgress] = useState(0);
  const id = useId();
  const desktopGrid = gridOnDesktop ? 'lg:overflow-visible lg:snap-none' : '';
  const desktopTrack = gridOnDesktop ? 'lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-14' : '';

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    if (pinned) node.scrollLeft = 0;
    const update = () => setProgress(railProgress(node.scrollLeft, node.scrollWidth, node.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(node);
    const list = node.firstElementChild;
    if (list) observer.observe(list);
    node.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener('scroll', update);
    };
  }, [pinned, children]);

  return (
    <div className={`min-w-0 ${className}`}>
      <p
        id={id}
        className={`mb-3 text-xs ${pinned ? 'hidden' : ''} ${gridOnDesktop ? 'lg:hidden' : ''}`}
      >
        Swipe or scroll to explore <span aria-hidden>→</span>
      </p>
      <div
        ref={viewport}
        role="region"
        aria-label={label}
        aria-describedby={pinned ? undefined : id}
        tabIndex={pinned ? undefined : 0}
        data-lenis-prevent={pinned ? undefined : true}
        className={pinned
          ? 'overflow-visible'
          : `relative snap-x snap-mandatory overflow-x-auto overscroll-x-contain p-1.5 pb-3 ${desktopGrid}`}
      >
        <ul
          ref={trackRef ?? localTrack}
          className={`${pinned ? 'relative' : `flex gap-4 ${desktopTrack}`} ${trackClassName}`}
        >
          {children}
        </ul>
      </div>
      <div
        aria-hidden
        className={`mt-3 h-0.5 overflow-hidden bg-current/15 ${pinned ? 'hidden' : ''}
          ${gridOnDesktop ? 'lg:hidden' : ''}`}
      >
        <span
          className="block h-full origin-left bg-current"
          style={{ width: `${20 + progress * 80}%` }}
        />
      </div>
    </div>
  );
}
