'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/motion/gsap';
import { MOTION_ANY } from '@/lib/motion/gsap';
import { ScrollTrigger } from '@/lib/motion/gsap';

const ITEMS = [
  'Sofas',
  'L-shape',
  'U-shape',
  'Sofa sets',
  'Beds',
  'Cushions',
  'Made in Colombo',
  'Factory prices',
  'Custom colours',
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <li key={item} className="flex items-center whitespace-nowrap">
          <span
            className="px-5 font-display text-[clamp(2.2rem,6vw,5.2rem)] font-light italic
              leading-none tracking-tight lg:px-7"
          >
            {item}
          </span>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-maroon" />
        </li>
      ))}
    </ul>
  );
}

/** An endless category strip, paused off screen, in hidden tabs and with reduced motion. */
export function Marquee() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_ANY, () => {
      const loop = gsap.to(track.current, {
        xPercent: -50,
        ease: 'none',
        duration: 55,
        repeat: -1,
        paused: true,
      });
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
          loop.timeScale(1 + Math.min(Math.abs(self.getVelocity()) / 450, 5));
          gsap.to(loop, { timeScale: 1, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
        },
      });
      return () => {
        trigger.kill();
        gsap.killTweensOf(loop);
        loop.kill();
        observer.disconnect();
        document.removeEventListener('visibilitychange', updateActivity);
      };
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div
      ref={root}
      className="w-full min-w-0 max-w-full overflow-hidden border-y border-line bg-bone py-4 lg:py-9"
      role="presentation"
    >
      <div ref={track} className="flex w-max will-change-transform">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
