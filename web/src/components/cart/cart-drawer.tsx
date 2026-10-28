'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { getLenis } from '@/components/site/smooth-scroll';
import { TLink } from '@/components/site/transition';
import { buttonStyles } from '@/components/ui/button';
import { useCart } from '@/lib/cart/store';
import { cartCount, isCartPath } from '@/lib/cart/types';
import { cn } from '@/lib/cn';
import { CartEmpty } from './cart-empty';
import { CartLineList, CartTotals } from './cart-lines';
import { SuggestionTiles, useCartSuggestions } from './cart-suggestions';
import { CloseIcon } from './icons';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noSubscription = () => () => {};
/** False on the server and during hydration, so the drawer adds nothing to the server-rendered HTML. */
const useIsClient = () =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

/** Stops the page behind the drawer from scrolling (Lenis and the native scrollbar) without the layout shifting sideways. */
function lockScroll(): () => void {
  const root = document.documentElement;
  const { overflow, paddingRight } = root.style;
  const scrollbar = window.innerWidth - root.clientWidth;
  getLenis()?.stop();
  root.style.overflow = 'hidden';
  if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
  return () => {
    root.style.overflow = overflow;
    root.style.paddingRight = paddingRight;
    getLenis()?.start();
  };
}

/**
 * The slide-in cart. Mounted once in the site layout; opens whenever `useCart().drawerOpen`
 * is true (adding to the cart, or the header cart button). A modal dialog: Esc and the
 * overlay close it, Tab stays inside it, focus returns to where it was, the page behind
 * cannot scroll. It stays out of the way on /cart/, which shows the same lines in full.
 */
export function CartDrawer() {
  const isClient = useIsClient();
  const pathname = usePathname();
  const titleId = useId();
  const lines = useCart((state) => state.lines);
  const drawerOpen = useCart((state) => state.drawerOpen);
  const closeDrawer = useCart((state) => state.closeDrawer);
  const panel = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);
  // The lines (and their thumbnails) are only built once the drawer has been opened for the first time.
  const [primed, setPrimed] = useState(false);

  const open = drawerOpen && !isCartPath(pathname);
  const count = cartCount(lines);
  const { suggestions, pending } = useCartSuggestions(open);

  useEffect(
    () =>
      useCart.subscribe((state) => {
        if (state.drawerOpen) setPrimed(true);
      }),
    [],
  );

  // Going to another page (a link in the drawer, or the back button) closes it.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockScroll();
    panel.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = panel.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const active = document.activeElement;
      const inside = dialog.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first || active === dialog) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      unlock();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, closeDrawer]);

  if (!isClient) return null;

  const showContent = primed || open;
  // A removed line (or an added suggestion) takes its own button with it: park focus on the dialog.
  const parkFocus = () => panel.current?.focus({ preventScroll: true });

  return (
    <div
      className={cn('fixed inset-0 z-[100] transition-[visibility] duration-0', open ? 'visible delay-0' : 'invisible pointer-events-none delay-500')}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <div aria-hidden onClick={closeDrawer} className={cn('absolute inset-0 bg-ink/45 transition-opacity duration-500 motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-[28.75rem] flex-col border-l border-line bg-bone shadow-[-24px_0_60px_-30px_rgba(20,18,17,0.4)] outline-none',
          'transition-transform duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="font-display text-2xl">
              Your cart
            </h2>
            <p role="status" className="text-sm text-mute">
              {count === 0 ? 'Nothing in your cart yet' : `${count} ${count === 1 ? 'item' : 'items'}`}
            </p>
          </div>
          <button type="button" onClick={closeDrawer} aria-label="Close cart" className="-mr-2 grid size-11 place-items-center rounded-full transition-colors hover:bg-bone-2">
            <CloseIcon />
          </button>
        </div>

        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
          {showContent ? (
            lines.length ? (
              <>
                <CartLineList lines={lines} layout="drawer" onRemoved={parkFocus} onNavigate={closeDrawer} />
                <div className="py-8">
                  <SuggestionTiles suggestions={suggestions} pending={pending} layout="drawer" headingLevel={3} onAdded={parkFocus} onNavigate={closeDrawer} />
                </div>
              </>
            ) : (
              <CartEmpty onNavigate={closeDrawer} />
            )
          ) : null}
        </div>

        {showContent ? (
          <div className="shrink-0 space-y-4 border-t border-line bg-bone px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">
            <CartTotals lines={lines} />
            <TLink href="/book-visit/" onClick={closeDrawer} className={cn(buttonStyles({ variant: 'primary', size: 'lg' }), 'w-full')}>
              Book a visit
            </TLink>
            {lines.length ? (
              <TLink href="/cart/" onClick={closeDrawer} className={cn(buttonStyles({ variant: 'ghost', size: 'lg' }), 'w-full')}>
                View cart
              </TLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
