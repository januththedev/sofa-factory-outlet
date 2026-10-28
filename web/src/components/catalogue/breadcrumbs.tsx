'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { TLink } from '@/components/site/transition';
import { cn } from '@/lib/cn';

export type BreadcrumbItem = { name: string; href: string };

/** A single scrolling line; the current page stays visible at the end of the trail. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentHref = items[items.length - 1]?.href;
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollLeft = list.scrollWidth;
  }, [currentHref]);

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0 max-w-full text-sm text-mute', className)}>
      <ol
        ref={listRef}
        className="-mx-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap px-2 py-1"
      >
        {items.map((item, index) => (
          <li key={item.href} className="flex shrink-0 items-center gap-2">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="flex min-h-11 items-center text-ink">
                {item.name}
              </span>
            ) : (
              <TLink
                href={item.href}
                className="link-underline -mx-1 inline-flex min-h-11 min-w-11 items-center px-1"
              >
                {item.name}
              </TLink>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
