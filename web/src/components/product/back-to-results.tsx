'use client';

import { useSyncExternalStore } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TLink } from '@/components/site/transition';
import { markReturning } from '@/components/catalogue/results-memory';
import { parseResults } from '@/components/catalogue/results-memory';
import { readProductResults } from '@/components/catalogue/results-memory';
import { attachProductResults } from '@/components/catalogue/results-memory';
import { resultsEvent } from '@/components/catalogue/results-memory';

const subscribe = (notify: () => void) => {
  window.addEventListener('pageshow', notify);
  window.addEventListener('popstate', notify);
  window.addEventListener(resultsEvent, notify);
  return () => {
    window.removeEventListener('pageshow', notify);
    window.removeEventListener('popstate', notify);
    window.removeEventListener(resultsEvent, notify);
  };
};
const serverSnapshot = () => '';

export function BackToResults({ categoryPath }: { categoryPath: string }) {
  const snapshot = useSyncExternalStore(subscribe, readProductResults, serverSnapshot);
  const path = usePathname();
  useEffect(() => attachProductResults(path), [path]);
  const memory = parseResults(snapshot);
  const fromResults = memory?.product === path;
  return (
    <TLink
      href={fromResults && memory ? memory.url : categoryPath}
      className="mb-4 inline-flex min-h-11 items-center gap-2 text-base underline"
      onClick={(event) => {
        if (!fromResults || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        markReturning(snapshot);
        if (window.history.length > 1) {
          event.preventDefault();
          window.history.back();
        }
      }}
    >
      {fromResults ? 'Back to results' : 'Back to collection'}
    </TLink>
  );
}
