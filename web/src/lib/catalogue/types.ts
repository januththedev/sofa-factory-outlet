import type { Dimensions } from '../db/schema/types';
import type { PictureData } from '../images/urls';

/** One colour variant of a product, with its photos ready to render. */
export type ProductVariantView = {
  id: number;
  colourName: string;
  hex: string;
  family: string;
  tone: 'light' | 'mid' | 'dark';
  warmth: 'warm' | 'cool' | 'neutral';
  inStock: boolean;
  isDefault: boolean;
  images: PictureData[];
};

/** Everything the product page needs. Only published products are ever returned by the public queries. */
export type ProductDetail = {
  id: number;
  slug: string;
  name: string;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { id: number; name: string; path: string };
  descriptionMd: string;
  shortDescription: string | null;
  sellingPoints: string | null;
  material: string | null;
  shape: string | null;
  seats: number | null;
  dimensions: Dimensions | null;
  /** e.g. { Size: ['King', 'Queen'] } */
  attributes: Record<string, string[]>;
  priceMinor: number | null;
  compareAtMinor: number | null;
  priceFrom: boolean;
  tags: string[];
  featured: boolean;
  noindex: boolean;
  publishedAt: string | null;
  updatedAt: string;
  variants: ProductVariantView[];
  reviews: { count: number; average: number | null };
};

/** A filter option with how many published products match it. */
export type FacetCount = { value: string; label: string; count: number; hex?: string };
