import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import type { ConversationCounts } from '@/lib/admin/chat';
import type { ConversationFilter } from '@/lib/admin/chat';
import { listConversations } from '@/lib/admin/chat';
import { formatWhen } from '@/lib/admin/knowledge';
import { cn } from '@/lib/cn';

const FILTERS: Array<{ id: ConversationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'handoff', label: 'Asked for a person' },
  { id: 'thumbs_down', label: 'Thumbs down' },
  { id: 'unanswered', label: 'Unanswered or unsure' },
];

export const parseConversationFilter = (value: string | undefined): ConversationFilter =>
  FILTERS.find((item) => item.id === value)?.id ?? 'all';

const listHref = (filter: ConversationFilter, page = 1) =>
  `/admin/chat/?tab=conversations&filter=${filter}&page=${page}`;

const detailHref = (id: number, filter: ConversationFilter, page: number) =>
  `/admin/chat/?tab=conversations&filter=${filter}&page=${page}&c=${id}`;

function countFor(filter: ConversationFilter, counts: ConversationCounts): number | null {
  if (filter === 'handoff') return counts.handoff;
  if (filter === 'thumbs_down') return counts.thumbsDown;
  if (filter === 'unanswered') return counts.unanswered;
  return null;
}

function snippet(text: string | null): string {
  if (!text) return '';
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

/** The Conversations tab: every chat with the signals worth a look, and filters to find them. */
export async function ConversationsPanel({
  filter,
  page,
  counts,
}: {
  filter: ConversationFilter;
  page: number;
  counts: ConversationCounts;
}) {
  const list = await listConversations({ filter, page });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Conversations</CardTitle>
          <p className="mt-1 text-base sm:text-sm text-mute">
            Visitors are anonymous: only the first characters of their random id are shown.
          </p>
        </div>
      </CardHeader>
      <CardBody className="border-b border-line">
        <nav aria-label="Filter conversations" className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const count = countFor(item.id, counts);
            return (
              <Link
                key={item.id}
                href={listHref(item.id)}
                aria-current={item.id === filter ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border px-3 py-2',
                  item.id === filter
                    ? 'border-maroon bg-maroon/10 text-maroon'
                    : 'border-line text-ink-2 hover:border-ink',
                )}
              >
                {item.label}
                {count ? <Badge tone={item.id === 'handoff' ? 'warn' : 'neutral'}>{count}</Badge> : null}
              </Link>
            );
          })}
        </nav>
      </CardBody>
      {list.rows.length === 0 ? (
        <CardBody>
          <p className="text-base sm:text-sm text-mute">
            {filter === 'all'
              ? 'No conversations yet. Try the playground while you wait for the first visitor.'
              : 'No conversations match this filter. Choose All to see the inbox.'}
          </p>
        </CardBody>
      ) : (
        <>
        <ul className="grid gap-3 p-3 lg:hidden">
          {list.rows.map((row) => (
            <li key={row.id} className="min-w-0 space-y-3 rounded-xl border border-line p-4">
              <Link href={detailHref(row.id, filter, list.page)}
                className="flex min-h-11 items-center font-semibold text-maroon">
                {row.visitor} conversation {row.id}
              </Link>
              <p>{snippet(row.lastText) || 'Open this conversation to read its messages.'}</p>
              <p
                className="text-base sm:text-sm text-mute">
                {formatWhen(row.lastMessageAt)} · {row.messages} messages
              </p>
              <div className="flex flex-wrap gap-2">
                {row.handoff ? <Badge tone="warn">Asked for a person</Badge> : null}
                {row.thumbsDown > 0 ? <Badge tone="bad">Thumbs down {row.thumbsDown}</Badge> : null}
                {row.unanswered > 0 ? <Badge>Unsure {row.unanswered}</Badge> : null}
                {row.flagged > 0 ? <Badge tone="maroon">Flagged {row.flagged}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden min-w-0 lg:block">
        <Table>
          <THead>
            <TR>
              <TH>Visitor</TH>
              <TH className="hidden md:table-cell">Started</TH>
              <TH>Last message</TH>
              <TH>Messages</TH>
              <TH className="hidden lg:table-cell">Topics</TH>
              <TH>Flags</TH>
            </TR>
          </THead>
          <TBody>
            {list.rows.map((row) => (
              <TR key={row.id}>
                <TD className="whitespace-nowrap">
                  <Link
                    href={detailHref(row.id, filter, list.page)}
                    className="font-mono text-maroon underline-offset-4 hover:underline"
                  >
                    {row.visitor}
                    <span className="sr-only"> conversation {row.id}</span>
                  </Link>
                </TD>
                <TD className="hidden whitespace-nowrap md:table-cell">{formatWhen(row.startedAt)}</TD>
                <TD className="max-w-xs">
                  <p className="text-ink-2">{snippet(row.lastText)}</p>
                  <p className="mt-0.5 text-xs text-mute">{formatWhen(row.lastMessageAt)}</p>
                </TD>
                <TD>{row.messages}</TD>
                <TD className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {row.intents.length > 0 ? (
                      row.intents.map((item) => (
                        <Badge key={item.intent}>
                          {item.intent} {item.count > 1 ? `x${item.count}` : ''}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-mute">none</span>
                    )}
                  </div>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {row.handoff ? <Badge tone="warn">Asked for a person</Badge> : null}
                    {row.thumbsDown > 0 ? <Badge tone="bad">Thumbs down {row.thumbsDown}</Badge> : null}
                    {row.unanswered > 0 ? <Badge tone="neutral">Unsure {row.unanswered}</Badge> : null}
                    {row.flagged > 0 ? <Badge tone="maroon">Flagged {row.flagged}</Badge> : null}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        </div>
        </>
      )}
      {list.pages > 1 ? (
        <CardBody className="flex items-center justify-between gap-3 border-t border-line text-base sm:text-sm">
          {list.page > 1 ? (
            <Link href={listHref(filter, list.page - 1)} className="text-maroon underline-offset-4 hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-mute">
            Page {list.page} of {list.pages}
          </span>
          {list.page < list.pages ? (
            <Link href={listHref(filter, list.page + 1)} className="text-maroon underline-offset-4 hover:underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </CardBody>
      ) : null}
    </Card>
  );
}
