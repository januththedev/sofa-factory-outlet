import { TLink } from '@/components/site/transition';
import { Card } from '@/components/ui/card';

export type BlockedReviewStatus = 'expired' | 'invalid' | 'already_reviewed' | 'product_gone';

const NOTICES: Record<BlockedReviewStatus, { title: string; body: string }> = {
  expired: {
    title: 'This review link has expired',
    body: 'Review links work for 60 days. Please ask the showroom team for a new one and we will gladly send it.',
  },
  invalid: {
    title: 'This review link is not valid',
    body:
      'The link may have been cut short when it was copied. Please open it again from the message we sent, ' +
      'or ask the showroom team for a new one.',
  },
  already_reviewed: {
    title: 'A review has already been sent',
    body: 'We have your review for this purchase, and it will appear once the team has checked it. Thank you.',
  },
  product_gone: {
    title: 'We could not find that product',
    body: 'It may no longer be in our range. Please get in touch with the showroom team and we will sort it out.',
  },
};

/** Shown in place of the form when a review link cannot be used. */
export function ReviewNotice({ status }: { status: BlockedReviewStatus }) {
  const notice = NOTICES[status];
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-2xl font-light">{notice.title}</h2>
      <p className="mt-3 max-w-prose text-ink-2">{notice.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <TLink href="/visit/" className="btn-ghost px-7 py-4">
          Contact the showroom
        </TLink>
      </div>
    </Card>
  );
}
