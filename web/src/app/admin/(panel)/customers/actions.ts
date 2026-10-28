'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { CustomerFormState } from '@/components/admin/customers/types';
import { createCustomer, CUSTOMER_FIELDS, updateCustomer, type CustomerSaveResult } from '@/lib/admin/customers';
import { requireRole } from '@/lib/auth/session';

// Customer actions. Staff and owner may both add and edit customers; nothing here deletes.

const idSchema = z.number().int().min(1).max(2_147_483_647);

/** The typed values as plain strings, so a failed form can show them again. */
function typedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of CUSTOMER_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === 'string' ? value : '';
  }
  return values;
}

function failed(result: Extract<CustomerSaveResult, { ok: false }>, values: Record<string, string>): CustomerFormState {
  return { error: result.message, fieldErrors: result.fieldErrors, existing: result.existing, values };
}

export async function createCustomerAction(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireRole();
  const values = typedValues(formData);
  let id: number;
  try {
    const result = await createCustomer(values);
    if (!result.ok) return failed(result, values);
    id = result.id;
  } catch (error) {
    console.error('[admin-customers] create failed:', error);
    return { error: 'Something went wrong. Please try again.', values };
  }
  revalidatePath('/admin/customers');
  redirect(`/admin/customers/${id}/`);
}

export async function updateCustomerAction(
  customerId: number,
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireRole();
  const values = typedValues(formData);
  const id = idSchema.safeParse(customerId);
  if (!id.success) return { error: 'This customer could not be found.', values };
  try {
    const result = await updateCustomer(id.data, values);
    if (!result.ok) return failed(result, values);
  } catch (error) {
    console.error('[admin-customers] update failed:', error);
    return { error: 'Something went wrong. Please try again.', values };
  }
  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id.data}`);
  // No values come back on success: the form shows the saved record, with the phone number tidied.
  return { ok: true, message: 'Customer saved.' };
}
