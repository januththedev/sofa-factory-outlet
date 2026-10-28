'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useFinePointer, useIdleAfterLoad, useInViewport, useMediaQuery, usePageVisible, usePrefersReducedMotion, useWebGL } from '@/lib/motion/hooks';

const ImageScene = dynamic(() => import('@/components/webgl/image-scene'), { ssr: false });

/**
 * Cursor-following ripple over the hero photo. Mounts only on wide, fine-pointer
 * screens with WebGL and no reduced-motion preference, and only after the page
 * has loaded and the browser is idle, so it never touches LCP. The <picture>
 * underneath remains the fallback and the LCP element.
 */
export function HeroRipple({ src }: { src: string }) {
  const idle = useIdleAfterLoad();
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const webgl = useWebGL();
  const [ready, setReady] = useState(false);
  const [stage, onScreen] = useInViewport<HTMLDivElement>();
  const visible = usePageVisible();

  if (!(idle && fine && wide && webgl && !reduced)) return null;
  return (
    <div ref={stage} aria-hidden data-hero-canvas className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <ImageScene src={src} mode="ripple" paused={!visible || !onScreen} onReady={() => setReady(true)} />
    </div>
  );
}
