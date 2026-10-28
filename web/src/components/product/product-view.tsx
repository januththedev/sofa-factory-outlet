'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics/client';

export function ProductView({ productId, variantId }: { productId: number; variantId: number }) {
  useEffect(() => trackEvent('product_view', { productId, variantId }), [productId, variantId]);
  return null;
}
