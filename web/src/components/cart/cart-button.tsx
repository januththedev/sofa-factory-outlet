'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TLink } from '@/components/site/transition';
import { useCart, useCartCount } from '@/lib/cart/store';
import { cartCount, isCartPath } from '@/lib/cart/types';
import { cn } from '@/lib/cn';
import { BagIcon } from './icons';

/** Header cart link; plain clicks open the drawer and modified clicks keep normal navigation. */
export function CartButton() {
  const count = useCartCount();
  const pathname = usePathname();
  const openDrawer = useCart((state) => state.openDrawer);
  const badge = useRef<HTMLSpanElement>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => useCart.subscribe((state, previous) => {
    const next = cartCount(state.lines);
    if (next === cartCount(previous.lines) || !useCart.persist.hasHydrated()) return;
    setAnnouncement(next === 0 ? 'Your cart is empty' : `Cart updated, ${next} ${next === 1 ? 'item' : 'items'}`);
    if (next > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      badge.current?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }],
        { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  }), []);

  return (
    <span className="relative inline-flex">
      <TLink
        href="/cart/"
        aria-label={count ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart, empty'}
        onClick={(event) => {
          const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
          if (!plain || isCartPath(pathname)) return;
          event.preventDefault();
          openDrawer();
        }}
        className={[
          'relative grid size-11 place-items-center rounded-full border border-ink/15',
          'transition-colors duration-200 hover:bg-ink hover:text-bone',
        ].join(' ')}
      >
        <BagIcon />
        <span
          ref={badge}
          aria-hidden
          className={cn(
            'absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-maroon px-1',
            'text-xs font-semibold leading-none text-bone transition-[transform,opacity] duration-200',
            'motion-reduce:transition-none',
            count > 0 ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
          )}
        >
          {count > 99 ? '99+' : count || ''}
        </span>
      </TLink>
      <span role="status" className="sr-only">{announcement}</span>
    </span>
  );
}
