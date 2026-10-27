import fs from 'node:fs';
import path from 'node:path';
import { decodeHTML } from 'entities';
import type { ImageRef } from '../db/schema/types';
import {
  cleanAlt,
  type DerivedColour,
  deriveColour,
  deriveMaterial,
  deriveSeats,
  deriveShape,
  deriveTags,
  generatedAlt,
  type Material,
  type Shape,
} from './derive';
import { firstBulletList, htmlToMarkdown, markdownToPlain } from './html-to-md';

// ---------------------------------------------------------------------------
// Capture files (copied from ../data into seed/capture so the app is self-contained)

export type CaptureProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  prices: { price: string; regular: string; sale: string; currency: string; minor: number };
  on_sale: boolean;
  short_description: string;
  description: string;
  categories: string[];
  tags: unknown[];
  attributes: Array<{ name: string; terms: string[] }>;
  images: Array<{ src: string; alt: string }>;
};

export type CaptureCategory = { id: number; name: string; slug: string; parent: number; count: number; image: string | null };
export type CaptureMedia = { id: number; url: string; mime: string; alt: string; w?: number; h?: number };

export type MediaManifest = { version: 1; generatedAt: string; items: Record<string, ImageRef> };

// Only read when seeding (local PGlite or `npm run db:seed`), never by a deployed function.
export const seedDir = () => path.join(/* turbopackIgnore: true */ process.cwd(), 'seed');
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(seedDir(), file), 'utf8')) as T;

export function loadCapture() {
  return {
    products: readJson<CaptureProduct[]>('capture/products.json'),
    categories: readJson<CaptureCategory[]>('capture/categories.json'),
    media: readJson<CaptureMedia[]>('capture/media.json'),
  };
}

