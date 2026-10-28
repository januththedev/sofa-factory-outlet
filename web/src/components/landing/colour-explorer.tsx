'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { TLink } from '@/components/site/transition';
import type { Swatch } from '@/lib/catalogue/cached';
import { useFinePointer, useNearViewport, usePageVisible, usePrefersReducedMotion, useWebGL } from '@/lib/motion/hooks';
import { accentFor, SofaSvg } from './sofa-svg';

const ColourSofaScene = dynamic(() => import('@/components/webgl/colour-sofa-scene'), { ssr: false });

/**
 * Signature section: a 3D sofa built in code from rounded blocks. Tap a fabric
 * and it re-upholsters with an eased blend; "Shop this colour" opens the store
 * filtered to that colour. Without WebGL, or with reduced motion, the flat
 * illustration changes colour instead.
 */
export function ColourExplorer({ swatches }: { swatches: Swatch[] }) {
  const [active, setActive] = useState(0);
  const [stage, nearStage] = useNearViewport<HTMLDivElement>('300px');
  const [onScreen, setOnScreen] = useState(false);
  const [ready, setReady] = useState(false);
  const webgl = useWebGL();
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const visible = usePageVisible();

  // Pause rendering while the stage is off screen.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stage(el);
    setNode(el);
  }, [stage]);
  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  if (swatches.length === 0) return null;
  const current = swatches[Math.min(active, swatches.length - 1)];
  const use3d = nearStage && webgl && !reduced;

  return (
    <section aria-labelledby="explorer-heading" className="bg-bone py-24 lg:py-36">
      <div className="site-container grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <p className="eyebrow">Colour explorer</p>
          <h2 id="explorer-heading" className="mt-4 text-[clamp(2.4rem,5vw,4.8rem)] font-light leading-[1]">
            Pick a fabric. Watch the sofa change.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
            Every sofa is made to order, so the colour is yours to choose. Try a few, then see the pieces we have made in each.
          </p>

          <div role="radiogroup" aria-label="Fabric colour" className="mt-9 flex flex-wrap gap-3">
            {swatches.map((swatch, index) => (
              <button
                key={swatch.family}
                type="button"
                role="radio"
                aria-checked={index === active}
                aria-label={swatch.label}
                onClick={() => setActive(index)}
                className={`relative h-12 w-12 rounded-full ring-offset-4 ring-offset-bone transition-all duration-300 ${
                  index === active ? 'scale-110 ring-2 ring-ink' : 'ring-1 ring-ink/15 hover:scale-105 hover:ring-ink/40'
                }`}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </div>

          <div className="mt-8 min-h-[7.5rem]" aria-live="polite">
            <p className="font-display text-3xl">{current.label}</p>
            <p className="mt-1 text-mute">
              {current.count} {current.count === 1 ? 'piece' : 'pieces'} made in this colour
            </p>
            <TLink href={current.href} className="btn-primary mt-5">
              Shop this colour
            </TLink>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div
            ref={stageRef}
            data-explorer-stage
            className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-b from-paper to-bone-2"
          >
            <div className={`absolute inset-0 grid place-items-center p-[8%] transition-opacity duration-700 ${ready && use3d ? 'opacity-0' : 'opacity-100'}`}>
              <SofaSvg color={current.hex} accent={accentFor(current.hex)} />
            </div>
            {use3d ? (
              <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}>
                <ColourSofaScene color={current.hex} autoRotate interactive={fine} paused={!onScreen || !visible} onReady={() => setReady(true)} />
              </div>
            ) : null}
            {use3d && ready && fine ? <p className="pointer-events-none absolute bottom-4 left-5 text-xs uppercase tracking-[0.16em] text-ink/45">Drag to turn</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
