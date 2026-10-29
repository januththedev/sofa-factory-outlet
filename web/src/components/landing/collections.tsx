'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import type { CollectionTile } from '@/lib/catalogue/cached';
import { gsap } from '@/lib/motion/gsap';
import { useDesktopMotion } from './device-hooks';
import { SwipeRail } from './swipe-rail';

export function Collections({ tiles }: { tiles: CollectionTile[] }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const pinned = useDesktopMotion();

  useGSAP(() => {
    const el = track.current;
    if (!el || !pinned) return;
    const distance = () => Math.max(0, el.scrollWidth - el.clientWidth);
    if (distance() === 0) return;
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
  }, { scope: root, dependencies: [tiles.length, pinned], revertOnUpdate: true });

  return (
    <section
      ref={root}
      aria-labelledby="collections-heading"
      data-pinned={pinned}
      className="overflow-hidden bg-bone-2 py-10 data-[pinned=true]:flex data-[pinned=true]:min-h-svh
        data-[pinned=true]:flex-col data-[pinned=true]:justify-center data-[pinned=true]:py-24"
    >
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-3 lg:gap-6">
          <div>
            <p className="eyebrow text-xs">Collections</p>
            <h2
              id="collections-heading"
              className="mt-3 text-[clamp(2rem,5.2vw,5rem)] font-light leading-[1]"
            >
              Find your shape.
            </h2>
          </div>
          <TLink
            href="/shop/"
            className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            See everything
          </TLink>
        </div>
        <SwipeRail
          label="Collections"
          pinned={pinned}
          trackRef={track}
          trackClassName={pinned ? 'flex gap-5 lg:gap-8' : ''}
          className="mt-5 lg:mt-12"
        >
          {tiles.map((tile, index) => (
            <li key={tile.id} className="w-[86%] shrink-0 snap-start sm:w-[46%] lg:w-[27vw] xl:w-[23vw]">
              <TLink href={tile.href} data-cursor="view" className="group block min-h-11 min-w-11">
                <div
                  className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]
                    bg-paper lg:aspect-[4/5]"
                >
                  {tile.image ? (
                    <Picture
                      data={tile.image}
                      sizes="(min-width: 1280px) 23vw, (min-width: 1024px) 27vw, (min-width: 640px) 42vw, 78vw"
                      imgClassName={`h-full w-full ${tile.image.cutout
                        ? 'object-contain mix-blend-multiply'
                        : 'object-cover'}`}
                    />
                  ) : null}
                  <span
                    className="absolute left-3 top-3 rounded-full bg-bone/90 px-3 py-1 text-xs
                      font-semibold uppercase tracking-wider"
                  >
                    {tile.count} {tile.count === 1 ? 'piece' : 'pieces'}
                  </span>
                  <span className="absolute bottom-3 right-3 font-display text-2xl text-ink/50">
                    0{index + 1}
                  </span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3 lg:mt-5">
                  <div>
                    <h3 className="font-display text-2xl leading-tight lg:text-3xl">{tile.name}</h3>
                    <p className="mt-2 max-w-[28ch] text-base leading-snug text-mute">{tile.blurb}</p>
                  </div>
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/20
                      transition-colors duration-300 group-hover:bg-ink group-hover:text-bone
                      group-focus-visible:bg-ink group-focus-visible:text-bone"
                  >
                    →
                  </span>
                </div>
              </TLink>
            </li>
          ))}
          <li className="w-[86%] shrink-0 snap-start sm:w-[46%] lg:w-[27vw] xl:w-[23vw]">
            <TLink
              href="/book-visit/"
              className="flex aspect-[4/3] min-h-11 min-w-11 flex-col justify-between
                rounded-[var(--radius-card)] bg-maroon p-5 text-bone transition-colors duration-300
                hover:bg-maroon-deep lg:aspect-[4/5] lg:p-7"
            >
              <p className="eyebrow text-xs text-bone/80">Not on the list?</p>
              <div>
                <p className="font-display text-3xl font-light leading-[1.05] lg:text-5xl">
                  More in the showroom, and made to measure.
                </p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                  Book a visit <span aria-hidden>→</span>
                </p>
              </div>
            </TLink>
          </li>
        </SwipeRail>
      </div>
    </section>
  );
}
