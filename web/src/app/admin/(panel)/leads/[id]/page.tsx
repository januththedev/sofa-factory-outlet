import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { LeadEditor, LeadQuoteButton } from '@/components/leads/lead-editor';
import { buttonStyles } from '@/components/ui/button';
import { requireRole } from '@/lib/auth/session';
import { getLead } from '@/lib/leads/service';
import { formatLkr } from '@/lib/money';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lead details' };
export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const result = await getLead(id);
  if (!result) notFound();
  const { lead, staff, activities, quotations } = result;
  const followUp = lead.followUpAt
    ? new Date(lead.followUpAt.getTime() + 330 * 60000)
        .toISOString()
        .slice(0, 16)
    : '';
  return (
    <div>
      <PageHeader
        title={lead.reference}
        description={`${lead.name} · ${lead.city}`}
        actions={
          <Link
            href="/admin/leads/"
            className={buttonStyles({ variant: 'ghost' })}
          >
            All leads
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section
          className="min-w-0 space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-8"
          aria-label="Customer request"
        >
          <h2 className="font-display text-2xl">Customer request</h2>
          <p>
            {lead.name}
            <br />
            {lead.phone}
            <br />
            {lead.email}
            <br />
            Preferred: {lead.preferredContact}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`tel:${lead.phone}`}
              className={buttonStyles({ variant: 'ghost' })}
            >
              Call customer
            </a>
            <a
              href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${lead.name}, regarding your Sofa Factory Outlet quote request ${lead.reference}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: 'ghost' })}
            >
              Open WhatsApp
            </a>
          </div>
          <p className="text-sm text-mute">
            Record the contact outcome below after speaking with the customer.
          </p>
          <p className="whitespace-pre-wrap break-words">
            {lead.notes || 'No additional notes.'}
          </p>
          <dl className="space-y-2">
            <dt className="text-sm text-mute">Budget</dt>
            <dd>{lead.budget || 'Not supplied'}</dd>
            <dt className="text-sm text-mute">Room</dt>
            <dd>{lead.room || 'Not supplied'}</dd>
          </dl>
          <h3 className="font-semibold">Selected pieces</h3>
          <ul className="divide-y divide-line">
            {lead.items.map((item, index) => (
              <li key={index} className="py-3">
                {item.quantity} × {item.name}
                <span className="block text-sm text-mute">
                  {item.colour} ·{' '}
                  {item.priceMinor === null
                    ? 'Price to confirm'
                    : formatLkr(item.priceMinor)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/admin/customers/${lead.customerId}/`}
            className="inline-flex min-h-11 items-center underline"
          >
            Customer history
          </Link>
          <h3 className="font-semibold">Campaign attribution</h3>
          <dl className="text-sm">
            {Object.entries(lead.attribution).map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-2">
                <dt className="text-mute">{key}:</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
          {quotations.length ? (
            quotations.map((q) => (
              <Link
                className="block min-h-11 text-maroon underline"
                key={q.id}
                href={`/admin/invoices/${q.id}/`}
              >
                Quotation {q.number ?? `draft #${q.id}`}
              </Link>
            ))
          ) : (
            <LeadQuoteButton id={lead.id} />
          )}
          <p className="text-sm text-mute">
            Review all prices and contact details before issuing a quotation.
          </p>
        </section>
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-line bg-paper p-5 sm:p-8">
            <h2 className="mb-5 font-display text-2xl">Next steps</h2>
            <LeadEditor
              lead={{
                id,
                stage: lead.stage,
                assigneeId: lead.assigneeId,
                priority: lead.priority,
                lostReason: lead.lostReason,
                followUp,
              }}
              staff={staff}
            />
          </section>
          <section className="rounded-2xl border border-line bg-paper p-5 sm:p-8">
            <h2 className="font-display text-2xl">Activity</h2>
            <ol className="mt-5 divide-y divide-line">
              {activities.map(({ activity, actor }) => (
                <li className="py-4" key={activity.id}>
                  <p className="whitespace-pre-wrap break-words">
                    {activity.body}
                  </p>
                  <p className="mt-2 text-sm text-mute">
                    {actor ?? 'Website'} ·{' '}
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Colombo',
                    }).format(activity.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
