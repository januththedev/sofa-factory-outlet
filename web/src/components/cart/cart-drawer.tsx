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
import { CartUndoNotice, useCartUndo } from './cart-undo';
import { CloseIcon } from './icons';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');
const noSubscription = () => () => {};
const isClientSnapshot = () => true;
const isServerSnapshot = () => false;

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

/** Bottom sheet on phones, side drawer on larger screens; both use the same modal focus trap. */
export function CartDrawer() {
  const isClient = useSyncExternalStore(noSubscription, isClientSnapshot, isServerSnapshot);
  const pathname = usePathname();
  const titleId = useId();
  const lines = useCart((state) => state.lines);
  const drawerOpen = useCart((state) => state.drawerOpen);
  const closeDrawer = useCart((state) => state.closeDrawer);
  const panel = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);
  const [primed, setPrimed] = useState(false);
  const { removed, remember, undo } = useCartUndo();
  const open = drawerOpen && !isCartPath(pathname);
  const count = cartCount(lines);
  const { suggestions, pending } = useCartSuggestions(open);

  useEffect(() => useCart.subscribe((state) => {
    if (state.drawerOpen) setPrimed(true);
  }), []);

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
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const active = document.activeElement;
      const inside = dialog.contains(active);
      if (event.shiftKey && (!inside || active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
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
  const parkFocus = () => panel.current?.focus({ preventScroll: true });

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] transition-[visibility] duration-0',
        open ? 'visible' : 'invisible pointer-events-none delay-200',
      )}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <div
        aria-hidden
        onClick={closeDrawer}
        className={cn(
          'absolute inset-0 bg-ink/45 transition-opacity duration-200 motion-reduce:transition-none',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line',
          'bg-bone shadow-xl outline-none sm:inset-x-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-h-dvh',
          'sm:max-w-[28.75rem] sm:rounded-none transition-transform duration-200 motion-reduce:transition-none',
          open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
        )}
      >
        <div aria-hidden className="flex h-6 shrink-0 items-center justify-center sm:hidden">
          <span className="h-1 w-12 rounded-full bg-ink/20" />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
          <div>
            <h2 id={titleId} className="font-display text-2xl">Your cart</h2>
            <p role="status" className="text-base text-mute">
              {count === 0 ? 'Nothing in your cart yet' : `${count} ${count === 1 ? 'item' : 'items'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bone-2"
          >
            <CloseIcon />
          </button>
        </div>
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6">
          <CartUndoNotice removed={removed} undo={undo} />
          {showContent ? (
            lines.length ? (
              <>
                <CartLineList
                  lines={lines}
                  layout="drawer"
                  onRemoved={(line) => {
                    remember(line);
                    parkFocus();
                  }}
                  onNavigate={closeDrawer}
                />
                <div className="py-6">
                  <SuggestionTiles
                    suggestions={suggestions}
                    pending={pending}
                    layout="drawer"
                    headingLevel={3}
                    onAdded={parkFocus}
                    onNavigate={closeDrawer}
                  />
                </div>
              </>
            ) : <CartEmpty onNavigate={closeDrawer} />
          ) : null}
        </div>
        {showContent ? (
          <div
            data-sticky-bar={open ? true : undefined}
            className={[
              'shrink-0 space-y-3 border-t border-line bg-bone px-4 pt-3 sm:px-6',
              'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
            ].join(' ')}
          >
            <CartTotals lines={lines} />
            <TLink
              href="/book-visit/"
              onClick={closeDrawer}
              className={cn(buttonStyles({ variant: 'primary', size: 'lg' }), 'w-full')}
            >
              Book a visit
            </TLink>
            {lines.length ? (
              <TLink
                href="/cart/"
                onClick={closeDrawer}
                className={cn(buttonStyles({ variant: 'ghost', size: 'md' }), 'w-full')}
              >
                View cart
              </TLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
