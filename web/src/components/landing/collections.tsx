'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import type { CollectionTile } from '@/lib/catalogue/cached';
import { gsap, MOTION_DESKTOP } from '@/lib/motion/gsap';

export function Collections({ tiles }: { tiles: CollectionTile[] }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);

  // Desktop with motion: pin the section and scrub the rail sideways. Elsewhere it is a native swipe rail.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_DESKTOP, () => {
        const el = track.current;
        if (!el) return;
        const distance = () => Math.max(0, el.scrollWidth - window.innerWidth + 96);
        gsap.to(el, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
      });
    },
    { scope: root, dependencies: [tiles.length] },
  );

  return (
    <section ref={root} aria-labelledby="collections-heading" className="collections bg-bone-2 py-24 lg:py-0">
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Collections</p>
            <h2 id="collections-heading" className="mt-4 text-[clamp(2.4rem,5.2vw,5rem)] font-light leading-[1]">
              Find your shape.
            </h2>
          </div>
          <TLink href="/shop/" className="link-underline hidden text-sm font-semibold uppercase tracking-[0.14em] sm:inline-block">
            See everything
          </TLink>
        </div>
      </div>

      <div className="rail mt-12 lg:mt-14">
        <ul ref={track} className="flex w-max gap-5 px-5 sm:px-8 lg:gap-8 lg:px-12">
          {tiles.map((tile, index) => (
            <li key={tile.id} className="w-[76vw] shrink-0 snap-start sm:w-[44vw] lg:w-[27vw] xl:w-[23vw]">
              <TLink href={tile.href} data-cursor="view" className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-paper">
                  {tile.image ? (
                    <Picture
                      data={tile.image}
                      sizes="(min-width: 1280px) 23vw, (min-width: 1024px) 27vw, (min-width: 640px) 44vw, 76vw"
                      imgClassName={`h-full w-full ${tile.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'} transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
                    />
                  ) : null}
                  <span className="absolute left-4 top-4 rounded-full bg-bone/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider">
                    {tile.count} {tile.count === 1 ? 'piece' : 'pieces'}
                  </span>
                  <span className="absolute bottom-4 right-4 font-display text-2xl text-ink/30">0{index + 1}</span>
                </div>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-2xl leading-tight lg:text-3xl">{tile.name}</h3>
                    <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-mute">{tile.blurb}</p>
                  </div>
                  <span aria-hidden className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/20 transition-colors duration-300 group-hover:bg-ink group-hover:text-bone">
                    →
                  </span>
                </div>
              </TLink>
            </li>
          ))}
          <li className="w-[76vw] shrink-0 snap-start sm:w-[44vw] lg:w-[27vw] xl:w-[23vw]">
            <TLink href="/book-visit/" className="flex aspect-[4/5] flex-col justify-between rounded-[var(--radius-card)] bg-maroon p-7 text-bone transition-colors hover:bg-maroon-deep">
              <p className="eyebrow text-bone/70">Not on the list?</p>
              <div>
                <p className="font-display text-4xl font-light leading-[1.05] lg:text-5xl">More in the showroom, and made to measure.</p>
                <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em]">
                  Book a visit <span aria-hidden>→</span>
                </p>
              </div>
            </TLink>
          </li>
        </ul>
      </div>
    </section>
  );
}
