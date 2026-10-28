'use client';

import { useState } from 'react';
import { useTransition } from 'react';
import { moderateReviewAction } from '@/app/admin/(panel)/seo/actions';
import { Button } from '@/components/ui/button';
import type { ReviewStatus } from '@/lib/seo/report';

/** Approve publishes a review on its product page; reject keeps it off the site but remembers the decision. */
export function ReviewActions({ id, status, author }: { id: number; status: ReviewStatus; author: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function decide(decision: 'approve' | 'reject' | 'delete') {
    if (decision === 'delete' && !window.confirm(`Delete the review from ${author}? This cannot be undone.`)) return;
    if (pending) return;
    if (decision === 'reject' && !window.confirm('Keep this review off the site? You can approve it later.')) return;
    const data = new FormData();
    data.set('id', String(id));
    data.set('decision', decision);
    startTransition(async () => {
      try {
        await moderateReviewAction(data);
        setMessage(decision === 'approve' ? 'Review approved.' : 'Review updated.');
      } catch {
        setMessage('This review could not be updated. Please try again.');
      }
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
      <p className="basis-full text-base" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
