'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

// Register once; every motion component imports from here, never from 'gsap' directly.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };

/** Same breakpoints as the CSS (`lg`) so pinned layouts and their GSAP counterparts switch together. */
export const MOTION_DESKTOP = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';
export const MOTION_ANY = '(prefers-reduced-motion: no-preference)';
export const REDUCED = '(prefers-reduced-motion: reduce)';