export function loadManifest(): MediaManifest | null {
  const file = path.join(seedDir(), 'media-manifest.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as MediaManifest;
}

const UPLOADS = '/wp-content/uploads/';
export const relPath = (url: string) => (url.includes(UPLOADS) ? url.split(UPLOADS)[1] : url);

/** Images under these names came from other brands' catalogues (see README). */
export const BORROWED_IMAGE = /bebitalia|_project_|outdoor_complement/i;
/** Supplier-style photos (UUID / SKU file names) whose licence should be checked. */
export const SUPPLIER_IMAGE = /^2025\/11\/(SKU-17_|10_f49e|15_5d45|1_5736|20241203-113830)/;

// ---------------------------------------------------------------------------
// Categories and hubs

export type CategorySeed = {
  slug: string;
  path: string;
  name: string;
  parent?: string;
  kind: 'category' | 'hub';
  hubFilter?: { shape?: string; material?: string };
  legacySlug?: string;
  image?: string;
  sortOrder: number;
};

export const CATEGORY_SEEDS: CategorySeed[] = [
  { slug: 'sofas', path: 'sofas', name: 'Sofas', kind: 'category', legacySlug: 'sofa', image: '2025/09/1.png', sortOrder: 1 },
  { slug: 'beds', path: 'beds', name: 'Beds', kind: 'category', legacySlug: 'beds', image: '2025/09/6.png', sortOrder: 2 },
  { slug: 'chairs', path: 'chairs', name: 'Chairs', kind: 'category', legacySlug: 'chair', image: '2025/09/3.png', sortOrder: 3 },
  { slug: 'tables', path: 'tables', name: 'Tables', kind: 'category', legacySlug: 'table', image: '2025/09/2.png', sortOrder: 4 },
  { slug: 'ottomans', path: 'ottomans', name: 'Ottomans', kind: 'category', legacySlug: 'ottoman', image: '2025/09/4.png', sortOrder: 5 },
  { slug: 'pillows', path: 'pillows', name: 'Pillows & cushions', kind: 'category', legacySlug: 'pillows', image: '2025/09/5.png', sortOrder: 6 },
  { slug: 'coffee', path: 'tables/coffee', name: 'Coffee tables', parent: 'tables', kind: 'category', legacySlug: 'coffee', image: '2025/09/7.png', sortOrder: 41 },
  { slug: 'l-shape', path: 'sofas/l-shape', name: 'L-shape sofas', parent: 'sofas', kind: 'hub', hubFilter: { shape: 'l-shape' }, image: '2025/11/L-Shape-Sofas.png', sortOrder: 11 },
  { slug: 'u-shape', path: 'sofas/u-shape', name: 'U-shape sofas', parent: 'sofas', kind: 'hub', hubFilter: { shape: 'u-shape' }, sortOrder: 12 },
  { slug: 'sets', path: 'sofas/sets', name: 'Sofa sets', parent: 'sofas', kind: 'hub', hubFilter: { shape: 'set' }, image: '2025/11/Sofa-Sets.png', sortOrder: 13 },
  { slug: 'recliners', path: 'sofas/recliners', name: 'Recliner sofas', parent: 'sofas', kind: 'hub', hubFilter: { shape: 'recliner' }, image: '2025/11/Recliner-Sofas.png', sortOrder: 14 },
  { slug: 'velvet', path: 'sofas/velvet', name: 'Velvet sofas', parent: 'sofas', kind: 'hub', hubFilter: { material: 'velvet' }, sortOrder: 15 },
  { slug: 'leather', path: 'sofas/leather', name: 'Leather sofas', parent: 'sofas', kind: 'hub', hubFilter: { material: 'leather' }, image: '2025/11/Fabric-Leather-Sofas.png', sortOrder: 16 },
  { slug: 'fabric', path: 'sofas/fabric', name: 'Fabric sofas', parent: 'sofas', kind: 'hub', hubFilter: { material: 'fabric' }, sortOrder: 17 },
];

const LEGACY_CATEGORY: Record<string, string> = {
  sofa: 'sofas',
  beds: 'beds',
  chair: 'chairs',
  table: 'tables',
  ottoman: 'ottomans',
  pillows: 'pillows',
  coffee: 'coffee',
};

const CATEGORY_NOUN: Record<string, string> = {
  sofas: 'sofa',
  beds: 'bed linen',
  chairs: 'chair',
  tables: 'table',
  ottomans: 'ottoman',
  pillows: 'cushion',
  coffee: 'coffee table',
};

// ---------------------------------------------------------------------------
// Products

export type ProductSeed = {
  legacyId: number;
  slug: string;
  name: string;
  seoTitle: string | null;
  categorySlug: string;
  descriptionMd: string;
  shortDescription: string | null;
  sellingPoints: string | null;
  plainDescription: string;
  material: Material | null;
  shape: Shape | null;
  seats: number | null;
  attributes: Record<string, string[]>;
  priceMinor: number | null;
  compareAtMinor: number | null;
  priceFrom: boolean;
  status: 'published' | 'hidden';
  borrowed: boolean;
  tags: string[];
  reviewNotes: string[];
  publishedAt: Date | null;
  colour: DerivedColour | null;
  images: Array<{ rel: string; alt: string; flag: ImageRef['flag'] }>;
};

const SIZE_NAMES: Record<string, string> = {
  king: 'King',
  quen: 'Queen',
  queen: 'Queen',
  single: 'Single',
  'supper king': 'Super King',
  'super king': 'Super King',
};

function normaliseAttributes(attrs: CaptureProduct['attributes']): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of attrs) {
    const name = decodeHTML(a.name).trim();
    out[name] = a.terms.map((t) => SIZE_NAMES[t.toLowerCase().trim()] ?? decodeHTML(t).trim());
  }
  return out;
}

