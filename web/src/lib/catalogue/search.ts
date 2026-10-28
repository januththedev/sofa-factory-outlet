import { asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { FAMILY_LABELS } from '@/lib/colour/dictionary';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { FacetCount } from './types';
import { toCard, type ProductCard } from './queries';

export type ShopSort = 'featured' | 'newest' | 'price-asc' | 'price-desc';

/** Filters for /shop/ and category hubs; they live in the URL (`/shop/?colour=green&shape=l-shape`). */
export type ShopParams = {
  q?: string;
  /** category path, e.g. 'sofas' */
  category?: string;
  /** promoted hub path, e.g. 'sofas/l-shape' (applies the hub's saved filter) */
  hub?: string;
  colour?: string[];
  material?: string[];
  shape?: string[];
  seats?: number[];
  /** whole rupees */
  minPrice?: number;
  maxPrice?: number;
  sort?: ShopSort;
  page?: number;
  pageSize?: number;
};

export type ShopResult = {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  /** Counts reflect the other active filters, so options never lead to an empty result. */
  facets: { colour: FacetCount[]; material: FacetCount[]; shape: FacetCount[]; seats: FacetCount[]; price: { min: number | null; max: number | null } };
};

const sortSchema = z.enum(['featured', 'newest', 'price-asc', 'price-desc']);
const allowed = {
  material: new Set(['fabric', 'leather', 'velvet', 'corduroy']),
  shape: new Set(['l-shape', 'u-shape', 'set', 'single', 'recliner']),
};
const clean = (value: string) => value.trim().toLowerCase();
const strings = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? [value] : [])
  .flatMap((part) => part.split(',')).map(clean).filter(Boolean);
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const integer = (value: string | undefined, min: number, max: number) => {
  const parsed = z.coerce.number().int().safeParse(value);
  return parsed.success ? Math.min(max, Math.max(min, parsed.data)) : undefined;
};

export const parseShopParams = (input: Record<string, string | string[] | undefined>): ShopParams => {
  const result: ShopParams = {};
  const q = first(input.q)?.trim();
  if (q) result.q = q.slice(0, 100);
  for (const key of ['category', 'hub'] as const) {
    const value = first(input[key]);
    if (value && /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(value)) result[key] = value;
  }
  for (const key of ['colour', 'material', 'shape'] as const) {
    const values = strings(input[key]).filter((v) => /^[a-z0-9-]+$/.test(v) && (key === 'colour' || allowed[key].has(v)));
    if (values.length) result[key] = [...new Set(values)].sort();
  }
  const seats = strings(input.seats).map(Number).filter((v) => Number.isInteger(v) && v > 0 && v <= 20);
  if (seats.length) result.seats = [...new Set(seats)].sort((a, b) => a - b);
  const minPrice = integer(first(input.minPrice), 0, 100_000_000);
  const maxPrice = integer(first(input.maxPrice), 0, 100_000_000);
  if (minPrice !== undefined) result.minPrice = minPrice;
  if (maxPrice !== undefined) result.maxPrice = maxPrice;
  const sort = sortSchema.safeParse(first(input.sort));
  if (sort.success && sort.data !== 'featured') result.sort = sort.data;
  const page = integer(first(input.page), 1, 10_000);
  const pageSize = integer(first(input.pageSize), 1, 48);
  if (page && page !== 1) result.page = page;
  if (pageSize && pageSize !== 12) result.pageSize = pageSize;
  return result;
};

export const buildShopUrl = (params: ShopParams): string => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.hub) query.set('hub', params.hub);
  for (const key of ['colour', 'material', 'shape'] as const) if (params[key]?.length) query.set(key, [...params[key]].sort().join(','));
  if (params.seats?.length) query.set('seats', [...params.seats].sort((a, b) => a - b).join(','));
  if (params.minPrice !== undefined) query.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) query.set('maxPrice', String(params.maxPrice));
  if (params.sort && params.sort !== 'featured') query.set('sort', params.sort);
  if (params.page && params.page !== 1) query.set('page', String(params.page));
  if (params.pageSize && params.pageSize !== 12) query.set('pageSize', String(params.pageSize));
  query.sort();
  return `/shop/${query.size ? `?${query.toString()}` : ''}`;
};

type Row = typeof s.products.$inferSelect & { category: typeof s.categories.$inferSelect; variants: Array<typeof s.productVariants.$inferSelect> };
type Dimension = 'colour' | 'material' | 'shape' | 'seats' | 'price';

