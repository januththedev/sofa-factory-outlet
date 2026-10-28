'use client';

import { useSyncExternalStore } from 'react';
import { keyboardInset } from './keyboard-inset';

function subscribe(update: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  return () => {
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

function snapshot() {
  const viewport = window.visualViewport;
  return viewport ? keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop) : 0;
}

export function useKeyboardInset() {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
