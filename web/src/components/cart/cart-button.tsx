'use client';

import { TLink } from '@/components/site/transition';
import { useCartCount } from '@/lib/cart/store';

/** Header cart link with an item badge. The cart agent may restyle it but keeps the export name. */
export function CartButton() {
  const count = useCartCount();
  return (
    <TLink href="/cart/" aria-label={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'} className="relative grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-lg">
      <span aria-hidden>🛋</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-maroon px-1 text-[0.7rem] font-semibold text-bone">{count}</span>
      ) : null}
    </TLink>
  );
}
