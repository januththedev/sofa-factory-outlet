import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Printer } from 'lucide-react';
import { ConvertForm } from '@/components/admin/bookings/action-forms';
import { NotesForm } from '@/components/admin/bookings/action-forms';
import { RescheduleForm } from '@/components/admin/bookings/action-forms';
import { StatusForm } from '@/components/admin/bookings/action-forms';
import { VisitedForm } from '@/components/admin/bookings/action-forms';
import { CustomerCard } from '@/components/admin/bookings/detail-cards';
import { HistoryCard } from '@/components/admin/bookings/detail-cards';
import { ProductsCard } from '@/components/admin/bookings/detail-cards';
import { VisitCard } from '@/components/admin/bookings/detail-cards';
import { ReviewRequest } from '@/components/admin/bookings/review-request';
import { StatusBadge } from '@/components/admin/bookings/status-badge';
import { primaryStatusAction } from '@/components/admin/bookings/card-model';
import { ContactActions } from '@/components/admin/bookings/contact-actions';
import { QuickStatus } from '@/components/admin/bookings/quick-status';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { allowedTransitions } from '@/lib/admin/bookings';
import { buildContactMessage } from '@/lib/admin/bookings';
import { buildReviewMessage } from '@/lib/admin/bookings';
import { canTransition } from '@/lib/admin/bookings';
import { formatColomboDateTime } from '@/lib/admin/bookings';
import { getBookingDetail } from '@/lib/admin/bookings';
import { getRescheduleOptions } from '@/lib/admin/bookings';
import { invoiceTitle } from '@/lib/admin/bookings';
import { isOpenBooking } from '@/lib/admin/bookings';
import { parseRecordId } from '@/lib/admin/bookings';
import { STATUS_LABELS } from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';
import { isLkMobile } from '@/lib/phone';
import { getSettings } from '@/lib/settings/get';
import { whatsappLink } from '@/lib/settings/get';
import { changeStatusAction } from './actions';
import { convertToInvoiceAction } from './actions';
import { rescheduleAction } from './actions';
import { reviewRequestedAction } from './actions';
import { saveNotesAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Booking' };

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole();
  const bookingId = parseRecordId((await params).id);
  if (bookingId === null) notFound();
  const detail = await getBookingDetail(bookingId);
  if (!detail) notFound();

  const { sheet } = detail;
  const { status, customer, visit } = sheet;
  const settings = await getSettings();
  const businessName = settings.business.name;
  const reviewUrl = settings.business.map.googleReviewUrl;
  const open = isOpenBooking(status);
  const rescheduleDays = open ? await getRescheduleOptions({ date: visit.date, slotId: detail.slotId }) : [];

  // Mobile numbers can have WhatsApp even when the customer never typed a separate WhatsApp number.
  const whatsappNumber = customer.whatsapp ?? (isLkMobile(customer.phone) ? customer.phone : null);
  const contactMessage = buildContactMessage({
    customerName: customer.name,
    businessName,
    reference: sheet.reference,
    visitDate: visit.date,
    slotLabel: visit.slotLabel,
  });
  const reviewMessage = buildReviewMessage({ customerName: customer.name, businessName, reviewUrl });

  const canMarkVisited = canTransition(status, 'visited');
  const statusOptions = allowedTransitions(status)
    .filter((next) => !(canMarkVisited && next === 'visited'))
    .map((next) => ({ value: next, label: STATUS_LABELS[next] }));
  const canConvert = status !== 'cancelled' && status !== 'lost';
  const hasVisited = status === 'visited' || status === 'purchased';
  const primary = primaryStatusAction(status);

  return (
    <div className="pb-[calc(14rem+env(safe-area-inset-bottom))] lg:pb-0">
      <PageHeader
        title={sheet.reference}
        description={`${customer.name} · ${visit.dateLabel}, ${visit.slotLabel}`}
        actions={
          <>
            <Link href="/admin/bookings/" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
              <ArrowLeft className="size-4" aria-hidden />
              All bookings
            </Link>
            <Link
              href={`/admin/bookings/${bookingId}/print/`}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
            >
              <Printer className="size-4" aria-hidden />
              Print sheet
            </Link>
          </>
        }
      />
      <p className="mb-6 flex flex-wrap items-center gap-3 text-base sm:text-sm text-mute">
        <StatusBadge status={status} />
        <span>Booked {formatColomboDateTime(detail.createdAt)}</span>
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <ProductsCard items={sheet.items} pieces={sheet.pieces} totalMinor={sheet.totalMinor} />
          <VisitCard detail={detail} />
          <HistoryCard detail={detail} />
        </div>

        <div className="min-w-0 space-y-6">
          <CustomerCard detail={detail} whatsappHref={whatsappLink(whatsappNumber, contactMessage)} />

          <ActionCard title="Status">
            <div className="space-y-5">
              {canMarkVisited ? <VisitedForm action={changeStatusAction.bind(null, bookingId)} /> : null}
              <StatusForm action={changeStatusAction.bind(null, bookingId)} options={statusOptions} />
            </div>
          </ActionCard>

          {hasVisited ? (
            <ActionCard title="Ask for a Google review">
              <ReviewRequest
                href={whatsappLink(whatsappNumber, reviewMessage)}
                message={reviewMessage}
                hasReviewLink={Boolean(reviewUrl?.trim())}
                requestedAt={detail.reviewRequestedAt ? formatColomboDateTime(detail.reviewRequestedAt) : null}
                action={reviewRequestedAction.bind(null, bookingId)}
              />
            </ActionCard>
          ) : null}

          {open ? (
            <ActionCard title="Reschedule">
              <RescheduleForm action={rescheduleAction.bind(null, bookingId)} days={rescheduleDays} />
            </ActionCard>
          ) : null}

          <ActionCard title="Staff notes">
            <NotesForm action={saveNotesAction.bind(null, bookingId)} initial={sheet.staffNotes ?? ''} />
          </ActionCard>

          <ActionCard title="Invoice">
            {detail.bookingInvoice ? (
              <div className="space-y-3">
                <p className="text-base sm:text-sm text-ink-2">An invoice already exists for this booking.</p>
                <Link
                  href={`/admin/invoices/${detail.bookingInvoice.id}/`}
                  className={buttonStyles({ variant: 'dark', className: 'w-full' })}
                >
                  Open {invoiceTitle(detail.bookingInvoice)}
                </Link>
              </div>
            ) : canConvert ? (
              <div className="space-y-3">
                <p className="text-base sm:text-sm text-ink-2">
                  Turns the chosen pieces into an invoice. Pieces without a price start at zero, so check them
                  before issuing.
                </p>
                <ConvertForm action={convertToInvoiceAction.bind(null, bookingId)} />
              </div>
            ) : (
              <p className="text-base sm:text-sm text-mute">
                A {STATUS_LABELS[status].toLowerCase()} booking cannot be turned into an invoice.
              </p>
            )}
          </ActionCard>
          <ActionCard title="Print">
            <Link
              href={`/admin/bookings/${bookingId}/print/`}
              className={buttonStyles({ variant: 'ghost', className: 'w-full' })}
            >
              <Printer className="size-4" aria-hidden />
              Print booking sheet
            </Link>
          </ActionCard>
        </div>
      </div>
      <div
        data-sticky-bar
        aria-label="Booking actions"
        className={
          'fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-line bg-paper px-4 pt-3 ' +
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden'
        }
      >
        {primary ? (
          <QuickStatus
            action={changeStatusAction.bind(null, bookingId)}
            target={primary.value}
            label={primary.label}
          />
        ) : <p className="text-base sm:text-sm text-mute">Status: {STATUS_LABELS[status]}</p>}
        <ContactActions
          callHref={`tel:${customer.phone}`}
          whatsappHref={whatsappLink(whatsappNumber, contactMessage)}
        />
        <a href="#staff-notes" className="inline-flex min-h-11 items-center text-maroon underline">
          Edit staff notes
        </a>
      </div>
    </div>
  );
}
