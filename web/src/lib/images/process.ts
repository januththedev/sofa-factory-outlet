import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { ImageRef } from '../db/schema/types';
import { storage } from '../storage';

/** Widths generated for every photo (never enlarged past the original). */
export const IMAGE_WIDTHS = [480, 960, 1440, 2048] as const;

export function widthsFor(originalWidth: number): number[] {
  const cap = Math.min(originalWidth, IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]);
  const widths: number[] = IMAGE_WIDTHS.filter((w) => w < cap);
  widths.push(cap);
  return [...new Set(widths)].sort((a, b) => a - b);
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export type ProcessOptions = {
  /** Folder for this image, e.g. `products/688`; a content hash is appended. */
  keyPrefix: string;
  alt: string;
  flag?: ImageRef['flag'];
  source?: string;
};

/**
 * Resizes once at upload/import time into AVIF + WebP at each width, stores
 * every file through the storage adapter and returns the reference saved in
 * the database. Pages then load these files directly, so Vercel's image
 * optimisation quota is never used.
 */
export async function processImage(input: Buffer, options: ProcessOptions): Promise<ImageRef> {
  const meta = await sharp(input, { failOn: 'none' }).rotate().metadata();
  const originalWidth = meta.autoOrient?.width ?? meta.width;
  const originalHeight = meta.autoOrient?.height ?? meta.height;
  if (!originalWidth || !originalHeight) throw new Error(`Unreadable image: ${options.source ?? options.keyPrefix}`);

  const hash = createHash('sha1').update(input).digest('hex').slice(0, 8);
  const key = `${options.keyPrefix.replace(/\/+$/, '')}/${hash}`;
  const widths = widthsFor(originalWidth);
  const driver = storage();

  for (const width of widths) {
    const resized = sharp(input, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true });
    const [avif, webp] = await Promise.all([
      resized.clone().avif({ quality: 52, effort: 4 }).toBuffer(),
      resized.clone().webp({ quality: 80 }).toBuffer(),
    ]);
    await driver.put(`${key}/${width}.avif`, avif, { contentType: 'image/avif' });
    await driver.put(`${key}/${width}.webp`, webp, { contentType: 'image/webp' });
  }

  const blurBuffer = await sharp(input, { failOn: 'none' }).rotate().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(input, { failOn: 'none' }).stats();
  const width = widths[widths.length - 1];

  return {
    key,
    w: width,
    h: Math.round((originalHeight * width) / originalWidth),
    widths,
    alt: options.alt,
    blur: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
    dominant: toHex(dominant.r, dominant.g, dominant.b),
    flag: options.flag ?? null,
    source: options.source,
  };
}
