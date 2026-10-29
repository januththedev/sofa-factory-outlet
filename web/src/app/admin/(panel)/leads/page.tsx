import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { Input, Select } from '@/components/ui/field';
import { Button, buttonStyles } from '@/components/ui/button';
import { requireRole } from '@/lib/auth/session';
import { listLeads } from '@/lib/leads/service';
import { STAGE_LABELS } from '@/lib/leads/schema';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole();
  const params = await searchParams;
  const queue = first(params.queue).slice(0, 30),
    q = first(params.q).slice(0, 100);
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(first(params.page)) || 1)),
  );
  const rows = await listLeads({ queue, q, page, userId: session.userId });
  const href = (target: number) =>
    `/admin/leads/?${new URLSearchParams({ q, queue, page: String(target) })}`;
  return (
    <div>
      <PageHeader
        title="Leads"
        description="Quote requests, assigned salespeople and the next conversation to have."
      />
      <form
        method="get"
        action="/admin/leads/"
        className="mb-6 grid gap-3 rounded-2xl border border-line bg-paper p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label>
          Search
          <Input
            name="q"
            defaultValue={q}
            placeholder="Name, phone or reference"
          />
        </label>
        <label>
          Queue
          <Select name="queue" defaultValue={queue}>
            <option value="all">All leads</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            <option value="today">Due today or overdue</option>
            <option value="overdue">Overdue</option>
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" className="self-end">
          Filter
        </Button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.length ? (
          rows.map(({ lead, assignee }) => (
            <article
              key={lead.id}
              className="min-w-0 rounded-2xl border border-line bg-paper p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/leads/${lead.id}/`}
                  className="min-h-11 break-all font-semibold text-maroon underline"
                >
                  {lead.reference}
                </Link>
                <span className="rounded-full bg-bone-2 px-3 py-1 text-sm">
                  {STAGE_LABELS[lead.stage]}
                  {lead.priority ? ' · Priority' : ''}
                </span>
              </div>
              <h2 className="mt-2 font-display text-2xl">{lead.name}</h2>
              <p className="mt-1 text-mute">
                {lead.city} · {lead.phone}
              </p>
              <p className="mt-4">
                {lead.items.length} selected pieces · {assignee ?? 'Unassigned'}
              </p>
              <p className="mt-2 text-sm text-mute">
                Follow-up:{' '}
                {lead.followUpAt
                  ? new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Colombo',
                    }).format(lead.followUpAt)
                  : 'Not scheduled'}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-line p-8 text-mute">
            No leads in this queue.
          </p>
        )}
      </div>
      <nav aria-label="Lead pages" className="mt-6 flex gap-3">
        {page > 1 ? (
          <Link
            className={buttonStyles({ variant: 'ghost' })}
            href={href(page - 1)}
          >
            Previous
          </Link>
        ) : null}
        {rows.length === 25 ? (
          <Link
            className={buttonStyles({ variant: 'ghost' })}
            href={href(page + 1)}
          >
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
