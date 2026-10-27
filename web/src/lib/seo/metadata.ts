import type { Metadata } from 'next';
import { siteUrl } from '../env';

export type PageMetadataInput = {
  title: string;
  description: string;
  /** path with leading and trailing slash, e.g. '/factory/' */
  path: string;
  noindex?: boolean;
  /** absolute or root-relative image URL for link previews */
  image?: string;
  /** use the title as is, without the "| Sofa Factory Outlet" suffix */
  absoluteTitle?: boolean;
};

/** Metadata for a public page: canonical, Open Graph and Twitter in one call. `metadataBase` is set in the root layout. */
export function pageMetadata(input: PageMetadataInput): Metadata {
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: input.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      url: `${siteUrl()}${input.path}`,
      title: input.title,
      description: input.description,
      siteName: 'Sofa Factory Outlet',
      locale: 'en_LK',
      images: input.image ? [{ url: input.image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description },
  };
}
