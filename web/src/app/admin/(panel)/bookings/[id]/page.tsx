import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import {
  ConvertForm,
  NotesForm,
  RescheduleForm,
  StatusForm,
  VisitedForm,
} from '@/components/admin/bookings/action-forms';
import { CustomerCard, HistoryCard, ProductsCard, VisitCard } from '@/components/admin/bookings/detail-cards';
import { ReviewRequest } from '@/components/admin/bookings/review-request';
import { StatusBadge } from '@/components/admin/bookings/status-badge';
import { PageHeader } from '@/components/admin/page-header';
import { buttonStyles } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import {
  allowedTransitions,
  buildContactMessage,
  buildReviewMessage,
  canTransition,
  formatColomboDateTime,
  getBookingDetail,
  getRescheduleOptions,
  invoiceTitle,
  isOpenBooking,
  parseRecordId,
  STATUS_LABELS,
} from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';
import { isLkMobile } from '@/lib/phone';
import { getSettings, whatsappLink } from '@/lib/settings/get';
import {
  changeStatusAction,
  convertToInvoiceAction,
  rescheduleAction,
  reviewRequestedAction,
  saveNotesAction,
} from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Booking' };

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
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

  return (
    <div>
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
      <p className="mb-6 flex flex-wrap items-center gap-3 text-sm text-mute">
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
                <p className="text-sm text-ink-2">An invoice already exists for this booking.</p>
                <Link
                  href={`/admin/invoices/${detail.bookingInvoice.id}/`}
                  className={buttonStyles({ variant: 'dark', className: 'w-full' })}
                >
                  Open {invoiceTitle(detail.bookingInvoice)}
                </Link>
              </div>
            ) : canConvert ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-2">
                  Turns the chosen pieces into an invoice. Pieces without a price start at zero, so check them
                  before issuing.
                </p>
                <ConvertForm action={convertToInvoiceAction.bind(null, bookingId)} />
              </div>
            ) : (
              <p className="text-sm text-mute">
                A {STATUS_LABELS[status].toLowerCase()} booking cannot be turned into an invoice.
              </p>
            )}
          </ActionCard>
        </div>
      </div>
    </div>
  );
}
