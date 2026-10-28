'use client';

import { TLink } from '@/components/site/transition';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Shown in the drawer and on the cart page when there is nothing in the cart. */
export function CartEmpty({ large = false, onNavigate }: { large?: boolean; onNavigate?: () => void }) {
  return (
    <div className={large ? 'max-w-xl py-4' : 'py-10'}>
      <p className={cn('font-display font-light', large ? 'text-4xl' : 'text-2xl')}>Your cart is empty</p>
      <p className={cn('mt-3 text-ink-2', large ? 'text-base' : 'text-sm')}>
        Find a sofa you like, or look around the whole shop. You can also book a showroom visit without choosing anything first.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <TLink href="/sofas/" onClick={onNavigate} className={buttonStyles({ variant: 'primary', size: large ? 'lg' : 'md' })}>
          Browse sofas
        </TLink>
        <TLink href="/shop/" onClick={onNavigate} className={buttonStyles({ variant: 'ghost', size: large ? 'lg' : 'md' })}>
          See the whole shop
        </TLink>
      </div>
    </div>
  );
}
