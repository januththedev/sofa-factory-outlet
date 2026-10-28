export type StatItem = { label: string; value: string; hint?: string };

export function StatCards({ stats }: { stats: StatItem[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
