'use server';

import type { ReviewFormState } from '@/components/reviews/limits';
import { submitReview } from '@/lib/seo/reviews';

/** Saves a review sent from /review/<token>/. The review stays unapproved until the team publishes it. */
export async function submitReviewAction(token: string, formData: FormData): Promise<ReviewFormState> {
  if (typeof token !== 'string') return { status: 'error', message: 'This review link is not valid.', fieldErrors: {} };
  const result = await submitReview(token, {
    rating: formData.get('rating'),
    title: formData.get('title'),
    body: formData.get('body'),
    name: formData.get('name'),
  });
  if (result.ok) return { status: 'done' };
  return { status: 'error', message: result.message, fieldErrors: result.fieldErrors ?? {} };
}
