'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { ScrollTrigger } from '@/lib/motion/gsap';

let instance: Lenis | null = null;
export const getLenis = () => instance;

/** Fine pointers only; phones keep native momentum scrolling. */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      '(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      () => {
        const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, autoRaf: false });
        instance = lenis;
        lenis.on('scroll', ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        return () => {
          gsap.ticker.remove(tick);
          lenis.destroy();
          instance = null;
        };
      },
    );
    return () => media.revert();
  }, []);

  // A new page always starts at the top (Lenis owns scrolling, so reset it explicitly).
  useEffect(() => {
    instance?.scrollTo(0, { immediate: true, force: true });
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
