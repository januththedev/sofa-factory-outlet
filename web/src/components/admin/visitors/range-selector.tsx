import Link from 'next/link';
import { cn } from '@/lib/cn';

const RANGES = [7, 30] as const;

/** 7/30-day switch. The range lives in the URL so links and refreshes keep it. */
export function RangeSelector({ days }: { days: number }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-paper p-1" role="group" aria-label="Date range">
      {RANGES.map((range) => (
        <Link
          key={range}
          href={`/admin/visitors/?days=${range}`}
          aria-current={days === range ? 'page' : undefined}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
            days === range ? 'bg-ink text-bone' : 'text-ink-2 hover:bg-bone-2',
          )}
        >
          {range} days
        </Link>
      ))}
    </div>
  );
}
