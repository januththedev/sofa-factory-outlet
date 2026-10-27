'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';

type Navigate = (href: string) => void;
const TransitionContext = createContext<Navigate | null>(null);

const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Curtain wipe between pages: a maroon panel slides up over the old page,
 * the route changes underneath it, then it slides away. Links opt in by using
 * <TLink>; anything else navigates normally.
 */
export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const curtain = useRef<HTMLDivElement>(null);
  const target = useRef<string | null>(null);
  const failsafe = useRef<number | undefined>(undefined);

  // Reveal once the new route has rendered.
  useEffect(() => {
    if (!target.current || !curtain.current) return;
    window.clearTimeout(failsafe.current);
    target.current = null;
    gsap.to(curtain.current, { yPercent: -100, duration: 0.7, ease: 'power3.inOut', delay: 0.05 });
  }, [pathname]);

  const navigate = useCallback<Navigate>(
    (href) => {
      const url = new URL(href, window.location.href);
      const samePage = url.pathname === window.location.pathname;
      if (samePage || window.matchMedia(REDUCED).matches || !curtain.current || target.current) {
        router.push(href);
        return;
      }
      target.current = url.pathname;
      gsap.set(curtain.current, { yPercent: 100 });
      gsap.to(curtain.current, {
        yPercent: 0,
        duration: 0.55,
        ease: 'power3.inOut',
        onComplete: () => router.push(href),
      });
      // If the route never changes (error, same URL), don't leave the curtain down.
      failsafe.current = window.setTimeout(() => {
        target.current = null;
        gsap.to(curtain.current, { yPercent: -100, duration: 0.5 });
      }, 5000);
    },
    [router],
  );

  return (
    <TransitionContext.Provider value={navigate}>
      {children}
      <div ref={curtain} aria-hidden className="page-curtain" />
    </TransitionContext.Provider>
  );
}

type TLinkProps = Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string };

/** next/link with the curtain transition for plain left-clicks on internal URLs. */
export function TLink({ href, onClick, ...props }: TLinkProps) {
  const navigate = useContext(TransitionContext);
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !navigate) return;
        const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
        const internal = href.startsWith('/') && !href.startsWith('//') && !href.includes('#');
        if (!plain || !internal || props.target === '_blank') return;
        event.preventDefault();
        navigate(href);
      }}
      {...props}
    />
  );
}
