'use client';

import { useEffect } from 'react';

export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      if (link.href === window.location.href || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Leave this page? Your unsaved changes will be lost.')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const change = event as Event & { navigationType?: string; canIntercept?: boolean; hashChange?: boolean };
      if (change.navigationType !== 'traverse' || !change.canIntercept || change.hashChange) return;
      if (!window.confirm('Leave this page? Your unsaved changes will be lost.')) event.preventDefault();
    };
    navigation?.addEventListener('navigate', traverse);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      navigation?.removeEventListener('navigate', traverse);
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty]);
}
