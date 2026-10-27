import manifest from '@seed/media-manifest.json';
import type { ImageRef } from '../db/schema/types';
import { imageUrl, type PictureData, pictureData } from './urls';

// Editorial photos from the old site, keyed by role. The manifest is imported
// statically so pages (including ISR re-renders on Vercel) never read files.
// All of these are stand-ins: the plan's biggest upgrade is original photography.
const FILES = {
  hero: '2025/11/shoplook01-scaled.jpg',
  showroom: '2025/11/shoplook03-scaled.jpg',
  materials: '2025/11/sofa-premium-quality-materials-cover-images.jpg',
} as const;

export type SiteImageKey = keyof typeof FILES;

const items = manifest.items as unknown as Record<string, ImageRef>;

export function siteImageRef(key: SiteImageKey): ImageRef | null {
  return items[FILES[key]] ?? null;
}

export function siteImage(key: SiteImageKey, alt?: string): PictureData | null {
  const ref = siteImageRef(key);
  return ref ? pictureData({ ...ref, alt: alt ?? ref.alt }) : null;
}

/** A single concrete URL (e.g. a WebGL texture) at roughly the given width. */
export function siteImageUrl(key: SiteImageKey, width: number): string | null {
  const ref = siteImageRef(key);
  return ref ? imageUrl(ref, width, 'webp') : null;
}
