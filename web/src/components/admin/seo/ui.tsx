import { Badge } from '@/components/ui/badge';

// Small pieces shared by the tabs of the SEO page.

export function StatGrid({ stats }: { stats: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
          <dt className="eyebrow">{stat.label}</dt>
          <dd className="mt-2 font-display text-3xl tabular-nums">{stat.value}</dd>
          {stat.hint ? <dd className="mt-1 text-xs text-mute">{stat.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-10 text-center text-base sm:text-sm text-mute">{children}</p>;
}

const SCORE_TONE = { green: 'good', amber: 'warn', red: 'bad' } as const;
const SCORE_LABEL = { green: 'Green', amber: 'Amber', red: 'Red' } as const;

/** The word is shown as well as the colour, so the score does not depend on telling colours apart. */
export function ScoreBadge({ score }: { score: 'green' | 'amber' | 'red' | null }) {
  if (score === null) return <span className="text-mute">—</span>;
  return <Badge tone={SCORE_TONE[score]}>{SCORE_LABEL[score]}</Badge>;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Colombo',
});

export const formatDate = (value: string): string => dateFormat.format(new Date(value));

/** Filled and empty stars with the rating spelled out for screen readers. */
export function Stars({ rating }: { rating: number }) {
  const whole = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="whitespace-nowrap text-warn" role="img" aria-label={`${whole} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(whole)}</span>
      <span aria-hidden="true" className="text-line">
        {'★'.repeat(5 - whole)}
      </span>
    </span>
  );
}
