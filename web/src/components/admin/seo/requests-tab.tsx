import Link from 'next/link';
import { StatGrid } from '@/components/admin/seo/ui';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { getReviewRequestStats } from '@/lib/admin/seo';

/** How many review-request WhatsApp links the team has sent, and the rating they have produced so far. */
export async function RequestsTab() {
  const stats = await getReviewRequestStats();
  const rated = stats.averageRating === null ? '—' : `${stats.averageRating.toFixed(1)} out of 5`;
  return (
    <div className="space-y-6">
      <StatGrid
        stats={[
          {
            label: 'Requests sent',
            value: String(stats.totalAsked),
            hint: `${stats.bookingsAsked} from bookings, ${stats.invoicesAsked} from invoices`,
          },
          {
            label: 'Approved reviews',
            value: String(stats.approvedReviews),
            hint: `${stats.waitingReviews} waiting for approval`,
          },
          { label: 'Current rating', value: rated, hint: 'Approved reviews only' },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>How review requests work</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-base sm:text-sm text-ink-2">
          <p>
            A request is counted when staff tap the WhatsApp review request on a booking marked as visited or on a paid
            invoice. The rating here comes only from on-site reviews you have approved.
          </p>
          <p>
            To ask a customer for a review of one product on this site, make a link on the{' '}
            <Link href="/admin/seo/?tab=reviews" className="font-medium text-maroon hover:underline">
              Reviews tab
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
