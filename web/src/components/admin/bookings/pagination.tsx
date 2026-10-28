import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const disabled = 'pointer-events-none opacity-50';

/** Previous / next links for a list that pages through the URL. */
export function Pagination({
  page,
  pageCount,
  total,
  noun,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  /** "bookings", "customers" */
  noun: string;
  hrefFor: (page: number) => string;
}) {
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;
  return (
    <nav aria-label="Pages" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-base sm:text-sm text-mute" aria-live="polite">
        {total.toLocaleString('en-GB')} {noun} · page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={!hasPrevious}
          tabIndex={hasPrevious ? undefined : -1}
          className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), !hasPrevious && disabled)}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Link>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), !hasNext && disabled)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
