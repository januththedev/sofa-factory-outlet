'use client';

import { useEffect } from 'react';
import { useRef } from 'react';

export function ScrollTabs({ active, children }: { active: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = ref.current;
    const tab = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !tab) return;
    const left = tab.offsetLeft - rail.offsetLeft;
    if (left < rail.scrollLeft || left + tab.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollLeft = Math.max(0, left - (rail.clientWidth - tab.offsetWidth) / 2);
    }
  }, [active]);
  return <div ref={ref} className="relative min-w-0 max-w-full overflow-x-auto pb-1">{children}</div>;
}
