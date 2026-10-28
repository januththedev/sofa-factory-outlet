import type { FunnelStep } from '@/lib/analytics/queries';

/** Funnel events are counted independently, so a later step can have more visitors. */
export function funnelWording(step: Pick<FunnelStep, 'dropOff' | 'dropOffPct'>): string {
  const count = Math.max(0, step.dropOff);
  if (count === 0) return 'No drop-off';
  const percent = Math.min(100, Math.max(0, Math.round(step.dropOffPct)));
  return `${count.toLocaleString('en-LK')} left before this step (${percent}%)`;
}
