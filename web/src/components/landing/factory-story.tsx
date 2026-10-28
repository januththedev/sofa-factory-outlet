'use client';

import { useRef } from 'react';
import { useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/motion/gsap';
import { ScrollTrigger } from '@/lib/motion/gsap';
import { CountUp } from './count-up';
import { useDesktopMotion } from './device-hooks';
import { FACTORY_ART } from './factory-art';
import { SwipeRail } from './swipe-rail';

// These claims come from the captured site and remain subject to the owner's confirmation.
const STEPS = [
  {
    title: 'Frame',
    body: 'Every sofa starts as a strong wooden frame, cut and joined in our own workshop, '
      + 'built for Sri Lanka’s humid climate.',
    fact: { value: 10, suffix: '-year', label: 'structural warranty' },
  },
  {
    title: 'Foam',
    body: 'High-density foam goes into every seat and back, so cushions stay supportive '
      + 'and keep their shape for years.',
    fact: { text: 'High-density', label: 'foam in every cushion' },
  },
  {
    title: 'Fabric',
    body: 'Choose from durable fabrics, velvet, corduroy and leather. Tell us the colour '
      + 'and the design and we make it your way.',
    fact: { value: 1000, suffix: '+', label: 'colours and designs' },
  },
  {
    title: 'Finish',
    body: 'Skilled hands stitch, check and finish each piece, and we deliver it island-wide '
      + 'with support for repairs and adjustments.',
    fact: { value: 10, suffix: '–15', label: 'working days to deliver' },
  },
] as const;

export function FactoryStory() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const pinned = useDesktopMotion();

  useGSAP(() => {
    if (!pinned) return;
    const steps = gsap.utils.toArray<HTMLElement>('[data-step]');
    const arts = gsap.utils.toArray<HTMLElement>('[data-art]');
    const draws = arts.map((art) => Array.from(art.querySelectorAll<SVGPathElement>('[data-draw]')));
    const fades = arts.map((art) => Array.from(art.querySelectorAll<SVGElement>('[data-fade]')));

    gsap.set(steps.slice(1), { opacity: 0, y: 40 });
    gsap.set(arts.slice(1), { opacity: 0 });
    draws.forEach((paths, index) => {
      gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: index === 0 ? 0 : 1 });
    });
    fades.forEach((nodes, index) => gsap.set(nodes, { opacity: index === 0 ? 1 : 0 }));

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root.current,
        start: 'top top',
        end: '+=340%',
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => setActive(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length))),
      },
    });
    gsap.set('[data-progress]', { scaleY: 0, transformOrigin: 'top' });
    tl.fromTo(draws[0], { strokeDashoffset: 1 }, {
      strokeDashoffset: 0,
      duration: 0.6,
      stagger: 0.05,
    }, 0);
    for (let index = 1; index < STEPS.length; index += 1) {
      tl.to(steps[index - 1], { opacity: 0, y: -40, duration: 0.35 }, index - 0.25);
      tl.to(arts[index - 1], { opacity: 0, duration: 0.35 }, index - 0.25);
      tl.to(steps[index], { opacity: 1, y: 0, duration: 0.4 }, index);
      tl.to(arts[index], { opacity: 1, duration: 0.3 }, index);
      tl.to(fades[index], { opacity: 1, duration: 0.3, stagger: 0.05 }, index);
      tl.to(draws[index], { strokeDashoffset: 0, duration: 0.6, stagger: 0.04 }, index);
    }
    tl.to('[data-progress]', { scaleY: 1, duration: STEPS.length - 0.25 }, 0);
    tl.to({}, { duration: 0.4 });
    ScrollTrigger.refresh();
  }, { scope: root, dependencies: [pinned], revertOnUpdate: true });

  return (
    <section
      ref={root}
      aria-labelledby="factory-heading"
      data-pinned={pinned}
      className="group/factory overflow-hidden bg-ink py-10 text-bone data-[pinned=true]:py-0"
    >
      <div
        className="site-container grid gap-5 group-data-[pinned=true]/factory:min-h-svh
          group-data-[pinned=true]/factory:grid-cols-12 group-data-[pinned=true]/factory:items-center
          group-data-[pinned=true]/factory:gap-6 group-data-[pinned=true]/factory:pb-12
          group-data-[pinned=true]/factory:pt-24"
      >
        <div className="min-w-0 group-data-[pinned=true]/factory:col-span-6">
          <p className="eyebrow text-xs text-clay">Straight from the factory floor</p>
          <h2
            id="factory-heading"
            className="mt-3 max-w-[14ch] text-[clamp(2rem,5.6vw,5.4rem)] font-light leading-[1]"
          >
            Four steps. One workshop. No middleman.
          </h2>
          <SwipeRail
            label="The four factory steps"
            pinned={pinned}
            className="mt-6"
            trackClassName={pinned ? 'min-h-[22rem]' : ''}
          >
            {STEPS.map((step, index) => {
              const Art = FACTORY_ART[index];
              return (
                <li
                  key={step.title}
                  className={pinned ? 'absolute inset-0' : `flex min-h-[400px] w-[92%] shrink-0
                    snap-start flex-col rounded-[var(--radius-card)] border border-bone/15 bg-bone/5 p-3
                    min-[360px]:w-[86%] sm:w-[62%] md:w-[48%]`}
                >
                  <div className={pinned ? 'hidden' : 'mb-2 h-40 shrink-0'} aria-hidden>
                    <Art />
                  </div>
                  <div data-step className="flex flex-1 flex-col">
                    <div className="flex items-baseline gap-3">
                      <p className="text-xs tracking-[0.14em] text-clay">0{index + 1} / 0{STEPS.length}</p>
                      <h3 className="text-3xl font-light group-data-[pinned=true]/factory:text-7xl">
                        {step.title}
                      </h3>
                    </div>
                    <p
                      className="mb-3 mt-2 max-w-md text-base leading-snug text-bone/75
                        group-data-[pinned=true]/factory:mt-5 group-data-[pinned=true]/factory:text-lg"
                    >
                      {step.body}
                    </p>
                    <p
                      className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-bone/15 pt-3
                        group-data-[pinned=true]/factory:mt-7 group-data-[pinned=true]/factory:pt-5"
                    >
                      <span className="font-display text-3xl text-clay group-data-[pinned=true]/factory:text-5xl">
                        {'value' in step.fact ? (
                          <CountUp
                            value={step.fact.value}
                            suffix={step.fact.suffix}
                            active={pinned ? active === index : undefined}
                          />
                        ) : step.fact.text}
                      </span>
                      <span className="text-xs text-bone/75">{step.fact.label}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </SwipeRail>
          <p className="mt-4 text-xs text-bone/70">Warranty and delivery terms are confirmed at your visit.</p>
        </div>
        <div
          aria-hidden
          className="relative hidden aspect-[4/3.4] group-data-[pinned=true]/factory:col-span-5
            group-data-[pinned=true]/factory:col-start-8 group-data-[pinned=true]/factory:block"
        >
          {FACTORY_ART.map((Art, index) => (
            <div
              key={index}
              data-art
              className="absolute inset-0 rounded-[var(--radius-card)] border border-bone/15 bg-bone/5 p-8"
            >
              <Art />
            </div>
          ))}
          <div className="absolute -right-7 bottom-0 top-0 w-0.5 bg-bone/15">
            <span data-progress className="block h-full w-full origin-top bg-clay" />
          </div>
        </div>
      </div>
    </section>
  );
}
