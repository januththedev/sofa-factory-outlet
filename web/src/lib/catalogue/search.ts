import { notImplemented } from '../not-implemented';
import type { FacetCount } from './types';
import type { ProductCard } from './queries';

// CONTRACT STUB. Owner: "store-listing" agent. Keep these exports and signatures.

export type ShopSort = 'featured' | 'newest' | 'price-asc' | 'price-desc';

/** Filters for /shop/ and category hubs; they live in the URL (`/shop/?colour=green&shape=l-shape`). */
export type ShopParams = {
  q?: string;
  /** category path, e.g. 'sofas' */
  category?: string;
  /** promoted hub path, e.g. 'sofas/l-shape' (applies the hub's saved filter) */
  hub?: string;
  colour?: string[];
  material?: string[];
  shape?: string[];
  seats?: number[];
  /** whole rupees */
  minPrice?: number;
  maxPrice?: number;
  sort?: ShopSort;
  page?: number;
  pageSize?: number;
};

export type ShopResult = {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  /** Counts reflect the other active filters, so options never lead to an empty result. */
  facets: { colour: FacetCount[]; material: FacetCount[]; shape: FacetCount[]; seats: FacetCount[]; price: { min: number | null; max: number | null } };
};

/** Published products only. Full-text + trigram search when `q` is set. */
export const searchProducts: (params: ShopParams) => Promise<ShopResult> = async () => notImplemented('searchProducts');

/** Turns Next's `searchParams` into validated ShopParams (unknown values are dropped, never thrown). */
export const parseShopParams: (searchParams: Record<string, string | string[] | undefined>) => ShopParams = () => notImplemented('parseShopParams');

/** Canonical URL for a filter state ('/shop/?colour=green'), used for links, canonicals and the chatbot. */
export const buildShopUrl: (params: ShopParams) => string = () => notImplemented('buildShopUrl');
