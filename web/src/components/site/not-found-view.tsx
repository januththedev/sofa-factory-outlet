import Link from 'next/link';

/** The "no such page" content, shared by the site (with header and footer) and the bare root fallback. */
export function NotFoundView() {
  return (
    <div className="site-container flex min-h-[60svh] flex-col justify-center py-16 lg:py-24">
      <p className="eyebrow text-xs">Error 404</p>
      <h1 className="mt-4 max-w-[14ch] text-[clamp(2.5rem,8vw,6rem)] font-light leading-[1]">
        That page is not here.
      </h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
        The link may be old or mistyped. Here are a few good places to start.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop/" className="btn btn-primary">Browse the shop</Link>
        <Link href="/" className="btn btn-ghost">Home</Link>
        <Link href="/book-visit/" className="btn btn-ghost">Book a visit</Link>
      </div>
    </div>
  );
}
