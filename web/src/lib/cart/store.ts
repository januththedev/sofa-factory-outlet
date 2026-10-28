'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { CART_MAX_QUANTITY as MAX_QTY, type CartLine, cartCount, cartKey, clampQuantity, type NewCartLine, sanitiseLines } from './types';

type NewLine = NewCartLine;

type CartState = {
  lines: CartLine[];
  drawerOpen: boolean;
  /** Adds a line, or increases the quantity when the same product + colour is already in the cart. */
  add: (line: NewLine) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  /** Swap a line for another colour of the same product, keeping its quantity and its place in the list. */
  replace: (key: string, line: NewLine) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const STORAGE_KEY = 'sfo-cart-v1';

/**
 * localStorage that never throws. Unreadable saved data counts as "nothing saved" (zustand would
 * otherwise never finish hydrating), and a blocked or full store just means the cart lives in
 * memory for this visit (zustand would otherwise throw from add()).
 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const saved = localStorage.getItem(name);
      if (saved !== null) JSON.parse(saved);
      return saved;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // keep the cart in memory
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // nothing to remove from
    }
  },
};

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
          const qty = clampQuantity(line.quantity ?? 1);
          const existing = state.lines.find((l) => l.key === key);
          const lines = existing
            ? state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
            : [...state.lines, { ...line, key, quantity: qty }];
          return { lines, drawerOpen: true };
        }),
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      setQuantity: (key, quantity) =>
        set((state) => {
          if (!Number.isFinite(quantity)) return state;
          const next = Math.floor(quantity);
          return {
            lines: next <= 0 ? state.lines.filter((l) => l.key !== key) : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, next) } : l)),
          };
        }),
      replace: (key, line) =>
        set((state) => {
          const old = state.lines.find((l) => l.key === key);
          if (!old) return state;
          const nextKey = cartKey(line.productId, line.variantId);
          // Swapping to a colour that is already in the cart folds this line into that one.
          const clash = nextKey === key ? undefined : state.lines.find((l) => l.key === nextKey);
          const swapped: CartLine = { ...line, key: nextKey, quantity: Math.min(MAX_QTY, old.quantity + (clash?.quantity ?? 0)) };
          return {
            lines: state.lines.flatMap((l) => {
              if (l.key === key) return clash ? [] : [swapped];
              return l.key === nextKey ? [swapped] : [l];
            }),
          };
        }),
      clear: () => set({ lines: [] }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ lines: state.lines }),
      // The saved cart is not trusted: bad lines are dropped instead of breaking every page.
      merge: (persisted, current) => ({
        ...current,
        lines: persisted && typeof persisted === 'object' ? sanitiseLines((persisted as { lines?: unknown }).lines) : current.lines,
      }),
      skipHydration: true,
    },
  ),
);

/** Mount once in the site layout: restores the saved cart after hydration, and follows changes made in other tabs. */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) void useCart.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}

export const useCartCount = () => useCart((state) => cartCount(state.lines));

const subscribeToHydration = (notify: () => void) => useCart.persist.onFinishHydration(() => notify());
const isHydrated = () => useCart.persist.hasHydrated();
const notHydratedOnServer = () => false;

/** False on the server and during hydration, then true once the saved cart has been restored. */
export const useCartHydrated = () => useSyncExternalStore(subscribeToHydration, isHydrated, notHydratedOnServer);
