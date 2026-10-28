'use client';

import { useTransition } from 'react';
import { moderateReviewAction } from '@/app/admin/(panel)/seo/actions';
import { Button } from '@/components/ui/button';
import type { ReviewStatus } from '@/lib/seo/report';

/** Approve publishes a review on its product page; reject keeps it off the site but remembers the decision. */
export function ReviewActions({ id, status, author }: { id: number; status: ReviewStatus; author: string }) {
  const [pending, startTransition] = useTransition();

  function decide(decision: 'approve' | 'reject' | 'delete') {
    if (decision === 'delete' && !window.confirm(`Delete the review from ${author}? This cannot be undone.`)) return;
    const data = new FormData();
    data.set('id', String(id));
    data.set('decision', decision);
    startTransition(async () => {
      await moderateReviewAction(data);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'approved' ? (
        <Button size="sm" onClick={() => decide('approve')} disabled={pending}>
          Approve
        </Button>
      ) : null}
      {status !== 'rejected' ? (
        <Button size="sm" variant="ghost" onClick={() => decide('reject')} disabled={pending}>
          {status === 'approved' ? 'Take down' : 'Reject'}
        </Button>
      ) : null}
      <Button size="sm" variant="danger" onClick={() => decide('delete')} disabled={pending}>
        Delete
      </Button>
    </div>
  );
}
