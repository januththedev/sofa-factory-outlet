import { notImplemented } from '../not-implemented';
import type { ProductDetail } from '../catalogue/types';

// PARTLY CONTRACT STUB. Owner: "seo-core" agent. <JsonLd> is real; the builders are stubs. Keep exports and signatures.

/** Renders one JSON-LD block. `<` is escaped so a value can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export type Crumb = { name: string; path: string };

export const breadcrumbJsonLd: (crumbs: Crumb[]) => Record<string, unknown> = () => notImplemented('breadcrumbJsonLd');
/** Organization + WebSite for every page; sameAs from settings.business.social. */
export const organizationJsonLd: () => Promise<Array<Record<string, unknown>>> = async () => notImplemented('organizationJsonLd');
/** FurnitureStore for Home and /visit/. Leaves out any detail with confirmed: false. */
export const furnitureStoreJsonLd: () => Promise<Record<string, unknown>> = async () => notImplemented('furnitureStoreJsonLd');
/** Product + Offer (LKR) + aggregateRating when approved reviews exist. No Offer when the price is on request. */
export const productJsonLd: (product: ProductDetail) => Record<string, unknown> = () => notImplemented('productJsonLd');
export const articleJsonLd: (article: { title: string; description: string; path: string; datePublished: string; dateModified?: string; author: string; image?: string }) => Record<string, unknown> = () =>
  notImplemented('articleJsonLd');
