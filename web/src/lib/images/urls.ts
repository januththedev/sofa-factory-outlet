import type { ImageRef } from '../db/schema/types';
import { mediaBase } from '../storage';

export type PictureData = {
  avifSrcSet: string;
  webpSrcSet: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  blur?: string;
  dominant?: string;
  /** White-background product cut-out: render with object-contain + mix-blend-multiply. */
  cutout: boolean;
};

export function imageUrl(ref: Pick<ImageRef, 'key' | 'widths'>, width: number, format: 'avif' | 'webp' = 'webp'): string {
  const available = ref.widths.length ? ref.widths : [width];
  const chosen = available.find((w) => w >= width) ?? available[available.length - 1];
  return `${mediaBase()}/${ref.key}/${chosen}.${format}`;
}

const srcSet = (ref: ImageRef, format: 'avif' | 'webp') =>
  ref.widths.map((w) => `${mediaBase()}/${ref.key}/${w}.${format} ${w}w`).join(', ');

/** Serialisable picture data, built on the server and safe to pass to client components. */
export function pictureData(ref: ImageRef, fallbackWidth = 960): PictureData {
  return {
    avifSrcSet: srcSet(ref, 'avif'),
    webpSrcSet: srcSet(ref, 'webp'),
    src: imageUrl(ref, fallbackWidth, 'webp'),
    width: ref.w,
    height: ref.h,
    alt: ref.alt,
    blur: ref.blur,
    dominant: ref.dominant,
    cutout: ref.cutout ?? false,
  };
}
