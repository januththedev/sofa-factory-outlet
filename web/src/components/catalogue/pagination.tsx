import { TLink } from '@/components/site/transition';
import type { ShopParams } from '@/lib/catalogue/search';

function href(path: string, params: ShopParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page: page === 1 ? undefined : page })) {
    if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length)) query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  query.sort();
  return `${path}${query.size ? `?${query}` : ''}`;
}

export function Pagination({ page, pages, path, params }: { page: number; pages: number; path: string; params: ShopParams }) {
  if (pages <= 1) return null;
  return <nav aria-label="Product pages" className="mt-14"><ol className="flex flex-wrap justify-center gap-2">{Array.from({ length: pages }, (_, index) => index + 1).map((number) =>
    <li key={number}><TLink href={href(path, params, number)} aria-current={number === page ? 'page' : undefined}
      className={`grid h-10 min-w-10 place-items-center rounded-full border px-3 text-sm ${number === page ? 'border-maroon bg-maroon text-bone' : 'border-line hover:border-maroon'}`}>{number}</TLink></li>)}</ol></nav>;
}
