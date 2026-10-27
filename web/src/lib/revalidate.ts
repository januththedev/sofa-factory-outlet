import { revalidateTag } from 'next/cache';

// Cache tags used by the public site's unstable_cache wrappers. Call these from
// server actions and route handlers after a write (revalidateTag cannot run in
// client components or the proxy). 'max' serves stale content while fresh data
// loads, so visitors never wait on a revalidation.
export const TAGS = {
  products: 'products',
  categories: 'categories',
  settings: 'settings',
  reviews: 'reviews',
  redirects: 'redirects',
  kb: 'kb',
  guides: 'guides',
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

export function revalidateTags(...tags: CacheTag[]) {
  for (const tag of tags) revalidateTag(tag, 'max');
}

/** A product or category changed: store, landing page, product pages and sitemap refresh. */
export const revalidateCatalogue = () => revalidateTags(TAGS.products, TAGS.categories);
export const revalidateSettings = () => revalidateTags(TAGS.settings);
export const revalidateReviews = () => revalidateTags(TAGS.reviews, TAGS.products);
export const revalidateRedirects = () => revalidateTags(TAGS.redirects);
