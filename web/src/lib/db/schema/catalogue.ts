import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { type Dimensions, type ImageRef, type ProductStatus, tsvector } from './types';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Categories and hubs. A hub (kind = 'hub') is a promoted filter of its parent,
 * e.g. path 'sofas/l-shape' with hub_filter { shape: 'l-shape' }.
 */
export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    path: text('path').notNull(),
    name: text('name').notNull(),
    parentId: integer('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
    kind: text('kind').$type<'category' | 'hub'>().notNull().default('category'),
    hubFilter: jsonb('hub_filter').$type<{ shape?: string; material?: string } | null>(),
    image: jsonb('image').$type<ImageRef | null>(),
    intro: text('intro'),
    tips: text('tips'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    legacySlug: text('legacy_slug'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('categories_path_uq').on(t.path), index('categories_parent_idx').on(t.parentId)],
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    legacyId: integer('legacy_id').unique(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    descriptionMd: text('description_md').notNull().default(''),
    shortDescription: text('short_description'),
    sellingPoints: text('selling_points'),
    material: text('material'),
    shape: text('shape'),
    seats: integer('seats'),
    dimensions: jsonb('dimensions').$type<Dimensions | null>(),
    attributes: jsonb('attributes').$type<Record<string, string[]>>().notNull().default({}),
    priceMinor: bigint('price_minor', { mode: 'number' }),
    compareAtMinor: bigint('compare_at_minor', { mode: 'number' }),
    priceFrom: boolean('price_from').notNull().default(false),
    status: text('status').$type<ProductStatus>().notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    noindex: boolean('noindex').notNull().default(false),
    reviewNotes: text('review_notes').array().notNull().default(sql`'{}'::text[]`),
    searchText: text('search_text').notNull().default(''),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(search_text, '')), 'B')`,
    ),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('products_search_idx').using('gin', t.searchVector),
    index('products_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    index('products_category_idx').on(t.categoryId),
    index('products_status_idx').on(t.status),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    colourName: text('colour_name').notNull(),
    hex: text('hex').notNull(),
    family: text('family').notNull(),
    tone: text('tone').$type<'light' | 'mid' | 'dark'>().notNull(),
    warmth: text('warmth').$type<'warm' | 'cool' | 'neutral'>().notNull(),
    images: jsonb('images').$type<ImageRef[]>().notNull().default([]),
    inStock: boolean('in_stock').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('product_variants_product_idx').on(t.productId), index('product_variants_family_idx').on(t.family)],
);

export const colourPairings = pgTable(
  'colour_pairings',
  {
    id: serial('id').primaryKey(),
    family: text('family').notNull(),
    pairsWith: text('pairs_with').notNull(),
    weight: real('weight').notNull().default(1),
    reason: text('reason'),
  },
  (t) => [uniqueIndex('colour_pairings_uq').on(t.family, t.pairsWith)],
);

export const categoryComplements = pgTable(
  'category_complements',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    complementId: integer('complement_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    weight: real('weight').notNull().default(1),
  },
  (t) => [uniqueIndex('category_complements_uq').on(t.categoryId, t.complementId)],
);
