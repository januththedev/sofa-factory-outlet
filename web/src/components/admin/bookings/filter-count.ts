import type { BookingFilter } from '@/lib/admin/bookings';

/** Search counts as a filter; sort order and pagination do not narrow the results. */
export function activeFilterCount(filter: BookingFilter): number {
  return [filter.q?.trim(), filter.status, filter.from, filter.to, filter.productId]
    .filter(Boolean).length;
}
