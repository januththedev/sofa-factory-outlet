'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useScrolledPast } from '@/lib/motion/hooks';
import { Magnetic } from './magnetic';
import { getLenis } from './smooth-scroll';
import { TLink } from './transition';

const NAV = [
  { href: '/shop/', label: 'Shop' },
  { href: '/sofas/', label: 'Sofas' },
  { href: '/factory/', label: 'The factory' },
  { href: '/visit/', label: 'Visit' },
  { href: '/about-us/', label: 'About' },
];

export function Header() {
  const pathname = usePathname();
  const solid = useScrolledPast(60);
  // The menu counts as open only on the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    setOpenOn(value ? pathname : null);
  };

  // Lock scrolling while the menu is open.
  useEffect(() => {
    if (open) getLenis()?.stop();
    else getLenis()?.start();
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
      getLenis()?.start();
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
          solid || open ? 'bg-bone/95 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="site-container flex h-[68px] items-center justify-between lg:h-[84px]">
          <TLink href="/" aria-label="Sofa Factory Outlet, home" className="block shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Sofa Factory Outlet" width={2111} height={503} className="h-9 w-auto lg:h-11" />
          </TLink>

          <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
            {NAV.map((item) => (
              <TLink
                key={item.href}
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                className="link-underline text-[0.95rem] font-medium"
              >
                {item.label}
              </TLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Magnetic className="hidden sm:inline-block">
              <TLink href="/book-visit/" className="btn-primary">
                Book a visit
              </TLink>
            </Magnetic>
            <button
              type="button"
              className="relative grid h-11 w-11 place-items-center rounded-full border border-ink/15 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <span className={`absolute h-px w-5 bg-ink transition-transform duration-300 ${open ? 'rotate-45' : '-translate-y-1.5'}`} />
              <span className={`absolute h-px w-5 bg-ink transition-opacity duration-300 ${open ? 'opacity-0' : ''}`} />
              <span className={`absolute h-px w-5 bg-ink transition-transform duration-300 ${open ? '-rotate-45' : 'translate-y-1.5'}`} />
            </button>
          </div>
        </div>
      </header>

      <div
        id="mobile-menu"
        className={`fixed inset-0 z-30 flex flex-col bg-ink px-6 pb-10 pt-28 text-bone transition-[clip-path] duration-700 ease-[var(--ease-in-out-quart)] lg:hidden ${
          open ? '[clip-path:inset(0_0_0_0)]' : '[clip-path:inset(0_0_100%_0)]'
        }`}
        aria-hidden={!open}
        inert={!open}
      >
        <nav aria-label="Mobile" className="flex flex-col gap-1">
          {NAV.map((item, index) => (
            <TLink
              key={item.href}
              href={item.href}
              className="border-b border-bone/10 py-4 font-display text-4xl transition-all duration-700"
              style={{ transitionDelay: open ? `${200 + index * 70}ms` : '0ms', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(24px)' }}
            >
              {item.label}
            </TLink>
          ))}
        </nav>
        <TLink href="/book-visit/" className="btn-primary mt-auto w-full justify-center py-4 text-base">
          Book a showroom visit
        </TLink>
      </div>
    </>
  );
}
