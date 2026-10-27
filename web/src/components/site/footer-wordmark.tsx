'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, MOTION_ANY, ScrollTrigger } from '@/lib/motion/gsap';

/** Oversized simplified wordmark; each letter rises into place as the footer scrolls into view. */
export function FooterWordmark() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_ANY, () => {
        gsap.from('[data-letter]', {
          yPercent: 105,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.04,
          scrollTrigger: { trigger: root.current, start: 'top 92%', once: true },
        });
        ScrollTrigger.refresh();
      });
    },
    { scope: root },
  );

  const letters = 'SOFA FACTORY OUTLET'.split('');
  return (
    <div ref={root} className="mt-16 overflow-hidden lg:mt-24" aria-hidden>
      <p className="flex justify-between font-display text-[clamp(2.6rem,10.6vw,10.5rem)] font-light uppercase leading-[0.9] tracking-tight text-bone/95 select-none">
        {letters.map((letter, index) => (
          <span key={index} className="inline-block overflow-hidden pb-[0.08em]">
            <span data-letter className="inline-block">
              {letter === ' ' ? ' ' : letter}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
