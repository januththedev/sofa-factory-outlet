'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { Picture } from '@/components/picture';
import { Magnetic } from '@/components/site/magnetic';
import { TLink } from '@/components/site/transition';
import type { PictureData } from '@/lib/images/urls';
import { PRELOADER_DONE_EVENT } from '@/lib/motion/boot';
import { gsap, MOTION_ANY, REDUCED, SplitText } from '@/lib/motion/gsap';
import { HeroRipple } from './hero-ripple';

export function Hero({ picture, textureUrl }: { picture: PictureData; textureUrl: string }) {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = title.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION_ANY, () => {
        let split: SplitText | undefined;
        const play = () => {
          split = SplitText.create(el, {
            type: 'lines',
            mask: 'lines',
            linesClass: 'split-line',
            autoSplit: true,
            onSplit: (self) => {
              gsap.set(el, { opacity: 1 });
              return gsap.from(self.lines, { yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: 0.12 });
            },
          });
          gsap.from('[data-hero-fade]', { opacity: 0, y: 24, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.55 });
        };
        // Wait for the preloader on a first visit; start at once otherwise.
        if (document.documentElement.dataset.preloaded) play();
        else window.addEventListener(PRELOADER_DONE_EVENT, play, { once: true });
        return () => {
          window.removeEventListener(PRELOADER_DONE_EVENT, play);
          split?.revert();
        };
      });

      mm.add(REDUCED, () => {
        gsap.set(el, { opacity: 1 });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="hero-title" className="relative isolate min-h-[100svh] overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0 -z-10">
        <Picture data={picture} sizes="100vw" priority placeholder={false} imgClassName="h-full w-full object-cover" />
        <HeroRipple src={textureUrl} />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/50 via-45% to-ink/10" />

      <div className="site-container flex min-h-[100svh] flex-col justify-end pb-10 pt-36 lg:pb-14">
        <p data-hero-fade className="eyebrow mb-6 text-bone/90">
          Sofa Factory Outlet · Colombo, Sri Lanka
        </p>
        <h1 id="hero-title" ref={title} className="reveal-title max-w-[16ch] text-[clamp(2.9rem,9.4vw,9.75rem)] font-light leading-[0.94]">
          Sofas in Sri Lanka, straight from the factory floor.
        </h1>
        <div className="mt-9 grid items-end gap-8 lg:mt-12 lg:grid-cols-12">
          <p data-hero-fade className="max-w-md text-lg leading-relaxed text-bone/85 lg:col-span-5">
            Made in our own Colombo workshop and sold without a middleman. Sit on it, then decide.
          </p>
          <div data-hero-fade className="flex flex-wrap gap-3 lg:col-span-7 lg:justify-end">
            <Magnetic>
              <TLink href="/shop/" className="btn bg-bone px-7 py-4 text-ink hover:bg-clay">
                Explore the collection
              </TLink>
            </Magnetic>
            <TLink href="/book-visit/" className="btn border border-bone/40 px-7 py-4 text-bone hover:bg-bone hover:text-ink">
              Book a visit
            </TLink>
          </div>
        </div>
      </div>
    </section>
  );
}
