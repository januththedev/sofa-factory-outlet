'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { formatCounterText } from './counter-text';

type CountUpProps = {
  value: number;
  /** Desktop pinned steps replay on activation; native rails count once on entering view. */
  active?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
};

/** The server and every interrupted animation show the final, factual value. */
export function CountUp({ value, active, prefix = '', suffix = '', className, duration = 1.6 }: CountUpProps) {
  const el = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const played = useRef(false);
  const finalText = formatCounterText(value, prefix, suffix);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    node.textContent = finalText;
    let tween: ReturnType<typeof gsap.to> | undefined;
    const finish = () => {
      tween?.kill();
      node.textContent = finalText;
    };
    // Read the query as well so hydration cannot briefly animate reduced-motion visitors.
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches || active === false) {
      finish();
      return;
    }
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.4);
      if (!visible || document.hidden) {
        finish();
        return;
      }
      if (played.current && active === undefined) return;
      played.current = true;
      const counter = { value: 0 };
      tween = gsap.to(counter, {
        value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          node.textContent = formatCounterText(counter.value, prefix, suffix);
        },
        onComplete: () => {
          node.textContent = finalText;
        },
        onInterrupt: () => {
          node.textContent = finalText;
        },
      });
    }, { threshold: 0.4 });
    const onVisibilityChange = () => {
      if (document.hidden) finish();
    };
    observer.observe(node);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      finish();
    };
  }, [active, value, prefix, suffix, duration, reduced, finalText]);

  return (
    <span className={`inline-grid tabular-nums ${className ?? ''}`}>
      <span className="sr-only">{finalText}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1">{finalText}</span>
      <span ref={el} aria-hidden className="col-start-1 row-start-1">{finalText}</span>
    </span>
  );
}
