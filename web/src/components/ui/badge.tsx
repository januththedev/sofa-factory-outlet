import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badge = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-bone-2 text-ink-2',
      maroon: 'bg-maroon/10 text-maroon',
      good: 'bg-good/10 text-good',
      warn: 'bg-warn/15 text-warn',
      bad: 'bg-bad/10 text-bad',
      dark: 'bg-ink text-bone',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
