'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createLeadQuotation, updateLead } from '@/lib/leads/service';
export type LeadEditState = { ok: boolean; message: string } | null;
export async function saveLead(
  _previous: LeadEditState,
  form: FormData,
): Promise<LeadEditState> {
  const session = await requireRole();
  try {
    await updateLead(
      { ...Object.fromEntries(form), priority: form.get('priority') === 'on' },
      session.userId,
    );
    revalidatePath('/admin/leads/');
    revalidatePath(`/admin/leads/${form.get('id')}/`);
    return { ok: true, message: 'Lead updated. Follow-up and activity saved.' };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error && /^(Lead|Choose)/.test(error.message)
            ? error.message
            : 'We could not save this lead. Please try again.',
    };
  }
}
export async function startQuotation(form: FormData): Promise<void> {
  const session = await requireRole();
  const id = z.coerce.number().int().positive().parse(form.get('id'));
  const invoiceId = await createLeadQuotation(id, session.userId);
  revalidatePath(`/admin/leads/${id}/`);
  redirect(`/admin/invoices/${invoiceId}/edit/`);
}
