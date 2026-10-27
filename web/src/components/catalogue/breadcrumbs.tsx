import { TLink } from '@/components/site/transition';
import { cn } from '@/lib/cn';

export type BreadcrumbItem = { name: string; href: string };

/** Visible breadcrumb trail; pair it with breadcrumbJsonLd() from @/lib/seo/jsonld for structured data. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-mute', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-ink">
                {item.name}
              </span>
            ) : (
              <TLink href={item.href} className="link-underline">
                {item.name}
              </TLink>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
