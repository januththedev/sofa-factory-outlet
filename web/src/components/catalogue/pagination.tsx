'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TLink } from '@/components/site/transition';
import type { ShopParams } from '@/lib/catalogue/search';
import { paginationUrl } from './filter-state';

export function Pagination({ page, pages, path, params }: {
  page: number;
  pages: number;
  path: string;
  params: ShopParams;
}) {
  const router = useRouter();
  const previousPage = useRef(page);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    const grid = document.getElementById('product-grid');
    grid?.scrollIntoView({ block: 'start', behavior: 'instant' });
    grid?.focus({ preventScroll: true });
  }, [page]);

  if (pages <= 1) return null;
  const link = (number: number, label: string) => (
    <TLink
      href={paginationUrl(path, params, number)}
      scroll={false}
      aria-current={number === page ? 'page' : undefined}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (pending || number === page) return;
        startTransition(() => router.push(paginationUrl(path, params, number), { scroll: false }));
      }}
      className={`grid min-h-11 min-w-11 place-items-center rounded-full border px-3 text-base
        ${number === page ? 'border-maroon bg-maroon text-bone' : 'border-line'}`}
    >
      {label}
    </TLink>
  );
  return (
    <nav aria-label="Product pages" aria-busy={pending} className="mt-10">
      <ol className="flex flex-wrap justify-center gap-2">
        {page > 1 ? <li>{link(page - 1, 'Previous')}</li> : null}
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
          <li key={number}>{link(number, String(number))}</li>
        ))}
        {page < pages ? <li>{link(page + 1, 'Next')}</li> : null}
      </ol>
      <p role="status" className="sr-only">{pending ? 'Loading page…' : `Page ${page} of ${pages}`}</p>
    </nav>
  );
}
