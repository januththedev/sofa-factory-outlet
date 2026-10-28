import { z } from 'zod';
import '@/lib/security/zod-jitless';
import { CONTACT_METHODS } from './schema';
import type { BookingDetails } from './schema';

export const BOOKING_DRAFT_KEY = 'sfo-booking-draft-v1';

// Drafts may be incomplete or invalid. Only their types are checked here; the form schema validates on blur/submit.
const draftSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  whatsappSame: z.boolean().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  date: z.string().optional(),
  slotId: z.number().optional(),
  notes: z.string().optional(),
  preferredContact: z.enum(CONTACT_METHODS).optional(),
});

export type BookingDraft = Partial<Omit<BookingDetails, 'consent'>>;
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Resolve browser storage inside each try block: even accessing the property can throw in private mode.
export function saveBookingDraft(details: BookingDraft, storage?: DraftStorage): void {
  try {
    const draft = draftSchema.parse(details);
    (storage ?? window.sessionStorage).setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The form still works without storage.
  }
}

export function restoreBookingDraft(storage?: DraftStorage): BookingDraft | null {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(BOOKING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearBookingDraft(storage?: DraftStorage): void {
  try {
    (storage ?? window.sessionStorage).removeItem(BOOKING_DRAFT_KEY);
  } catch {
    // Nothing else needs to wait for storage.
  }
}
