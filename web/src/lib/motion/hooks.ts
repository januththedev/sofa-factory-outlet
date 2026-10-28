'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribeQuery(query: string) {
  return (notify: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  };
}

/** Live `matchMedia` flag; `serverValue` is what the first (server-matching) render sees. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    subscribeQuery(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)');

function subscribeVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}

/** Stop decorative rendering while the browser tab is in the background. */
export const usePageVisible = () => useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => false);

/** Unlike useNearViewport, this also becomes false after an element leaves the screen. */
export function useInViewport<T extends Element>(): [React.RefCallback<T>, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, visible];
}

/** True once the page has loaded and the browser is idle, so heavy code never competes with the first paint. */
export function useIdleAfterLoad(timeoutMs = 2500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const fire = () => !cancelled && setReady(true);
      if ('requestIdleCallback' in window) window.requestIdleCallback(fire, { timeout: timeoutMs });
      else setTimeout(fire, 200);
    };
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', run);
    };
  }, [timeoutMs]);
  return ready;
}

/** True the first time the element comes within `rootMargin` of the viewport. */
export function useNearViewport<T extends Element>(rootMargin = '400px'): [React.RefCallback<T>, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, near, rootMargin]);
  return [setNode, near];
}

let webglSupport: boolean | undefined;

/** Whether this browser can create a WebGL context (checked once; client only). */
export function hasWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webglSupport = Boolean(context);
    // The probe must not keep an extra GPU context alive alongside the actual scenes.
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const subscribeNever = () => () => {};
/** `false` on the server and during hydration, then the real answer. */
export const useWebGL = () => useSyncExternalStore(subscribeNever, hasWebGL, () => false);

/** Window scroll position past `threshold` px, without a setState-in-effect. */
export function useScrolledPast(threshold: number): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('scroll', notify, { passive: true });
      return () => window.removeEventListener('scroll', notify);
    },
    () => window.scrollY > threshold,
    () => false,
  );
}
