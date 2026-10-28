import { whatsappLink } from '@/lib/settings/get';
import type { BookingSummary } from './api';
export function bookingWhatsappLink(summary: BookingSummary, whatsappNumber: string | null | undefined): string | null {
  return whatsappLink(whatsappNumber, `Hi, I booked a showroom visit (${summary.reference}) for ${summary.visitDate} at ${summary.slotLabel}.`);
}
