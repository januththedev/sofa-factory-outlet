export type StatItem = { label: string; value: string; hint?: string };

export function StatCards({ stats }: { stats: StatItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper p-3 sm:p-5">
          <dt className="eyebrow break-words text-xs">{stat.label}</dt>
          <dd className="mt-2 break-words font-display text-3xl tabular-nums">{stat.value}</dd>
          {stat.hint ? <dd className="mt-1 text-xs text-mute">{stat.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
