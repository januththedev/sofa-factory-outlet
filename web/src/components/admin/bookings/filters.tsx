import Link from 'next/link';
import { Button, buttonStyles } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { BOOKING_STATUSES, bookingsQuery, STATUS_LABELS, type BookingFilter } from '@/lib/admin/bookings';

/** Search and filters for the booking list. A plain GET form, so it works before any script loads. */
export function BookingFilters({
  filter,
  products,
}: {
  filter: BookingFilter;
  products: Array<{ id: number; name: string }>;
}) {
  return (
    <form
      // A new key rebuilds the fields when the URL changes, so "Clear" really empties them.
      key={bookingsQuery(filter)}
      method="get"
      action="/admin/bookings/"
      role="search"
      aria-label="Search and filter bookings"
      className="mb-6 rounded-[var(--radius-card)] border border-line bg-paper p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="filter-q">Search</Label>
          <Input
            id="filter-q"
            type="search"
            name="q"
            defaultValue={filter.q ?? ''}
            placeholder="Name, phone or reference"
            maxLength={100}
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="filter-status">Status</Label>
          <Select id="filter-status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="filter-from">Visit from</Label>
          <Input id="filter-from" type="date" name="from" defaultValue={filter.from ?? ''} />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="filter-to">Visit to</Label>
          <Input id="filter-to" type="date" name="to" defaultValue={filter.to ?? ''} />
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <Label htmlFor="filter-product">Product</Label>
          <Select id="filter-product" name="product" defaultValue={filter.productId ? String(filter.productId) : ''}>
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {filter.sort === 'asc' ? <input type="hidden" name="sort" value="asc" /> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Link href="/admin/bookings/" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
          Clear
        </Link>
      </div>
    </form>
  );
}