export const searchProducts = async (params: ShopParams): Promise<ShopResult> => {
  const db = await getDb();
  const categories = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder));
  const hub = params.hub ? categories.find((item) => item.path === params.hub && item.kind === 'hub') : undefined;
  const categoryPath = params.category ?? hub?.path.split('/')[0];
  let rankedIds: number[] | null = null;
  if (params.q?.trim()) {
    const query = params.q.trim();
    const synonymRows = await db.select().from(s.synonyms);
    const words = new Set(query.toLowerCase().split(/\s+/));
    const expanded = new Set([query]);
    for (const entry of synonymRows) if (words.has(entry.term.toLowerCase()) || entry.variants.some((v) => words.has(v.toLowerCase()))) {
      expanded.add(entry.term); entry.variants.forEach((v) => expanded.add(v));
    }
    const search = [...expanded].join(' OR ');
    const found = await db.execute(sql`select ${s.products.id} as id from ${s.products}
      where ${s.products.status} = 'published' and (${s.products.searchVector} @@ websearch_to_tsquery('english', ${search})
      or word_similarity(${query}, ${s.products.name}) > 0.4)
      order by ts_rank(${s.products.searchVector}, websearch_to_tsquery('english', ${search})) desc, word_similarity(${query}, ${s.products.name}) desc`);
    // The driver's result type is opaque; every driver exposes `.rows`.
    rankedIds = (found as unknown as { rows: Array<{ id: number }> }).rows.map((row) => row.id);
  }
  const rows = await db.query.products.findMany({
    where: rankedIds ? inArray(s.products.id, rankedIds.length ? rankedIds : [-1]) : eq(s.products.status, 'published'),
    with: { category: true, variants: true },
  }) as Row[];
  const rank = new Map((rankedIds ?? []).map((id, index) => [id, index]));
  const matches = (row: Row, omit?: Dimension) => {
    if (row.status !== 'published') return false;
    if (categoryPath && !(row.category.path === categoryPath || row.category.path.startsWith(`${categoryPath}/`))) return false;
    const shapes = [...(omit === 'shape' ? [] : (params.shape ?? [])), ...(hub?.hubFilter?.shape ? [hub.hubFilter.shape] : [])];
    const materials = [...(omit === 'material' ? [] : (params.material ?? [])), ...(hub?.hubFilter?.material ? [hub.hubFilter.material] : [])];
    if (omit !== 'colour' && params.colour?.length && !row.variants.some((v) => params.colour?.includes(v.family))) return false;
    if (materials.length && (!row.material || !materials.includes(row.material))) return false;
    if (shapes.length && (!row.shape || !shapes.includes(row.shape))) return false;
    if (omit !== 'seats' && params.seats?.length && (!row.seats || !params.seats.includes(row.seats))) return false;
    if (omit !== 'price' && (params.minPrice !== undefined || params.maxPrice !== undefined)) {
      if (row.priceMinor === null) return false;
      const rupees = row.priceMinor / 100;
      if ((params.minPrice !== undefined && rupees < params.minPrice) || (params.maxPrice !== undefined && rupees > params.maxPrice)) return false;
    }
    return true;
  };
  const count = (dimension: Exclude<Dimension, 'price'>, values: Array<string | number>) => values.map((value) => ({
    value: String(value), label: dimension === 'colour' ? (FAMILY_LABELS[value as keyof typeof FAMILY_LABELS] ?? String(value)) : String(value).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    count: rows.filter((row) => {
      if (!matches(row, dimension)) return false;
      if (dimension === 'colour') return row.variants.some((v) => v.family === value);
      if (dimension === 'material') return row.material === value;
      if (dimension === 'shape') return row.shape === value;
      return row.seats === value;
    }).length,
  })).filter((item) => item.count > 0);
  const colours = [...new Set(rows.flatMap((row) => row.variants.map((v) => v.family)))].sort();
  const colourFacets = count('colour', colours).map((item) => {
    const hexCounts = new Map<string, number>();
    rows.filter((row) => matches(row, 'colour')).flatMap((row) => row.variants).filter((v) => v.family === item.value)
      .forEach((v) => hexCounts.set(v.hex, (hexCounts.get(v.hex) ?? 0) + 1));
    const hex = [...hexCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { ...item, ...(hex ? { hex } : {}) };
  });
  const prices = rows.filter((row) => matches(row, 'price') && row.priceMinor !== null).map((row) => Math.floor((row.priceMinor ?? 0) / 100));
  const filtered = rows.filter((row) => matches(row));
  const sort = params.sort ?? 'featured';
  filtered.sort((a, b) => {
    if (rankedIds) return (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity);
    if (sort === 'price-asc' || sort === 'price-desc') {
      if (a.priceMinor === null) return 1; if (b.priceMinor === null) return -1;
      return sort === 'price-asc' ? a.priceMinor - b.priceMinor : b.priceMinor - a.priceMinor;
    }
    if (sort === 'featured' && a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
    return (b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime() || a.name.localeCompare(b.name);
  });
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 12));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, params.page ?? 1));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toCard), total: filtered.length, page, pageSize, pages,
    facets: { colour: colourFacets,
      material: count('material', [...new Set(rows.map((r) => r.material).filter((v): v is string => Boolean(v)))].sort()),
      shape: count('shape', [...new Set(rows.map((r) => r.shape).filter((v): v is string => Boolean(v)))].sort()),
      seats: count('seats', [...new Set(rows.map((r) => r.seats).filter((v): v is number => v !== null))].sort((a, b) => a - b)),
      price: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null } } };
};
