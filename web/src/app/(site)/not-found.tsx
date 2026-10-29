import type { Metadata } from 'next';
import { NotFoundView } from '@/components/site/not-found-view';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function SiteNotFound() {
  return <NotFoundView />;
}
