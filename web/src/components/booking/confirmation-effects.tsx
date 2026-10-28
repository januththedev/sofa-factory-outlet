'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { clearBookingDraft } from './draft';

/**
 * Runs once per booking, the first time its confirmation page opens in this
 * browser: empties the cart and records the submit. Coming back to the page
 * later (reload, back button, a saved link) does neither, so it can never wipe
 * a cart the visitor has started since.
 */
export function ConfirmationEffects({ reference, pieces }: { reference: string; pieces: number }) {
  const clear = useCart((state) => state.clear);

  useEffect(() => {
    const key = `sfo-booking-done:${reference}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, '1');
    } catch {
      // Storage is blocked: fall through and run once for this page view.
    }
    clearBookingDraft();
    // No visual effects or animation: confirmation text is readable immediately, including with reduced motion.
    // Restore the saved cart first, so a late restore cannot bring the old lines back after the clear.
    void Promise.resolve(useCart.persist.rehydrate()).then(() => clear());
    trackEvent('booking_submit', { value: { reference, pieces } });
  }, [reference, pieces, clear]);

  return null;
}
