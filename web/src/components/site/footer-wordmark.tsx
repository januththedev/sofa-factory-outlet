'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/motion/gsap';
import { ScrollTrigger } from '@/lib/motion/gsap';

/** Oversized simplified wordmark; each letter rises into place as the footer scrolls into view. */
export function FooterWordmark() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-letter]', {
          yPercent: 105,
          duration: 0.3,
          ease: 'expo.out',
          stagger: 0.015,
          scrollTrigger: { trigger: root.current, start: 'top 92%', once: true },
        });
        ScrollTrigger.refresh();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const letters = 'SOFA FACTORY OUTLET'.split('');
  return (
    <div ref={root} className="mt-16 lg:mt-24" aria-hidden>
      <p
        className="font-display text-[clamp(2rem,8vw,5.5rem)] font-light uppercase leading-[1.1]
          tracking-tight text-bone/95 select-none lg:hidden"
      >
        <span className="block">SOFA FACTORY</span>
        <span className="block">OUTLET</span>
      </p>
      <p
        className="hidden whitespace-pre font-display text-[clamp(3rem,8vw,8rem)] font-light
          uppercase leading-[1.1] tracking-tight text-bone/95 select-none lg:flex"
      >
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
