'use client';

import { useSyncExternalStore } from 'react';
import { MOTION_DESKTOP } from '@/lib/motion/gsap';
import { useMediaQuery } from '@/lib/motion/hooks';

export const subscribeNever = () => () => {};

export function useHasTouch(): boolean {
  const coarse = useMediaQuery('(any-pointer: coarse)');
  const touchPoints = useSyncExternalStore(subscribeNever, () => navigator.maxTouchPoints > 0, () => false);
  return coarse || touchPoints;
}

/** Touch laptops and tablets also keep native scrolling, regardless of viewport width. */
export function useDesktopMotion(): boolean {
  const desktop = useMediaQuery(`${MOTION_DESKTOP} and (hover: hover) and (pointer: fine)`);
  const touch = useHasTouch();
  return desktop && !touch;
}
