import type { ProductDetail } from '../catalogue/types';
import { siteUrl } from '../env';
import { getSettings } from '../settings/get';

// PARTLY CONTRACT STUB. Owner: "seo-core" agent. <JsonLd> is real; the builders are stubs. Keep exports and signatures.

/** Renders one JSON-LD block. `<` is escaped so a value can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export type Crumb = { name: string; path: string };

const absolutePageUrl = (path: string) => {
  const url = new URL(path, `${siteUrl()}/`);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
};

const absoluteAssetUrl = (path: string) => new URL(path, `${siteUrl()}/`).toString();
const socialUrls = (social: Record<string, string | null>) => Object.values(social).filter((value): value is string => Boolean(value));

export const breadcrumbJsonLd: (crumbs: Crumb[]) => Record<string, unknown> = (crumbs) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: absolutePageUrl(crumb.path) })),
});
/** Organization + WebSite for every page; sameAs from settings.business.social. */
export const organizationJsonLd: () => Promise<Array<Record<string, unknown>>> = async () => {
  const { business } = await getSettings();
  const sameAs = socialUrls(business.social);
  const url = absolutePageUrl('/');
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: business.name, url, logo: absoluteAssetUrl('/brand/logo.png'), sameAs },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: business.name, url },
  ];
};
/** FurnitureStore for Home and /visit/. Leaves out any detail with confirmed: false. */
export const furnitureStoreJsonLd: () => Promise<Record<string, unknown>> = async () => {
  const { business, hours } = await getSettings();
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'FurnitureStore', name: business.name,
    url: absolutePageUrl('/'), logo: absoluteAssetUrl('/brand/logo.png'), sameAs: socialUrls(business.social),
  };
  if (business.address.confirmed) {
    data.address = { '@type': 'PostalAddress', streetAddress: business.address.street, addressLocality: business.address.locality, addressRegion: business.address.city, postalCode: business.address.postalCode ?? undefined, addressCountry: business.address.country };
    data.priceRange = business.priceRange;
  }
  if (business.phone.confirmed && business.phone.number) data.telephone = business.phone.number;
  if (hours.confirmed) {
    data.openingHoursSpecification = Object.entries(hours.days).flatMap(([day, value]) => value ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens: value.open, closes: value.close }] : []);
  }
  return data;
};
/** Product + Offer (LKR) + aggregateRating when approved reviews exist. No Offer when the price is on request. */
export const productJsonLd: (product: ProductDetail) => Record<string, unknown> = (product) => {
  const colours = [...new Set(product.variants.map((variant) => variant.colourName))];
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name,
    description: product.shortDescription ?? product.descriptionMd,
    url: absolutePageUrl(`/product/${product.slug}/`),
    image: product.variants.flatMap((variant) => variant.images.map((image) => absoluteAssetUrl(image.src))),
    brand: { '@type': 'Brand', name: 'Sofa Factory Outlet' },
  };
  if (colours.length) data.color = colours.join(', ');
  if (product.material) data.material = product.material;
  if (product.dimensions) data.depth = product.dimensions;
  if (product.priceMinor !== null) data.offers = { '@type': 'Offer', priceCurrency: 'LKR', price: product.priceMinor / 100, availability: 'https://schema.org/InStock', url: absolutePageUrl(`/product/${product.slug}/`) };
  if (product.reviews.count > 0 && product.reviews.average !== null) data.aggregateRating = { '@type': 'AggregateRating', ratingValue: product.reviews.average, reviewCount: product.reviews.count };
  return data;
};
export const articleJsonLd: (article: { title: string; description: string; path: string; datePublished: string; dateModified?: string; author: string; image?: string }) => Record<string, unknown> = (article) => ({
  '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description,
  url: absolutePageUrl(article.path), mainEntityOfPage: absolutePageUrl(article.path), datePublished: article.datePublished,
  dateModified: article.dateModified ?? article.datePublished, author: { '@type': 'Person', name: article.author },
  publisher: { '@type': 'Organization', name: 'Sofa Factory Outlet', logo: { '@type': 'ImageObject', url: absoluteAssetUrl('/brand/logo.png') } },
  ...(article.image ? { image: absoluteAssetUrl(article.image) } : {}),
});
