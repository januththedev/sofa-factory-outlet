'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { type CartLine, cartCount, cartKey } from './types';

type NewLine = Omit<CartLine, 'key' | 'quantity'> & { quantity?: number };

type CartState = {
  lines: CartLine[];
  drawerOpen: boolean;
  /** Adds a line, or increases the quantity when the same product + colour is already in the cart. */
  add: (line: NewLine) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  /** Swap a line for another colour of the same product, keeping its quantity. */
  replace: (key: string, line: NewLine) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const MAX_QTY = 20;

/**
 * Browser cart (Plan.md: Zustand persisted to localStorage, no account needed).
 * Persistence uses skipHydration so server and first client render match;
 * <CartHydrator /> restores it right after hydration.
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      drawerOpen: false,
      add: (line) =>
        set((state) => {
          const key = cartKey(line.productId, line.variantId);
          const qty = Math.min(MAX_QTY, Math.max(1, line.quantity ?? 1));
          const existing = state.lines.find((l) => l.key === key);
          const lines = existing
            ? state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
            : [...state.lines, { ...line, key, quantity: qty }];
          return { lines, drawerOpen: true };
        }),
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
        })),
      replace: (key, line) =>
        set((state) => {
          const old = state.lines.find((l) => l.key === key);
          if (!old) return state;
          const nextKey = cartKey(line.productId, line.variantId);
          const merged = state.lines.filter((l) => l.key !== key);
          const clash = merged.find((l) => l.key === nextKey);
          const quantity = Math.min(MAX_QTY, old.quantity + (clash?.quantity ?? 0));
          return {
            lines: [...merged.filter((l) => l.key !== nextKey), { ...line, key: nextKey, quantity }],
          };
        }),
      clear: () => set({ lines: [] }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: 'sfo-cart-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
      skipHydration: true,
    },
  ),
);

/** Mount once in the site layout: restores the saved cart after hydration. */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);
  return null;
}

export const useCartCount = () => useCart((state) => cartCount(state.lines));
