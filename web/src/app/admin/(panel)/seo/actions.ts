'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  approveReview,
  deleteReview,
  type PreparedReviewLink,
  prepareReviewLink,
  rejectReview,
} from '@/lib/admin/reviews';
import {
  createRedirect,
  deleteRedirect,
  type RedirectField,
  type RedirectWrite,
  updateRedirect,
} from '@/lib/admin/seo';
import { requireRole } from '@/lib/auth/session';
import { revalidateRedirects, revalidateReviews } from '@/lib/revalidate';

const SEO_PAGE = '/admin/seo/';

export type RedirectFormState =
  | { status: 'idle' }
  | { status: 'saved'; message: string }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<RedirectField, string>> };

const redirectFormSchema = z.object({
  from: z.string().max(1000),
  to: z.string().max(1000),
  status: z.coerce.number(),
});

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

function readRedirectForm(formData: FormData) {
  return redirectFormSchema.safeParse({
    from: formData.get('from') ?? '',
    to: formData.get('to') ?? '',
    status: formData.get('status') ?? '',
  });
}

function toFormState(result: RedirectWrite, savedMessage: string): RedirectFormState {
  if (result.ok) {
    revalidateRedirects();
    revalidatePath(SEO_PAGE);
    return { status: 'saved', message: savedMessage };
  }
  const { form, ...fieldErrors } = result.errors;
  return { status: 'error', message: form ?? 'Please check the highlighted fields.', fieldErrors };
}

const UNREADABLE: RedirectFormState = {
  status: 'error',
  message: 'Those redirect details could not be read. Please try again.',
  fieldErrors: {},
};

export async function createRedirectAction(formData: FormData): Promise<RedirectFormState> {
  await requireRole('any');
  const parsed = readRedirectForm(formData);
  if (!parsed.success) return UNREADABLE;
  return toFormState(await createRedirect(parsed.data), 'Redirect added.');
}

export async function updateRedirectAction(formData: FormData): Promise<RedirectFormState> {
  await requireRole('any');
  const id = idSchema.safeParse(formData.get('id'));
  const parsed = readRedirectForm(formData);
  if (!id.success || !parsed.success) return UNREADABLE;
  return toFormState(await updateRedirect(id.data, parsed.data), 'Redirect saved.');
}

/** Only the owner removes a redirect: a staff member who submits this is sent back to the dashboard. */
export async function deleteRedirectAction(formData: FormData): Promise<void> {
  await requireRole('owner');
  const id = idSchema.safeParse(formData.get('id'));
  if (!id.success) return;
  await deleteRedirect(id.data);
  revalidateRedirects();
  revalidatePath(SEO_PAGE);
}

const decisionSchema = z.object({ id: idSchema, decision: z.enum(['approve', 'reject', 'delete']) });

/** Approve (publish), reject or delete one review from the moderation queue. */
export async function moderateReviewAction(formData: FormData): Promise<void> {
  await requireRole('any');
  const parsed = decisionSchema.safeParse({ id: formData.get('id'), decision: formData.get('decision') });
  if (!parsed.success) return;
  const { id, decision } = parsed.data;
  if (decision === 'approve') await approveReview(id);
  else if (decision === 'reject') await rejectReview(id);
  else await deleteReview(id);
  revalidateReviews();
  revalidatePath(SEO_PAGE);
}

const linkSchema = z.object({ productId: idSchema, bookingId: idSchema.optional() });

/** A review link for one product of one booking, ready to send over WhatsApp. */
export async function generateReviewLinkAction(productId: number, bookingId?: number): Promise<PreparedReviewLink> {
  await requireRole('any');
  const parsed = linkSchema.safeParse({ productId, bookingId });
  if (!parsed.success) return { ok: false, error: 'Choose a booking and a product first.' };
  return prepareReviewLink(parsed.data);
}
