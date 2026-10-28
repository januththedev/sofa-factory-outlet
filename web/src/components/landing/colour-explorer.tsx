'use client';

import dynamic from 'next/dynamic';
import type { KeyboardEvent } from 'react';
import { useCallback } from 'react';
import { useState } from 'react';
import { useSyncExternalStore } from 'react';
import { TLink } from '@/components/site/transition';
import type { Swatch } from '@/lib/catalogue/cached';
import { hasWebGL } from '@/lib/motion/hooks';
import { useFinePointer } from '@/lib/motion/hooks';
import { useInViewport } from '@/lib/motion/hooks';
import { useNearViewport } from '@/lib/motion/hooks';
import { usePageVisible } from '@/lib/motion/hooks';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { shouldUse3d } from './device-capabilities';
import { subscribeNever } from './device-hooks';
import { useHasTouch } from './device-hooks';
import { accentFor } from './sofa-svg';
import { SofaSvg } from './sofa-svg';

const ColourSofaScene = dynamic(() => import('@/components/webgl/colour-sofa-scene'), { ssr: false });

type DeviceNavigator = Navigator & { deviceMemory?: number };

function SceneLayer({ color, paused }: { color: string; paused: boolean }) {
  const [ready, setReady] = useState(false);
  return (
    <div
      className={`absolute inset-0 touch-pan-y bg-gradient-to-b from-paper to-bone-2
        transition-opacity duration-200 [&_canvas]:touch-pan-y ${ready ? 'opacity-100' : 'opacity-0'}`}
    >
      <ColourSofaScene
        color={color}
        autoRotate
        interactive
        paused={paused}
        onReady={() => setReady(true)}
      />
      {ready ? (
        <p className="pointer-events-none absolute bottom-4 left-5 text-xs text-ink/70">Drag to turn</p>
      ) : null}
    </div>
  );
}

/** Phones retain a light, scroll-friendly illustration; only capable non-touch pointers load the scene. */
export function ColourExplorer({ swatches }: { swatches: Swatch[] }) {
  const [active, setActive] = useState(0);
  const [nearRef, near] = useNearViewport<HTMLDivElement>('300px');
  const [visibleRef, onScreen] = useInViewport<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const touch = useHasTouch();
  const visible = usePageVisible();
  const capable = useSyncExternalStore(subscribeNever, () => shouldUse3d({
    finePointer: fine,
    hasTouch: touch || navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as DeviceNavigator).deviceMemory,
  }), () => false);
  // Avoid even allocating a probe context on phones, low-end devices or reduced motion.
  const webgl = useSyncExternalStore(subscribeNever, () => capable
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && hasWebGL(), () => false);
  const stageRef = useCallback((node: HTMLDivElement | null) => {
    nearRef(node);
    visibleRef(node);
  }, [nearRef, visibleRef]);

  if (swatches.length === 0) return null;
  const selected = Math.min(active, swatches.length - 1);
  const current = swatches[selected];
  const use3d = near && capable && webgl && !reduced;

  const selectWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % swatches.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + swatches.length) % swatches.length;
    }
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = swatches.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <section aria-labelledby="explorer-heading" className="bg-bone py-10 lg:py-36">
      <div className="site-container grid items-center gap-5 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-6">
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1">
          <p className="eyebrow text-xs">Colour explorer</p>
          <h2
            id="explorer-heading"
            className="mt-3 text-[clamp(2rem,5vw,4.8rem)] font-light leading-[1]"
          >
            Pick a fabric. Watch the sofa change.
          </h2>
          <p className="mt-3 max-w-md text-base leading-snug text-ink-2 lg:mt-6 lg:text-lg lg:leading-relaxed">
            Every sofa is made to order, so the colour is yours to choose. Try a few,
            then see the pieces we have made in each.
          </p>
        </div>
        <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <div
            ref={stageRef}
            id="explorer-preview"
            data-explorer-stage
            className="relative aspect-[16/9] touch-pan-y overflow-hidden rounded-[var(--radius-card)]
              bg-gradient-to-b from-paper to-bone-2 lg:aspect-[5/4]"
          >
            <div className="absolute inset-0 grid place-items-center p-[5%] lg:p-[8%]">
              <SofaSvg color={current.hex} accent={accentFor(current.hex)} />
            </div>
            {use3d ? <SceneLayer color={current.hex} paused={!onScreen || !visible} /> : null}
          </div>
        </div>
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2">
          <div
            role="radiogroup"
            aria-label="Fabric colour"
            aria-describedby="explorer-selection"
            className="flex flex-wrap gap-3"
          >
            {swatches.map((swatch, index) => (
              <button
                key={swatch.family}
                type="button"
                role="radio"
                aria-checked={index === selected}
                aria-label={swatch.label}
                aria-controls="explorer-preview"
                tabIndex={index === selected ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => selectWithKeyboard(event, index)}
                className={`h-11 min-h-11 w-11 min-w-11 rounded-full ring-offset-2 ring-offset-bone
                  ${index === selected ? 'ring-2 ring-ink' : 'ring-1 ring-ink/30'}`}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </div>
          <div id="explorer-selection" className="mt-4" aria-live="polite" aria-atomic="true">
            <p className="font-display text-2xl lg:text-3xl">{current.label}</p>
            <p className="mt-1 text-base text-mute">
              {current.count} {current.count === 1 ? 'piece' : 'pieces'} made in this colour
            </p>
          </div>
          <TLink href={current.href} className="btn-primary mt-4 min-h-11 min-w-11">
            Shop this colour
          </TLink>
        </div>
      </div>
    </section>
  );
}
