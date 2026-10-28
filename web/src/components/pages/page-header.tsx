import { Breadcrumbs, type BreadcrumbItem } from '@/components/catalogue/breadcrumbs';
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
  className?: string;
};

/** Editorial page opening: eyebrow, one big light serif h1, optional lede. One h1 per page. */
export function PageHeader({ eyebrow, title, lede, meta, breadcrumbs, className }: PageHeaderProps) {
  return (
    <header className={cn('site-container pt-28 lg:pt-40', className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-8" /> : null}
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-5 max-w-[18ch] text-[clamp(2.6rem,6.5vw,5.8rem)] font-light leading-[1]">{title}</h1>
      {meta ? <div className="mt-6 text-sm text-mute">{meta}</div> : null}
      {lede ? <p className="mt-8 max-w-[54ch] text-lg leading-relaxed text-ink-2 lg:text-xl">{lede}</p> : null}
    </header>
  );
}
