import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-maroon text-bone hover:bg-maroon-deep',
        dark: 'bg-ink text-bone hover:bg-ink-2',
        ghost: 'border border-ink/20 text-ink hover:border-ink hover:bg-ink hover:text-bone',
        subtle: 'bg-bone-2 text-ink hover:bg-clay-soft',
        danger: 'bg-bad text-bone hover:bg-bad/90',
        link: 'rounded-none px-0 text-maroon underline-offset-4 hover:underline',
      },
      size: { sm: 'h-9 px-4 text-sm', md: 'h-11 px-6 text-sm', lg: 'h-13 px-8 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
