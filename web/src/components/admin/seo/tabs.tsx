import Link from 'next/link';
import { cn } from '@/lib/cn';

export const SEO_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'redirects', label: 'Redirects' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'requests', label: 'Review requests' },
  { key: 'report', label: 'Monthly report' },
] as const;

export type SeoTab = (typeof SEO_TABS)[number]['key'];

export function parseSeoTab(value: string | undefined): SeoTab {
  return SEO_TABS.find((tab) => tab.key === value)?.key ?? 'overview';
}

export const seoTabHref = (tab: SeoTab): string => (tab === 'overview' ? '/admin/seo/' : `/admin/seo/?tab=${tab}`);

/** Plain links rather than client state, so each tab has its own address and the back button works. */
export function SeoTabs({ active }: { active: SeoTab }) {
  return (
    <nav aria-label="SEO sections" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {SEO_TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={seoTabHref(tab.key)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  current ? 'border-maroon text-maroon' : 'border-transparent text-mute hover:text-ink',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
