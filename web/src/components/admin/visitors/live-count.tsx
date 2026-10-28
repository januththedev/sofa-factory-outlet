'use client';

import { useEffect, useState } from 'react';

/** Live "on the site now" count, refreshed every 30 seconds. */
export function LiveCount({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/admin/live/', { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json()) as { count?: unknown };
        if (active && typeof body.count === 'number') setCount(body.count);
      } catch {
        // Keep the last count when the network hiccups.
      }
    };
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return <span aria-live="polite">{count}</span>;
}
