'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useFinePointer, usePrefersReducedMotion } from '@/lib/motion/hooks';

/** Dot + ring cursor. The ring grows over links and turns into a "View" bubble over [data-cursor="view"]. */
export function Cursor() {
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const active = fine && !reduced;
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active || !dot.current || !ring.current) return;
    document.documentElement.classList.add('has-cursor');
    const dotX = gsap.quickTo(dot.current, 'x', { duration: 0.08, ease: 'power3' });
    const dotY = gsap.quickTo(dot.current, 'y', { duration: 0.08, ease: 'power3' });
    const ringX = gsap.quickTo(ring.current, 'x', { duration: 0.45, ease: 'power3' });
    const ringY = gsap.quickTo(ring.current, 'y', { duration: 0.45, ease: 'power3' });
    gsap.set([dot.current, ring.current], { xPercent: -50, yPercent: -50, opacity: 0 });

    let visible = false;
    const move = (event: PointerEvent) => {
      if (!visible) {
        visible = true;
        gsap.to([dot.current, ring.current], { opacity: 1, duration: 0.3 });
      }
      dotX(event.clientX);
      dotY(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);

      const el = (event.target as Element | null)?.closest<HTMLElement>('[data-cursor], a, button, [role="button"], input, textarea, select');
      const mode = el?.dataset.cursor ?? (el ? 'link' : 'default');
      const view = mode === 'view';
      gsap.to(ring.current, {
        width: view ? 88 : mode === 'link' ? 56 : 36,
        height: view ? 88 : mode === 'link' ? 56 : 36,
        backgroundColor: view ? 'rgba(132,35,35,1)' : 'rgba(132,35,35,0)',
        borderColor: view ? 'rgba(132,35,35,1)' : 'rgba(20,18,17,0.55)',
        duration: 0.35,
        ease: 'power3.out',
        overwrite: 'auto',
      });
      gsap.to(label.current, { opacity: view ? 1 : 0, scale: view ? 1 : 0.6, duration: 0.25, overwrite: 'auto' });
      gsap.to(dot.current, { scale: view ? 0 : 1, duration: 0.2, overwrite: 'auto' });
    };
    const leave = () => {
      visible = false;
      gsap.to([dot.current, ring.current], { opacity: 0, duration: 0.2 });
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      document.documentElement.classList.remove('has-cursor');
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [active]);

  if (!active) return null;
  return (
    <>
      <div ref={ring} aria-hidden className="cursor-ring">
        <span ref={label} className="cursor-label">
          View
        </span>
      </div>
      <div ref={dot} aria-hidden className="cursor-dot" />
    </>
  );
}