function publishedFromPath(rel: string | undefined): Date | null {
  const m = rel?.match(/^(\d{4})\/(\d{2})\//);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)) : null;
}

const fileWords = (rel: string) => (rel.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '');

export function transformProduct(p: CaptureProduct, manifest?: MediaManifest | null): ProductSeed {
  const fullName = decodeHTML(p.name).replace(/\s+/g, ' ').trim();
  const [displayName] = fullName.split(' | ');
  const name = displayName.trim();
  const seoTitle = fullName.includes(' | ') ? fullName : null;

  const categorySlug = LEGACY_CATEGORY[p.categories[0] ?? ''] ?? 'sofas';
  const descriptionMd = htmlToMarkdown(p.description);
  const shortMd = htmlToMarkdown(p.short_description);
  const plain = markdownToPlain(descriptionMd);
  const rels = p.images.map((im) => relPath(im.src));
  const firstAlt = p.images[0]?.alt ? decodeHTML(p.images[0].alt) : '';
  const firstFile = rels[0] ? fileWords(rels[0]) : '';

  const borrowed = rels.some((r) => BORROWED_IMAGE.test(r));
  const supplier = rels.some((r) => SUPPLIER_IMAGE.test(r));
  const isSofa = categorySlug === 'sofas';

  const shape = isSofa ? deriveShape([name, firstAlt, plain.slice(0, 400), firstFile]) : null;
  const material = deriveMaterial([name, firstAlt, plain, firstFile], [name, firstAlt, firstFile]);
  const seats = isSofa ? deriveSeats([name, firstAlt, plain.slice(0, 600)]) : null;
  const dominant = rels[0] ? manifest?.items[rels[0]]?.dominant : undefined;
  const colour =
    p.id === 410
      ? { name: 'Assorted', hex: '#B9A27E', family: 'multi' as const, tone: 'mid' as const, warmth: 'warm' as const, fromPhoto: false }
      : deriveColour([name, firstAlt, firstFile], dominant);
  const tags = deriveTags([name, firstAlt, plain.slice(0, 600)]);

  const rawPrice = Number.parseInt(p.prices.price || '0', 10);
  const rawRegular = Number.parseInt(p.prices.regular || '0', 10);
  const priceMinor = rawPrice > 0 ? rawPrice : null;
  const compareAtMinor = priceMinor && rawRegular > priceMinor ? rawRegular : null;
  const attributes = normaliseAttributes(p.attributes);
  const priceFrom = Boolean(priceMinor && Object.keys(attributes).length);

  const reviewNotes: string[] = ['no-dimensions'];
  if (borrowed) reviewNotes.push('borrowed-images: photos and name look like another brand’s catalogue; replace before publishing');
  if (supplier) reviewNotes.push('supplier-photos: check the licence for these photos');
  if (!descriptionMd) reviewNotes.push('no-description');
  if (!priceMinor) reviewNotes.push('price-on-request: add a price or a “from” price');
  if (colour?.fromPhoto) reviewNotes.push('colour-from-photo: check the colour name and swatch');
  if (shape || material || seats) reviewNotes.push('derived-facets: shape/material/seats were read from the text');
  if (Object.keys(attributes).length) reviewNotes.push('size-options: sizes are listed as attributes, not variants');
  if (p.id === 685) {
    reviewNotes.push(
      'photo-mismatch: the photo shows a royal-blue velvet set with two wing chairs, but the title, alt text and description are copied from product 682',
    );
  }

  const noun = CATEGORY_NOUN[categorySlug] ?? 'furniture';
  const seenKeys = new Set<string>();
  const images: ProductSeed['images'] = [];
  p.images.forEach((im, index) => {
    const rel = rels[index];
    const key = manifest?.items[rel]?.key ?? rel;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const alt =
      cleanAlt(im.alt ? decodeHTML(im.alt) : '') ??
      generatedAlt({ colourName: colour?.name, material, shape, categoryNoun: noun, name });
    images.push({
      rel,
      alt: index === 0 ? alt : `${alt}, view ${images.length + 1}`,
      flag: BORROWED_IMAGE.test(rel) ? 'borrowed' : SUPPLIER_IMAGE.test(rel) ? 'licence' : null,
    });
  });

  return {
    legacyId: p.id,
    slug: p.slug,
    name,
    seoTitle,
    categorySlug,
    descriptionMd,
    shortDescription: shortMd || null,
    sellingPoints: firstBulletList(descriptionMd),
    plainDescription: plain,
    material,
    shape,
    seats,
    attributes,
    priceMinor,
    compareAtMinor,
    priceFrom,
    status: borrowed ? 'hidden' : 'published',
    borrowed,
    tags,
    reviewNotes,
    publishedAt: publishedFromPath(rels[0]),
    colour,
    images,
  };
}

export const categoryNoun = (slug: string) => CATEGORY_NOUN[slug] ?? 'furniture';
