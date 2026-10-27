import { notImplemented } from '../not-implemented';
import type { ProductCard } from './queries';
import type { ProductDetail } from './types';

// CONTRACT STUB. Owner: "product-page" agent. Keep these exports and signatures.

/** A published product by slug, or null (hidden/draft products return null; the proxy redirects them). */
export const productBySlug: (slug: string) => Promise<ProductDetail | null> = async () => notImplemented('productBySlug');

/** Slugs of every published product, for generateStaticParams. */
export const publishedSlugs: () => Promise<string[]> = async () => notImplemented('publishedSlugs');

/** Other published products from the same category, newest first, excluding `productId`. */
export const relatedProducts: (productId: number, limit?: number) => Promise<ProductCard[]> = async () => notImplemented('relatedProducts');
