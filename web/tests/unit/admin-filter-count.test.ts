import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { activeFilterCount } from '@/components/admin/bookings/filter-count';
import type { BookingFilter } from '@/lib/admin/bookings';

const empty: BookingFilter = { sort: 'desc', page: 1 };

describe('active booking filter count', () => {
  it('does not count sort or pagination', () => {
    expect(activeFilterCount(empty)).toBe(0);
    expect(activeFilterCount({ sort: 'asc', page: 8 })).toBe(0);
  });

  it('counts each narrowing field once', () => {
    const fields: Partial<BookingFilter>[] = [
      { q: 'SFO-B' },
      { status: 'new' },
      { from: '2026-10-29' },
      { to: '2026-10-30' },
      { productId: 7 },
    ];
    for (const field of fields) expect(activeFilterCount({ ...empty, ...field })).toBe(1);
    expect(activeFilterCount(Object.assign({}, empty, ...fields))).toBe(5);
  });

  it('ignores empty or whitespace-only search text', () => {
    expect(activeFilterCount({ ...empty, q: '' })).toBe(0);
    expect(activeFilterCount({ ...empty, q: '  ' })).toBe(0);
    expect(activeFilterCount({ ...empty, q: '  visitor  ', status: 'cancelled' })).toBe(2);
  });
});
