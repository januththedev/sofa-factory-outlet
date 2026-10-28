'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/bookings/types';
import {
  changeBookingStatus,
  formatVisitDate,
  getBookingStatus,
  markReviewRequested,
  rescheduleBooking,
  saveStaffNotes,
  STATUS_LABELS,
} from '@/lib/admin/bookings';
import { requireRole } from '@/lib/auth/session';
import { createInvoiceFromBooking } from '@/lib/invoices/api';

// Actions for one booking. Each one checks the session first (staff and owner may all use them),
// validates its input, and answers with a message instead of throwing when something is wrong.

const idSchema = z.number().int().min(1).max(2_147_483_647);

const failure = (error: string): ActionState => ({ error });
const NOT_FOUND = 'This booking could not be found.';

/** Refreshes every page that shows a booking. */
function refresh(bookingId: number) {
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings/calendar');
}

async function guarded(label: string, work: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await work();
  } catch (error) {
    console.error(`[admin-bookings] ${label} failed:`, error);
    return failure('Something went wrong. Please try again.');
  }
}

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export async function changeStatusAction(
  bookingId: number,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole();
  const id = idSchema.safeParse(bookingId);
  if (!id.success) return failure(NOT_FOUND);
  const target = text(formData.get('status'));
  return guarded('status change', async () => {
    const result = await changeBookingStatus(id.data, target);
    if (!result.ok) return failure(result.message);
    refresh(id.data);
    return { ok: true, message: `Status changed to ${STATUS_LABELS[result.to].toLowerCase()}.` };
  });
}

export async function saveNotesAction(
  bookingId: number,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole();
  const id = idSchema.safeParse(bookingId);
  if (!id.success) return failure(NOT_FOUND);
  const notes = text(formData.get('notes'));
  return guarded('save notes', async () => {
    const result = await saveStaffNotes(id.data, notes);
    if (!result.ok) return { error: result.message, values: { notes } };
    refresh(id.data);
    return { ok: true, message: 'Notes saved.', values: { notes: notes.trim() } };
  });
}

const rescheduleSchema = z.object({
  date: z.string().min(1),
  slotId: z.coerce.number().int().min(1),
});

export async function rescheduleAction(
  bookingId: number,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole();
  const id = idSchema.safeParse(bookingId);
  if (!id.success) return failure(NOT_FOUND);
  const parsed = rescheduleSchema.safeParse({ date: formData.get('date'), slotId: formData.get('slotId') });
  if (!parsed.success) return failure('Choose a date and a time slot.');
  return guarded('reschedule', async () => {
    const result = await rescheduleBooking({ bookingId: id.data, ...parsed.data });
    if (!result.ok) return failure(result.message);
    refresh(id.data);
    return { ok: true, message: `Moved to ${formatVisitDate(result.visitDate)}, ${result.slotLabel}.` };
  });
}

/** Called when staff open the WhatsApp review request, so the booking shows it was sent. */
export async function reviewRequestedAction(bookingId: number): Promise<ActionState> {
  await requireRole();
  const id = idSchema.safeParse(bookingId);
  if (!id.success) return failure(NOT_FOUND);
  return guarded('review request', async () => {
    const result = await markReviewRequested(id.data);
    if (!result.ok) return failure(result.message);
    refresh(id.data);
    return { ok: true };
  });
}

/** Makes (or finds) the invoice for the booking and opens it. */
export async function convertToInvoiceAction(bookingId: number): Promise<ActionState> {
  await requireRole();
  const id = idSchema.safeParse(bookingId);
  if (!id.success) return failure(NOT_FOUND);
  let invoiceId: number;
  try {
    const status = await getBookingStatus(id.data);
    if (status === null) return failure(NOT_FOUND);
    if (status === 'cancelled' || status === 'lost') {
      return failure(`A ${STATUS_LABELS[status].toLowerCase()} booking cannot be turned into an invoice.`);
    }
    ({ invoiceId } = await createInvoiceFromBooking(id.data));
  } catch (error) {
    console.error('[admin-bookings] could not convert the booking to an invoice:', error);
    return failure('The invoice could not be created. Please try again, or start one from the Invoices page.');
  }
  refresh(id.data);
  redirect(`/admin/invoices/${invoiceId}/`);
}
