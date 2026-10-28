'use server';

import { refresh } from 'next/cache';
import type { z } from 'zod';
import { readSettings, saveSlots, writeSetting } from '@/lib/admin/settings';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { revalidateSettings } from '@/lib/revalidate';
import {
  applyBooking,
  applyBusiness,
  applyChat,
  applyDelivery,
  applyHours,
  applyInvoice,
  applyProof,
  applySeo,
  businessSchema,
  chatSeoSchema,
  deliverySchema,
  fieldErrors,
  formInput,
  hoursSchema,
  invoiceSchema,
  proofSchema,
  type SettingsFormState,
  type StaffFormState,
  staffSchema,
} from './schemas';
import { changeStaffRole, createStaff, resetStaffPassword, type StaffResult, setStaffActive } from './staff';

// Every action here is owner-only and starts with requireRole('owner'): a form
// post is a plain request, so hiding the page from staff is not enough.

const CHECK_FIELDS = 'Some fields need attention. Nothing was saved.';

/** A slot with bookings is never deleted: the save switches it off and says so. */
function keptNote(deactivated: number): string {
  if (deactivated === 0) return '';
  if (deactivated === 1) return ' 1 removed slot still has bookings, so it was switched off instead of deleted.';
  return ` ${deactivated} removed slots still have bookings, so they were switched off instead of deleted.`;
}

function invalid(error: z.ZodError): SettingsFormState {
  return { ok: false, message: CHECK_FIELDS, errors: fieldErrors(error), at: Date.now() };
}

function saved(message: string): SettingsFormState {
  // The public site reads settings through a tagged cache; the admin page re-renders from the database.
  revalidateSettings();
  refresh();
  return { ok: true, message, errors: {}, at: Date.now() };
}

export async function saveBusinessAction(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireRole('owner');
  const parsed = businessSchema.safeParse(formInput(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const current = await readSettings(db);
  await writeSetting(db, 'business', applyBusiness(current.business, parsed.data));
  return saved('Business details saved.');
}

export async function saveHoursAction(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireRole('owner');
  const parsed = hoursSchema.safeParse(formInput(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const current = await readSettings(db);
  const form = parsed.data;
  const outcome = await db.transaction(async (tx) => {
    await writeSetting(tx, 'hours', applyHours(current.hours, form));
    await writeSetting(tx, 'booking', applyBooking(current.booking, form));
    return saveSlots(tx, form.slots);
  });
  const kept = keptNote(outcome.deactivated);
  return saved(`Hours and visit slots saved.${kept}`);
}

export async function saveInvoiceAction(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireRole('owner');
  const parsed = invoiceSchema.safeParse(formInput(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const current = await readSettings(db);
  await writeSetting(db, 'invoice', applyInvoice(current.invoice, parsed.data));
  return saved('Invoice settings saved.');
}

export async function saveDeliveryAction(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireRole('owner');
  const parsed = deliverySchema.safeParse(formInput(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  await writeSetting(db, 'delivery', applyDelivery(parsed.data));
  return saved('Delivery and warranty terms saved.');
}

export async function saveProofAction(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireRole('owner');
  const parsed = proofSchema.safeParse(formInput(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  await writeSetting(db, 'proof', applyProof(parsed.data));
  return saved('Proof numbers saved.');
}

export async function saveChatSeoAction(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireRole('owner');
  const parsed = chatSeoSchema.safeParse(formInput(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const current = await readSettings(db);
  await db.transaction(async (tx) => {
    await writeSetting(tx, 'chat', applyChat(current.chat, parsed.data));
    await writeSetting(tx, 'seo', applySeo(parsed.data));
  });
  return saved('Chat and SEO switches saved.');
}

const fromResult = (intent: NonNullable<StaffFormState>['intent'], result: StaffResult): StaffFormState =>
  result.ok
    ? { ok: true, message: result.message, errors: {}, intent, tempPassword: result.tempPassword, at: Date.now() }
    : { ok: false, message: result.error, errors: {}, intent, at: Date.now() };

/** One action for the whole staff table; the hidden `intent` field says which row operation it is. */
export async function staffAction(_previous: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const session = await requireRole('owner');
  const parsed = staffSchema.safeParse(formInput(formData));
  if (!parsed.success) {
    return { ok: false, message: CHECK_FIELDS, errors: fieldErrors(parsed.error), at: Date.now() };
  }
  const db = await getDb();
  const input = parsed.data;
  let result: StaffResult;
  switch (input.intent) {
    case 'create':
      result = await createStaff(db, { name: input.name, email: input.email, role: input.role });
      break;
    case 'role':
      result = await changeStaffRole(db, input.id, input.role);
      break;
    case 'active':
      result = await setStaffActive(db, session.userId, input.id, input.active);
      break;
    case 'reset':
      result = await resetStaffPassword(db, input.id);
      break;
  }
  if (result.ok) refresh();
  return fromResult(input.intent, result);
}
