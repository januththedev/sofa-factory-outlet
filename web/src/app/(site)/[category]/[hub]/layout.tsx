import { notFound } from 'next/navigation';
import { HUB_CONTENT } from '../../../../../content/hubs';
import { getCollection } from '@/components/catalogue/server';

/**
 * Same reason as the category layout: decide "no such page" before the hub's loading skeleton streams a
 * 200. This layout sits outside that skeleton, and the category skeleton lives in (index)/ so it no longer
 * wraps hub pages.
 */
export default async function HubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string; hub: string }>;
}) {
  const { category, hub } = await params;
  const row = await getCollection(`${category}/${hub}`);
  if (!row || !HUB_CONTENT[row.path] || !row.parent) notFound();
  return children;
}
