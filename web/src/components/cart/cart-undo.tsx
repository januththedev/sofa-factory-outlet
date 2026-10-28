'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/lib/cart/store';
import { CART_MAX_QUANTITY } from '@/lib/cart/types';
import type { CartLine } from '@/lib/cart/types';

export function useCartUndo() {
  const [removed, setRemoved] = useState<CartLine | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const remember = (line: CartLine) => {
    clearTimeout(timer.current);
    setRemoved(line);
    timer.current = setTimeout(() => setRemoved(null), 5000);
  };
  const undo = () => {
    if (!removed) return;
    clearTimeout(timer.current);
    useCart.setState((state) => {
      const existing = state.lines.find((line) => line.key === removed.key);
      return {
        lines: existing
          ? state.lines.map((line) => line.key === removed.key
            ? { ...line, quantity: Math.min(CART_MAX_QUANTITY, line.quantity + removed.quantity) }
            : line)
          : [...state.lines, removed],
      };
    });
    setRemoved(null);
  };
  return { removed, remember, undo };
}

export function CartUndoNotice({ removed, undo }: { removed: CartLine | null; undo: () => void }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {removed ? (
        <div className="my-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-3">
          <p className="min-w-0 flex-1 break-words text-base">Removed {removed.name}.</p>
          <button type="button" onClick={undo} className="min-h-11 min-w-11 px-3 font-semibold underline">
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
