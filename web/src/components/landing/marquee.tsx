'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, MOTION_ANY, ScrollTrigger } from '@/lib/motion/gsap';

const ITEMS = ['Sofas', 'L-shape', 'U-shape', 'Sofa sets', 'Beds', 'Cushions', 'Made in Colombo', 'Factory prices', 'Custom colours'];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...ITEMS, ...ITEMS].map((item, index) => (
        <li key={index} className="flex items-center whitespace-nowrap">
          <span className="px-7 font-display text-[clamp(2.2rem,6vw,5.2rem)] font-light italic leading-none tracking-tight">{item}</span>
          <span className="h-2.5 w-2.5 rounded-full bg-maroon" />
        </li>
      ))}
    </ul>
  );
}

/** Endless category strip. It speeds up with scroll velocity. */
export function Marquee() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_ANY, () => {
        const loop = gsap.to(track.current, { xPercent: -50, ease: 'none', duration: 55, repeat: -1, paused: true });
        let onScreen = false;
        const updateActivity = () => loop.paused(!onScreen || document.hidden);
        const observer = new IntersectionObserver(([entry]) => {
          onScreen = entry.isIntersecting;
          updateActivity();
        });
        if (root.current) observer.observe(root.current);
        document.addEventListener('visibilitychange', updateActivity);
        const trigger = ScrollTrigger.create({
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            const velocity = self.getVelocity();
            // Speed up while scrolling, then ease back to the idle pace.
            loop.timeScale(1 + Math.min(Math.abs(velocity) / 450, 5));
            gsap.to(loop, { timeScale: 1, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
          },
        });
        return () => {
          trigger.kill();
          loop.kill();
          observer.disconnect();
          document.removeEventListener('visibilitychange', updateActivity);
        };
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="overflow-hidden border-y border-line bg-bone py-6 lg:py-9" role="presentation">
      <div ref={track} className="flex w-max will-change-transform">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
