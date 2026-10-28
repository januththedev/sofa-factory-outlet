'use client';

import { useEffect, useState } from 'react';
import { pollWhenVisible } from '@/lib/polling';

/** Live "on the site now" count, refreshed every 30 seconds. */
export function LiveCount({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    const refresh = async (signal: AbortSignal) => {
      try {
        const response = await fetch('/api/admin/live/', { cache: 'no-store', signal });
        if (!response.ok) return;
        const body = (await response.json()) as { count?: unknown };
        if (!signal.aborted && typeof body.count === 'number') setCount(body.count);
      } catch {
        // Keep the last count when the network hiccups.
      }
    };
    return pollWhenVisible(refresh, 30_000, { immediate: false });
  }, []);

  return <span aria-live="polite">{count}</span>;
}
