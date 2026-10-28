import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { NoData } from './no-data';

export type BarItem = { label: string; value: number };

type BarListProps = { items: BarItem[]; unit?: string; emptyLabel?: string };

/** Horizontal bars with the same numbers repeated in a table for screen readers. */
export function BarList({ items, unit = 'visitors', emptyLabel }: BarListProps) {
  if (!items.length) return <NoData label={emptyLabel} />;
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 text-base sm:text-sm">
              <span className="min-w-0 break-words">{item.label}</span>
              <span className="tabular-nums text-mute">
                {item.value.toLocaleString('en-LK')} {unit} · {Math.round((item.value / Math.max(total, 1)) * 100)}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-bone-2">
              <div
                className="h-2 rounded-full bg-maroon"
                style={{ width: item.value ? `${Math.max(2, Math.round((item.value / max) * 100))}%` : '0%' }}
              />
            </div>
          </li>
        ))}
      </ul>
      <details className="mt-4 text-base sm:text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-mute">View as table</summary>
        <Table className="mt-2">
          <caption className="sr-only">Same figures as the bars above</caption>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH className="text-right">{unit}</TH>
              <TH className="text-right">Share</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((item) => (
              <TR key={item.label}>
                <TD>{item.label}</TD>
                <TD className="text-right tabular-nums">{item.value.toLocaleString('en-LK')}</TD>
                <TD className="text-right tabular-nums">{Math.round((item.value / Math.max(total, 1)) * 100)}%</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </details>
    </div>
  );
}
