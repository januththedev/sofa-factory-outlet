'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { PRELOADER_DONE_EVENT, PRELOADER_KEY } from '@/lib/motion/boot';
import { gsap, MOTION_ANY } from '@/lib/motion/gsap';

/**
 * First visit only: a 0→100 counter, the logo mark revealed through a circular
 * mask, then the bone sheet lifts, followed by a maroon curtain. CSS hides the
 * whole thing for returning visitors, reduced motion and no-JS; this component
 * only plays the timeline.
 */
export function Preloader() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const finish = () => {
        try {
          sessionStorage.setItem(PRELOADER_KEY, '1');
        } catch {
          // storage blocked: the preloader simply plays again next time
        }
        el.style.display = 'none';
        document.documentElement.dataset.preloaded = '1';
        window.dispatchEvent(new Event(PRELOADER_DONE_EVENT));
      };

      if (document.documentElement.dataset.preloaded) {
        finish();
        return;
      }

      const mm = gsap.matchMedia();
      mm.add(MOTION_ANY, () => {
        const count = { value: 0 };
        const number = el.querySelector<HTMLElement>('[data-count]');
        const tl = gsap.timeline({ onComplete: finish });
        tl.fromTo('[data-mark]', { clipPath: 'circle(0% at 50% 50%)', scale: 0.88 }, { clipPath: 'circle(50% at 50% 50%)', scale: 1, duration: 1, ease: 'power3.inOut' }, 0)
          .to(
            count,
            {
              value: 100,
              duration: 1,
              ease: 'power2.inOut',
              onUpdate: () => {
                if (number) number.textContent = String(Math.round(count.value)).padStart(3, '0');
              },
            },
            0,
          )
          .to('[data-bar]', { scaleX: 1, duration: 1, ease: 'power2.inOut' }, 0)
          .to('[data-content]', { opacity: 0, y: -16, duration: 0.3, ease: 'power2.in' }, 1.05)
          .to('[data-bone]', { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, 1.15)
          .to('[data-maroon]', { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, 1.28);
        return () => tl.kill();
      });
      mm.add('(prefers-reduced-motion: reduce)', finish);
    },
    { scope: root },
  );

  return (
    <div ref={root} className="preloader" aria-hidden>
      <div data-maroon className="preloader-panel bg-maroon" />
      <div data-bone className="preloader-panel bg-bone text-ink">
        <div data-content className="grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-mark src="/brand/mark.png" alt="" width={144} height={144} className="h-36 w-36" />
          <div className="mt-8 h-px w-40 bg-ink/15">
            <span data-bar className="block h-full origin-left scale-x-0 bg-maroon" />
          </div>
        </div>
        <span data-count className="preloader-count">
          000
        </span>
      </div>
    </div>
  );
}
