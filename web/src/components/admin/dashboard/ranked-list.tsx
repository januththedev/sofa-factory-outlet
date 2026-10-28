import Link from 'next/link';
import { NoData } from '@/components/admin/visitors/no-data';

export type RankedItem = { key: string; label: string; count: number; href?: string };

type RankedListProps = { items: RankedItem[]; unit: string; empty?: string };

/** A numbered top list with counts. Reads naturally as an ordered list for screen readers. */
export function RankedList({ items, unit, empty = 'No data yet' }: RankedListProps) {
  if (items.length === 0) return <NoData label={empty} />;
  return (
    <ol className="space-y-2 text-base sm:text-sm">
      {items.map((item, index) => (
        <li
          key={item.key}
          className={
            'flex flex-wrap items-baseline justify-between gap-3 border-b border-line/70 pb-2 ' +
            'last:border-0 last:pb-0'
          }
        >
          <span className="min-w-0 break-words">
            <span className="mr-2 tabular-nums text-mute">{index + 1}.</span>
            {item.href ? (
              <Link href={item.href} className="link-underline inline-flex min-h-11 min-w-11 items-center break-words">
                {item.label}
              </Link>
            ) : (
              item.label
            )}
          </span>
          <span className="shrink-0 tabular-nums text-mute">
            {item.count.toLocaleString('en-LK')} {unit}
          </span>
        </li>
      ))}
    </ol>
  );
}
