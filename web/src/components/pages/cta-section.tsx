import { cn } from '@/lib/cn';

type CtaSectionProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  /** Buttons or links, shown on the dark background. */
  actions: React.ReactNode;
  /** Heading id; change it when a page uses more than one of these. */
  id?: string;
  className?: string;
};

/** Closing call to action on the ink background. */
export function CtaSection({ eyebrow = 'Next step', title, body, actions, id = 'cta-heading', className }: CtaSectionProps) {
  return (
    <section aria-labelledby={id} className={cn('mt-20 bg-ink text-bone lg:mt-28', className)}>
      <div className="site-container py-20 lg:py-28">
        <p className="eyebrow text-clay">{eyebrow}</p>
        <h2 id={id} className="mt-4 max-w-[20ch] text-[clamp(2rem,4.6vw,3.8rem)] font-light leading-[1]">
          {title}
        </h2>
        {body ? <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-bone/75">{body}</p> : null}
        <div className="mt-10 flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  );
}

/** Ghost button that reads on the ink background of a CtaSection. */
export const lightGhostBtn = 'btn-ghost border-bone/30 px-7 py-4 text-bone hover:border-bone hover:bg-bone hover:text-ink';
