import { notImplemented } from '../not-implemented';
import type { PictureData } from '../images/urls';

// CONTRACT STUB. Owner: "booking-core" agent. Keep these exports and signatures.

export type SlotAvailability = {
  slotId: number;
  /** "10:00–12:00" */
  label: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
  remaining: number;
};

export type DayAvailability = {
  /** YYYY-MM-DD in Asia/Colombo */
  date: string;
  /** false for closed weekdays, closed dates, days before the lead time and days past the horizon */
  open: boolean;
  slots: SlotAvailability[];
};

/** Open days and slot capacity from `from` (default: today in Colombo) for `days` days (default: settings.booking.horizonDays). */
export const getAvailability: (options?: { from?: string; days?: number }) => Promise<DayAvailability[]> = async () => notImplemented('getAvailability');

export type BookingInput = {
  name: string;
  /** Any Sri Lankan format; normalised with normaliseLkPhone */
  phone: string;
  whatsappSame: boolean;
  email?: string;
  city?: string;
  /** YYYY-MM-DD */
  date: string;
  slotId: number;
  notes?: string;
  preferredContact: 'whatsapp' | 'call' | 'email';
  consent: true;
  items: Array<{ productId: number; variantId?: number; quantity: number }>;
  meta?: { sourcePage?: string; referrer?: string; utm?: Record<string, string>; visitorId?: string; conversationId?: number };
};

export type BookingResult =
  | { ok: true; reference: string; bookingId: number }
  | { ok: false; code: 'slot_full' | 'slot_closed' | 'invalid' | 'rate_limited' | 'unknown'; message: string; fieldErrors?: Record<string, string> };

/**
 * One transaction: lock the slot, check capacity, upsert the customer by
 * phone, insert booking + items (snapshotting names, colours, prices), draw
 * the reference from booking_ref_seq ("SFO-B-0042"), write a bell notification.
 * Never throws for expected failures: they come back as { ok: false }.
 */
export const createBooking: (input: BookingInput) => Promise<BookingResult> = async () => notImplemented('createBooking');

export type BookingSummary = {
  reference: string;
  status: string;
  visitDate: string;
  slotLabel: string;
  customerName: string;
  phone: string;
  items: Array<{ name: string; slug: string | null; colourName: string | null; quantity: number; image: PictureData | null }>;
  createdAt: string;
};

export const getBookingByReference: (reference: string) => Promise<BookingSummary | null> = async () => notImplemented('getBookingByReference');
