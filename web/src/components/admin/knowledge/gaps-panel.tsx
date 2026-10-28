import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { formatWhen, type GapSort, type GapStatus, listGaps } from '@/lib/admin/knowledge';
import { cn } from '@/lib/cn';
import { GapItem } from './gap-item';
import { GoldenCard } from './golden-card';

const STATUSES: Array<{ id: GapStatus; label: string }> = [
  { id: 'open', label: 'Waiting' },
  { id: 'answered', label: 'Answered' },
  { id: 'dismissed', label: 'Dismissed' },
];

const SORTS: Array<{ id: GapSort; label: string }> = [
  { id: 'asked', label: 'Most asked' },
  { id: 'recent', label: 'Most recent' },
];

export const parseGapStatus = (value: string | undefined): GapStatus =>
  STATUSES.find((item) => item.id === value)?.id ?? 'open';

export const parseGapSort = (value: string | undefined): GapSort =>
  SORTS.find((item) => item.id === value)?.id ?? 'asked';

const href = (status: GapStatus, sort: GapSort) => `/admin/knowledge/?tab=gaps&status=${status}&sort=${sort}`;

function Pills<T extends string>({
  label,
  items,
  active,
  link,
}: {
  label: string;
  items: Array<{ id: T; label: string }>;
  active: T;
  link: (id: T) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-mute">{label}</span>
      {items.map((item) => (
        <Link
          key={item.id}
          href={link(item.id)}
          aria-current={item.id === active ? 'true' : undefined}
          className={cn(
            'rounded-full border px-3 py-1 text-sm',
            item.id === active ? 'border-maroon bg-maroon/10 text-maroon' : 'border-line text-ink-2 hover:border-ink',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The knowledge-gap queue: questions visitors asked that the bot could not answer from what it knows.
 * Writing the answer here creates an instant FAQ, so the same question is answered next time.
 */
export async function GapsPanel({ status, sort }: { status: GapStatus; sort: GapSort }) {
  const gaps = await listGaps({ status, sort });
  const empty =
    status === 'open' ? 'Nothing is waiting. New questions appear here as visitors ask them.' : 'Nothing here yet.';
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Questions the bot could not answer</CardTitle>
            <p className="mt-1 text-sm text-mute">
              The most asked come first. Write the answer once and it becomes an instant FAQ.
            </p>
          </div>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-x-8 gap-y-3 border-b border-line">
          <Pills label="Show" items={STATUSES} active={status} link={(id) => href(id, sort)} />
          <Pills label="Sort by" items={SORTS} active={sort} link={(id) => href(status, id)} />
        </CardBody>
        {gaps.length === 0 ? (
          <CardBody>
            <p className="text-sm text-mute">{empty}</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {gaps.map((gap) => (
              <GapItem
                key={`${gap.id}-${gap.status}`}
                gap={{
                  id: gap.id,
                  question: gap.question,
                  timesAsked: gap.timesAsked,
                  status: gap.status,
                  lastAskedLabel: formatWhen(gap.lastAskedAt),
                  resolvedFaqId: gap.resolvedFaqId,
                }}
              />
            ))}
          </ul>
        )}
      </Card>
      <GoldenCard />
    </div>
  );
}
