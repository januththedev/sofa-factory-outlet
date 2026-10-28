'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { buttonStyles } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import type { BookingFilter } from '@/lib/admin/bookings';
import { activeFilterCount } from './filter-count';

type FilterProps = {
  filter: BookingFilter;
  products: Array<{ id: number; name: string }>;
  statuses: Array<{ value: string; label: string }>;
};

export function BookingFilters({ filter, products, statuses }: FilterProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(filter.q ?? '');
  const count = activeFilterCount(filter);
  return (
    <form
      method="get"
      action="/admin/bookings/"
      role="search"
      aria-label="Search and filter bookings"
      className="mb-6 space-y-4 rounded-[var(--radius-card)] border border-line bg-paper p-4"
    >
      <div>
        <Label htmlFor="filter-q">Search</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="filter-q"
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, phone or reference"
            maxLength={100}
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            className="min-w-0 flex-1 basis-40"
          />
          <Button
            variant="ghost"
            onClick={() => {
              setQuery('');
              document.getElementById('filter-q')?.focus();
            }}
            aria-label="Clear search"
          >
            Clear
          </Button>
          <Button type="submit">Search</Button>
        </div>
      </div>
      <Button
        variant="subtle"
        className="w-full lg:hidden"
        aria-expanded={expanded}
        aria-controls="booking-filters"
        onClick={() => setExpanded((previous) => !previous)}
      >
        Filters ({count} active)
      </Button>
      <div id="booking-filters" className={expanded ? 'block' : 'hidden lg:block'}>
        <p className="mb-3 hidden text-base sm:text-sm text-mute lg:block">Filters ({count} active)</p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="filter-status">Status</Label>
            <Select id="filter-status" name="status" defaultValue={filter.status ?? ''}>
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <Label htmlFor="filter-from">Visit from</Label>
            <Input id="filter-from" type="date" name="from" defaultValue={filter.from ?? ''} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="filter-to">Visit to</Label>
            <Input id="filter-to" type="date" name="to" defaultValue={filter.to ?? ''} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="filter-product">Product</Label>
            <Select id="filter-product" name="product" defaultValue={filter.productId ?? ''}>
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Link href="/admin/bookings/" className={buttonStyles({ variant: 'ghost' })}>Clear filters</Link>
        </div>
      </div>
      {filter.sort === 'asc' ? <input type="hidden" name="sort" value="asc" /> : null}
    </form>
  );
}
