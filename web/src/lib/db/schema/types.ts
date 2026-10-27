import { customType } from 'drizzle-orm/pg-core';

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** One processed photo: files live at `${mediaBase}/${key}/${width}.${avif|webp}`. */
export type ImageRef = {
  key: string;
  w: number;
  h: number;
  widths: number[];
  alt: string;
  blur?: string;
  dominant?: string;
  /** borrowed = looks like another brand's catalogue photo; licence = supplier photo to check */
  flag?: 'borrowed' | 'licence' | null;
  source?: string;
};

export type Dimensions = {
  widthCm?: number;
  depthCm?: number;
  heightCm?: number;
  seatHeightCm?: number;
  seatDepthCm?: number;
  note?: string;
};

export type ProductStatus = 'draft' | 'published' | 'hidden';
export type BookingStatus = 'new' | 'contacted' | 'visited' | 'purchased' | 'lost' | 'cancelled';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled';
export type AdminRole = 'owner' | 'staff';
