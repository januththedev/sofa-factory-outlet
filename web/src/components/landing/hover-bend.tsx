'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useFinePointer, usePrefersReducedMotion, useWebGL } from '@/lib/motion/hooks';

const ImageScene = dynamic(() => import('@/components/webgl/image-scene'), { ssr: false });

/**
 * While a collection card is hovered, a WebGL plane with the same photo bends
 * over it. Only one canvas exists at a time, and it is removed shortly after
 * the pointer leaves.
 */
export function HoverBend({ src, hovered, cutout }: { src: string; hovered: boolean; cutout: boolean }) {
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const webgl = useWebGL();
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  // Mount on the first hover (derived during render); unmount a moment after the pointer leaves.
  if (hovered && !mounted) setMounted(true);
  useEffect(() => {
    if (hovered) return;
    const id = window.setTimeout(() => {
      setMounted(false);
      setReady(false);
    }, 900);
    return () => window.clearTimeout(id);
  }, [hovered]);

  if (!fine || reduced || !webgl || !mounted) return null;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${cutout ? 'mix-blend-multiply' : ''} transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <ImageScene src={src} mode="bend" fit={cutout ? 'contain' : 'cover'} active={hovered} onReady={() => setReady(true)} />
    </div>
  );
}
