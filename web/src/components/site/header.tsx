'use client';

import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { CartButton } from '@/components/cart/cart-button';
import { useScrolledPast } from '@/lib/motion/hooks';
import { Magnetic } from './magnetic';
import { TLink } from './transition';
import { useModal } from './use-modal';

const NAV = [
  { href: '/shop/', label: 'Shop' },
  { href: '/about-us/', label: 'About' },
  { href: '/factory/', label: 'Factory' },
  { href: '/visit/', label: 'Visit' },
  { href: '/guides/', label: 'Guides' },
];

export function Header({ whatsapp }: { whatsapp?: string | null }) {
  const pathname = usePathname();
  const solid = useScrolledPast(60);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpenOn(null), []);
  useModal(open, menuRef, close);

  // Derived visibility closes immediately; clearing the saved route prevents reopening on Back.
  useEffect(() => {
    if (openOn === null || openOn === pathname) return;
    const frame = window.requestAnimationFrame(close);
    return () => window.cancelAnimationFrame(frame);
  }, [openOn, pathname, close]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      if (query.matches) close();
    };
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, [close]);

  return (
    <>
      <header
        className={`site-header fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${
          solid || open ? 'bg-bone/95 shadow-[0_1px_0_var(--color-line)]' : 'bg-bone/95 lg:bg-transparent'
        }`}
      >
        <div className="site-container flex h-16 items-center justify-between gap-2">
          <TLink
            href="/"
            aria-label="Sofa Factory Outlet, home"
            className="flex min-h-11 min-w-11 shrink-0 items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="Sofa Factory Outlet"
              width={2111}
              height={503}
              className="h-auto w-[148px] sm:w-[180px]"
            />
          </TLink>

          <nav aria-label="Main" className="hidden items-center gap-4 lg:flex">
            {NAV.map((item) => (
              <TLink
                key={item.href}
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                className="link-underline flex min-h-11 min-w-11 items-center text-base font-medium"
              >
                {item.label}
              </TLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* Magnetic always sets display, so the hiding lives on a plain wrapper (phones book from the menu). */}
            <div className="hidden sm:block">
              <Magnetic>
                <TLink href="/book-visit/" className="btn-primary whitespace-nowrap">
                  Book a visit
                </TLink>
              </Magnetic>
            </div>
            <CartButton />
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-haspopup="dialog"
              aria-label="Open menu"
              onClick={() => setOpenOn(pathname)}
            >
              <span aria-hidden className="flex flex-col gap-[5px]">
                <span className="h-px w-5 bg-ink" />
                <span className="h-px w-5 bg-ink" />
                <span className="h-px w-5 bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={menuRef}
        id="mobile-menu"
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label="Site menu"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        data-lenis-prevent
        className={`fixed inset-0 z-50 h-dvh bg-ink/50 ${open ? '' : 'hidden'}`}
      >
        <div aria-hidden onClick={close} className="absolute inset-0" />
        <div
          className="relative flex h-full w-[calc(100%-1rem)] flex-col overflow-y-auto bg-ink px-5 text-bone
            pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
        >
          <div className="flex min-h-16 shrink-0 items-center justify-between gap-2">
            <p className="text-base font-semibold">Sofa Factory Outlet</p>
            <button
              type="button"
              aria-label="Close menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={close}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-bone/25"
            >
              <span aria-hidden className="text-2xl">×</span>
            </button>
          </div>
          <nav aria-label="Mobile" className="flex flex-col gap-2 py-2">
            {NAV.map((item) => (
              <TLink
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                className="flex min-h-14 items-center border-b border-bone/10 font-display text-3xl"
              >
                {item.label}
              </TLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 pt-6">
            <TLink href="/book-visit/" onClick={close} className="btn-primary min-h-14 whitespace-nowrap">
              Book a visit
            </TLink>
            {whatsapp ? (
              <a href={whatsapp} className="btn min-h-14 border border-bone/25" onClick={close}>
                Chat on WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
