import { Breadcrumbs } from '@/components/catalogue/breadcrumbs';
import type { BreadcrumbItem } from '@/components/catalogue/breadcrumbs';
import { cn } from '@/lib/cn';

type PageHeaderProps = {
  /** Small line above the title. */
  eyebrow: string;
  title: string;
  /** The paragraph under the title. */
  lede?: string;
  /** A small meta line under the title, e.g. date and reading time. */
  meta?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
};

/** Editorial page opening: eyebrow, one big light serif h1, optional lede. One h1 per page. */
export function PageHeader({ eyebrow, title, lede, meta, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('site-container min-w-0 pt-8 lg:pt-24', className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-5 lg:mb-8" /> : null}
      <p className="eyebrow text-xs">{eyebrow}</p>
      <h1
        className={cn(
          'mt-4 max-w-[18ch] break-words text-balance font-light leading-[1.05]',
          'text-[clamp(2rem,6.5vw,5.8rem)] lg:mt-5',
        )}
      >
        {title}
      </h1>
      {meta ? <div className="mt-5 text-sm text-mute lg:mt-6">{meta}</div> : null}
      {lede ? (
        <p className="mt-5 max-w-[54ch] break-words text-base leading-relaxed text-ink-2 lg:mt-8 lg:text-xl">
          {lede}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap [&>a]:min-h-11 [&>a]:w-full sm:[&>a]:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
