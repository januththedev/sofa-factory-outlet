import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_TONES } from '@/lib/admin/bookings';
import type { BookingStatus } from '@/lib/db/schema/types';

/** Left-edge colour for a booking in the calendar, one per status. */
export const STATUS_ACCENT: Record<BookingStatus, string> = {
  new: 'border-l-maroon',
  contacted: 'border-l-warn',
  visited: 'border-l-ink',
  purchased: 'border-l-good',
  lost: 'border-l-bad',
  cancelled: 'border-l-mute',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
