'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isTrackedPath, trackEvent } from '@/lib/analytics/client';

/** One `page_view` for the first load and for every client-side navigation. Renders nothing. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (isTrackedPath(pathname)) trackEvent('page_view');
  }, [pathname]);
  return null;
}
