import Link from 'next/link';
import { ReviewActions } from '@/components/admin/seo/review-actions';
import { ReviewLinkForm } from '@/components/admin/seo/review-link-form';
import { EmptyNote, formatDate, Stars } from '@/components/admin/seo/ui';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { type AdminReview, listReviewLinkBookings, listReviews, reviewCounts } from '@/lib/admin/reviews';
import { cn } from '@/lib/cn';
import type { ReviewStatus } from '@/lib/seo/report';

export type ReviewTabFilter = { status: ReviewStatus | 'all'; verifiedOnly: boolean };

const STATUS_FILTERS: ReadonlyArray<ReviewStatus | 'all'> = ['pending', 'approved', 'rejected', 'all'];
const STATUS_LABEL: Record<ReviewStatus | 'all', string> = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
};
const STATUS_TONE = { pending: 'warn', approved: 'good', rejected: 'bad' } as const;

export function parseReviewStatus(value: string | undefined): ReviewStatus | 'all' {
  return STATUS_FILTERS.find((status) => status === value) ?? 'pending';
}

function filterHref(filter: ReviewTabFilter): string {
  const params = new URLSearchParams({ tab: 'reviews', status: filter.status });
  if (filter.verifiedOnly) params.set('verified', '1');
  return `/admin/seo/?${params.toString()}`;
}

export async function ReviewsTab({ filter }: { filter: ReviewTabFilter }) {
  const [reviews, counts, bookings] = await Promise.all([
    listReviews({ status: filter.status, verifiedOnly: filter.verifiedOnly }),
    reviewCounts(),
    listReviewLinkBookings(),
  ]);
  const total = counts.pending + counts.approved + counts.rejected;
  const numbers: Record<ReviewStatus | 'all', number> = { ...counts, all: total };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Create a review link for a booking</CardTitle>
            <p className="mt-1 text-sm text-mute">
              Customers who came in can review the piece they bought. Send them the link on WhatsApp; their review
              waits here until you approve it.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <ReviewLinkForm bookings={bookings} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-wrap">
          <CardTitle>Moderation queue</CardTitle>
          <nav aria-label="Filter reviews" className="flex flex-wrap items-center gap-2 text-sm">
            {STATUS_FILTERS.map((status) => {
              const current = status === filter.status;
              return (
                <Link
                  key={status}
                  href={filterHref({ ...filter, status })}
                  aria-current={current ? 'true' : undefined}
                  className={cn(
                    'rounded-full px-3 py-1 font-medium transition-colors',
                    current ? 'bg-ink text-bone' : 'bg-bone-2 text-ink-2 hover:bg-clay-soft',
                  )}
                >
                  {STATUS_LABEL[status]} ({numbers[status]})
                </Link>
              );
            })}
            <Link
              href={filterHref({ ...filter, verifiedOnly: !filter.verifiedOnly })}
              aria-current={filter.verifiedOnly ? 'true' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 font-medium transition-colors',
                filter.verifiedOnly
                  ? 'border-maroon bg-maroon/10 text-maroon'
                  : 'border-line text-ink-2 hover:bg-bone-2',
              )}
            >
              Verified visits only
            </Link>
          </nav>
        </CardHeader>
        {reviews.length === 0 ? (
          <EmptyNote>
            {total === 0 ? 'No reviews have been sent yet.' : 'No reviews match this filter.'}
          </EmptyNote>
        ) : (
          <ul className="divide-y divide-line">
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewItem review={review} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ReviewItem({ review }: { review: AdminReview }) {
  return (
    <article className="space-y-3 px-6 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} />
        <Badge tone={STATUS_TONE[review.status]}>{STATUS_LABEL[review.status]}</Badge>
        {review.verifiedVisit ? <Badge tone="maroon">Verified visit</Badge> : null}
        <span className="text-sm text-mute">{formatDate(review.createdAt)}</span>
      </div>
      <div>
        {review.title ? <h3 className="font-semibold">{review.title}</h3> : null}
        <p className="mt-1 max-w-3xl whitespace-pre-line text-ink-2">{review.body}</p>
        <p className="mt-2 text-sm text-mute">From {review.authorName}</p>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {review.product ? (
          <>
            <Link href={`/admin/products/${review.product.id}/`} className="font-medium text-maroon hover:underline">
              {review.product.name}
            </Link>
            <Link href={`/product/${review.product.slug}/`} className="text-mute hover:underline">
              View on the site
            </Link>
          </>
        ) : (
          <span className="text-mute">The product has been removed</span>
        )}
        {review.booking ? (
          <Link href={`/admin/bookings/${review.booking.id}/`} className="text-mute hover:underline">
            Booking {review.booking.reference}
          </Link>
        ) : null}
        {review.invoice ? (
          <Link href={`/admin/invoices/${review.invoice.id}/`} className="text-mute hover:underline">
            Invoice {review.invoice.number ?? review.invoice.id}
          </Link>
        ) : null}
      </p>
      <ReviewActions id={review.id} status={review.status} author={review.authorName} />
    </article>
  );
}
