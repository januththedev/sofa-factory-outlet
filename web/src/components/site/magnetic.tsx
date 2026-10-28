'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/motion/gsap';

/** Pulls its child toward the pointer while it is nearby. Skipped on touch and for reduced motion. */
export function Magnetic({ children, strength = 0.3, className }: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const box = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = box.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const x = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' });
        const y = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3.out' });
        const move = (event: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          x((event.clientX - (rect.left + rect.width / 2)) * strength);
          y((event.clientY - (rect.top + rect.height / 2)) * strength);
        };
        const leave = () => {
          x(0);
          y(0);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        return () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerleave', leave);
          x.tween.kill();
          y.tween.kill();
        };
      });
      return () => mm.revert();
    },
    { scope: box },
  );

  return (
    <span ref={box} className={`inline-block ${className ?? ''}`}>
      {children}
    </span>
  );
}
