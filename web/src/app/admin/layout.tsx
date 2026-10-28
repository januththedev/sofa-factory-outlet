import type { Metadata } from 'next';

// Everything under /admin is private: no indexing, no site header, footer or
// preloader (those live in the (site) route group).
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-bone text-ink">{children}</div>;
}
