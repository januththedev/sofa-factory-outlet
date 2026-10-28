'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, MOTION_DESKTOP, ScrollTrigger } from '@/lib/motion/gsap';
import { CountUp } from './count-up';
import { FACTORY_ART } from './factory-art';

// Copy comes from the captured About page and product descriptions. The
// warranty, colour and delivery figures are claims the current site already
// makes; they stay flagged as "to confirm" in BUILD-STATUS.md.
const STEPS = [
  {
    title: 'Frame',
    body: 'Every sofa starts as a strong wooden frame, cut and joined in our own workshop, built for Sri Lanka’s humid climate.',
    fact: { value: 10, suffix: '-year', label: 'structural warranty' },
  },
  {
    title: 'Foam',
    body: 'High-density foam goes into every seat and back, so cushions stay supportive and keep their shape for years.',
    fact: { text: 'High-density', label: 'foam in every cushion' },
  },
  {
    title: 'Fabric',
    body: 'Choose from durable fabrics, velvet, corduroy and leather. Tell us the colour and the design and we make it your way.',
    fact: { value: 1000, suffix: '+', label: 'colours and designs' },
  },
  {
    title: 'Finish',
    body: 'Skilled hands stitch, check and finish each piece, and we deliver it island-wide with support for repairs and adjustments.',
    fact: { value: 10, suffix: '–15', label: 'working days to deliver' },
  },
] as const;

export function FactoryStory() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_DESKTOP, () => {
        const steps = gsap.utils.toArray<HTMLElement>('[data-step]');
        const arts = gsap.utils.toArray<HTMLElement>('[data-art]');
        const draws = arts.map((art) => Array.from(art.querySelectorAll<SVGPathElement>('[data-draw]')));
        const fades = arts.map((art) => Array.from(art.querySelectorAll<SVGElement>('[data-fade]')));

        gsap.set(steps.slice(1), { opacity: 0, y: 40 });
        gsap.set(arts.slice(1), { opacity: 0 });
        draws.forEach((paths, i) => gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: i === 0 ? 0 : 1 }));
        fades.forEach((nodes, i) => gsap.set(nodes, { opacity: i === 0 ? 1 : 0 }));

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
        // First: draw the first illustration as the section pins.
        tl.fromTo(draws[0], { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.05 }, 0);
        for (let i = 1; i < STEPS.length; i += 1) {
          const at = i;
          tl.to(steps[i - 1], { opacity: 0, y: -40, duration: 0.35 }, at - 0.25)
            .to(arts[i - 1], { opacity: 0, duration: 0.35 }, at - 0.25)
            .to(steps[i], { opacity: 1, y: 0, duration: 0.4 }, at)
            .to(arts[i], { opacity: 1, duration: 0.3 }, at)
            .to(fades[i], { opacity: 1, duration: 0.3, stagger: 0.05 }, at)
            .to(draws[i], { strokeDashoffset: 0, duration: 0.6, stagger: 0.04 }, at);
        }
        tl.to('[data-progress]', { scaleY: 1, duration: STEPS.length - 0.25 }, 0);
        // Hold the last step briefly before unpinning.
        tl.to({}, { duration: 0.4 });
        ScrollTrigger.refresh();
        return () => {
          setActive(0);
        };
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="factory-heading" className="factory bg-ink text-bone">
      <div className="factory-pin site-container">
        <div className="factory-copy">
          <p className="eyebrow text-clay">Straight from the factory floor</p>
          <h2 id="factory-heading" className="mt-4 max-w-[14ch] text-[clamp(2.4rem,5.6vw,5.4rem)] font-light leading-[1]">
            Four steps. One workshop. No middleman.
          </h2>

          <ol className="factory-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} data-step className="factory-step">
                <p className="font-display text-sm tracking-[0.2em] text-clay">
                  0{index + 1} / 0{STEPS.length}
                </p>
                <h3 className="mt-3 text-5xl font-light lg:text-7xl">{step.title}</h3>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-bone/75">{step.body}</p>
                <p className="mt-7 flex items-baseline gap-3 border-t border-bone/15 pt-5">
                  <span className="font-display text-4xl text-clay lg:text-5xl">
                    {'value' in step.fact ? <CountUp value={step.fact.value} suffix={step.fact.suffix} active={active === index} /> : step.fact.text}
                  </span>
                  <span className="text-sm uppercase tracking-[0.14em] text-bone/60">{step.fact.label}</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="factory-note mt-6 text-xs text-bone/60">Warranty and delivery terms are confirmed at your visit.</p>
        </div>

        <div className="factory-art" aria-hidden={false}>
          {FACTORY_ART.map((Art, index) => (
            <div key={index} data-art className="factory-art-layer">
              <Art />
            </div>
          ))}
          <div className="factory-progress" aria-hidden>
            <span data-progress className="block h-full w-full origin-top bg-clay" />
          </div>
        </div>
      </div>
    </section>
  );
}
