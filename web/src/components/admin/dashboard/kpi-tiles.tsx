import Link from 'next/link';
import { cn } from '@/lib/cn';

export type Kpi = {
  label: string;
  /** A number or short text. Pass null while there is no data, to show "No data yet". */
  value: string | null;
  hint?: string;
  href?: string;
};

const VALUE_STYLE = 'break-words font-display text-3xl';

function Tile({ kpi }: { kpi: Kpi }) {
  const body = (
    <>
      <span className="eyebrow block break-words text-xs">{kpi.label}</span>
      <span
        className={cn('mt-2 block break-words tabular-nums', kpi.value === null ? 'text-base text-mute' : VALUE_STYLE)}
      >
        {kpi.value ?? 'No data yet'}
      </span>
      {kpi.hint ? <span className="mt-1 block text-xs text-mute">{kpi.hint}</span> : null}
    </>
  );
  const base = 'block h-full rounded-[var(--radius-card)] border border-line bg-paper p-3 sm:p-5';
  if (!kpi.href) return <div className={base}>{body}</div>;
  return (
    <Link href={kpi.href} className={cn(base, 'transition-colors hover:border-maroon/40 hover:bg-bone/60')}>
      {body}
    </Link>
  );
}

/** A row of headline numbers. A tile with an href is a link to where that number is managed. */
export function KpiTiles({ items }: { items: Kpi[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((kpi) => (
        <li key={kpi.label} className="min-w-0">
          <Tile kpi={kpi} />
        </li>
      ))}
    </ul>
  );
}
