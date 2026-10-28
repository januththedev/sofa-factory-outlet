import { allowedTransitions } from '@/lib/admin/bookings';
import { formatVisitDate } from '@/lib/admin/bookings';
import { STATUS_LABELS } from '@/lib/admin/bookings';
import type { BookingListRow } from '@/lib/admin/bookings';
import type { BookingStatus } from '@/lib/db/schema/types';
import { isLkMobile } from '@/lib/phone';
import { normaliseLkPhone } from '@/lib/phone';
import { whatsappLink } from '@/lib/settings/get';

/** Contact only a usable number; a separate WhatsApp number takes precedence. */
export function bookingContacts(phone: string, whatsapp?: string | null) {
  const normalised = normaliseLkPhone(phone);
  const mobile = normaliseLkPhone(whatsapp ?? '');
  const whatsappNumber = mobile && isLkMobile(mobile)
    ? mobile
    : normalised && isLkMobile(normalised) ? normalised : null;
  return {
    callHref: normalised ? `tel:${normalised}` : null,
    whatsappHref: whatsappLink(whatsappNumber),
  };
}

/** The first allowed forward transition is the useful one-tap action. */
export function primaryStatusAction(status: BookingStatus) {
  const next = allowedTransitions(status)[0];
  if (!next) return null;
  const label = next === 'visited' ? 'Mark as visited' : `Mark as ${STATUS_LABELS[next].toLowerCase()}`;
  return { value: next, label };
}

/** Presentation data shared by the phone list and its behaviour tests. */
export function bookingCardModel(row: BookingListRow, whatsapp?: string | null) {
  return {
    href: `/admin/bookings/${row.id}/`,
    reference: row.reference,
    name: row.customerName,
    date: formatVisitDate(row.visitDate),
    slot: row.slotLabel,
    status: row.status,
    items: row.items,
    pieces: row.pieces,
    source: row.source,
    ...bookingContacts(row.phone, whatsapp),
    primaryAction: primaryStatusAction(row.status),
  };
}
