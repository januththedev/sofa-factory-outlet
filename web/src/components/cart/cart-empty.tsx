'use client';

import { TLink } from '@/components/site/transition';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Props = { large?: boolean; onNavigate?: () => void };

export function CartEmpty({ large = false, onNavigate }: Props) {
  return (
    <div className={large ? 'max-w-xl py-4' : 'py-6'}>
      <p className={cn('font-display font-light', large ? 'text-4xl' : 'text-2xl')}>Your cart is empty</p>
      <p className="mt-3 text-base text-ink-2">
        Find a sofa you like, or look around the whole shop.
        You can also book a showroom visit without choosing anything first.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <TLink
          href="/sofas/"
          onClick={onNavigate}
          className={buttonStyles({ variant: 'primary', size: large ? 'lg' : 'md' })}
        >
          Browse sofas
        </TLink>
        <TLink
          href="/shop/"
          onClick={onNavigate}
          className={buttonStyles({ variant: 'ghost', size: large ? 'lg' : 'md' })}
        >
          See the whole shop
        </TLink>
      </div>
    </div>
  );
}
