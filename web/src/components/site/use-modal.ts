'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { getLenis } from './smooth-scroll';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Contain focus and native scrolling while a sheet is open, restoring both on close. */
export function useModal(
  open: boolean,
  rootRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
  returnFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const previousFocus = document.activeElement;
    const returnFocus = returnFocusRef?.current ?? previousFocus;
    const html = document.documentElement;
    const body = document.body;
    const previousOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;
    const lenis = getLenis();
    lenis?.stop();
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    // Inert siblings at each level, including content outside the site layout.
    const siblings = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = root;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.inert) {
          siblings.set(sibling, sibling.inert);
          sibling.setAttribute('inert', '');
        }
      }
      if (branch.parentElement === body) break;
      branch = branch.parentElement;
    }

    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((item) => item.tabIndex >= 0 && item.getClientRects().length > 0 && !item.closest('[inert]'));
    const focusFirst = () => (focusable()[0] ?? root).focus({ preventScroll: true });
    focusFirst();

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0] ?? root;
      const last = items[items.length - 1] ?? root;
      const active = document.activeElement;
      const outside = !root.contains(active);
      const boundary = event.shiftKey ? active === first || active === root : active === last;
      if (outside || boundary || items.length === 0) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      for (const [sibling, inert] of siblings) sibling.toggleAttribute('inert', inert);
      html.style.overflow = previousOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      lenis?.start();
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
    };
  }, [open, rootRef, onClose, returnFocusRef]);
}
