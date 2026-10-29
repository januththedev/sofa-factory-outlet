import { notFound } from 'next/navigation';
import { HUB_CONTENT } from '../../../../content/hubs';
import { getCollection } from '@/components/catalogue/server';

/**
 * The category pages stream behind a loading skeleton, and a 404 raised inside a streamed page
 * still answers 200. Checking here, before anything is sent, makes unknown URLs a real 404.
 */
export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const row = await getCollection(category);
  if (!row || !HUB_CONTENT[row.path] || row.path.includes('/')) notFound();
  return children;
}
