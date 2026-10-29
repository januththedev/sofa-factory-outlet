'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Shown when a page crashes: the rest of the site (header, footer, cart) stays usable around it. */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="site-container flex min-h-[60svh] flex-col justify-center py-16 lg:py-24" role="alert">
      <p className="eyebrow text-xs">Something went wrong</p>
      <h1 className="mt-4 max-w-[16ch] text-[clamp(2.25rem,7vw,5rem)] font-light leading-[1]">
        This page did not load.
      </h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
        It was our side, not yours. Try again, or carry on from the shop. Nothing you added to your cart is lost.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/shop/" className="btn btn-ghost">Browse the shop</Link>
        <Link href="/" className="btn btn-ghost">Home</Link>
      </div>
    </div>
  );
}
