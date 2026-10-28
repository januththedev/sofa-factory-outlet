/** Clamp native scroll bounce and handle rails which do not overflow. */
export function railProgress(scrollLeft: number, scrollWidth: number, clientWidth: number): number {
  const distance = scrollWidth - clientWidth;
  if (distance <= 0) return 1;
  return Math.max(0, Math.min(1, scrollLeft / distance));
}
