import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundView } from '@/components/site/not-found-view';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

/** Fallback for URLs outside the public site (the site has its own, with the header and footer). */
export default function RootNotFound() {
  return (
    <main className="min-h-svh bg-bone text-ink">
      <div className="site-container pt-6">
        <Link href="/" className="font-semibold">Sofa Factory Outlet</Link>
      </div>
      <NotFoundView />
    </main>
  );
}
