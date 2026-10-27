'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';

type CountUpProps = {
  value: number;
  /** Counts again each time this flips from false to true (pinned story steps). Omit to count once on first view. */
  active?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
};

const format = (n: number) => Math.round(n).toLocaleString('en-US');

/** A number that counts up from zero. Reduced motion just shows the final value. */
export function CountUp({ value, active, prefix = '', suffix = '', className, duration = 1.6 }: CountUpProps) {
  const el = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const played = useRef(false);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (reduced) {
      node.textContent = `${prefix}${format(value)}${suffix}`;
      return;
    }

    const run = () => {
      const counter = { n: 0 };
      return gsap.to(counter, {
        n: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          node.textContent = `${prefix}${format(counter.n)}${suffix}`;
        },
      });
    };

    if (active !== undefined) {
      if (!active) {
        node.textContent = `${prefix}0${suffix}`;
        return;
      }
      const tween = run();
      return () => {
        tween.kill();
      };
    }

    // No `active` prop: count once, when scrolled into view.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !played.current) {
          played.current = true;
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    node.textContent = `${prefix}0${suffix}`;
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, value, prefix, suffix, duration, reduced]);

  return (
    <span ref={el} className={className} aria-label={`${prefix}${format(value)}${suffix}`}>
      {prefix}
      {format(value)}
      {suffix}
    </span>
  );
}
