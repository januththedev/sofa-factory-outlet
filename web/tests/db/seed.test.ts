import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, type Db, getDb } from '@/lib/db';
import { openPglite } from '@/lib/db/pglite';
import * as s from '@/lib/db/schema';

let db: Db;

beforeAll(async () => {
  db = await getDb(); // memory:// — migrates and seeds a fresh database
});

afterAll(async () => {
  await closeDb();
});

const count = async (table: PgTable, where?: ReturnType<typeof sql>) => {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(where ?? sql`true`);
  return row.n;
};

describe('migrations + capture seed', () => {
  it('creates all 28 tables', async () => {
    const rows = await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
    const n = Number((rows as unknown as { rows: Array<{ n: number }> }).rows[0].n);
    expect(n).toBe(28);
  });

  it('seeds the catalogue from the capture', async () => {
    expect(await count(s.products)).toBe(35);
    expect(await count(s.products, sql`${s.products.status} = 'published'`)).toBe(15);
    expect(await count(s.products, sql`${s.products.status} = 'hidden'`)).toBe(20);
    expect(await count(s.products, sql`${s.products.featured}`)).toBe(6);
    expect(await count(s.productVariants)).toBe(35);
    expect(await count(s.categories)).toBe(14);
    expect(await count(s.redirects, sql`${s.redirects.reason} = 'hidden-product'`)).toBe(20);
    expect(await count(s.bookingSlots)).toBe(24);
    expect(await count(s.adminUsers)).toBe(1);
  });

  it('is idempotent', async () => {
    const { seedAll } = await import('@/lib/seed');
    await seedAll(db);
    expect(await count(s.products)).toBe(35);
    expect(await count(s.redirects)).toBe(20);
  });

  it('points hidden products at their category hub', async () => {
    const rows = await db.select().from(s.redirects).where(sql`${s.redirects.fromPath} = '/product/camaleonda/'`);
    expect(rows[0]).toMatchObject({ toPath: '/sofas/', status: 301 });
  });

  it('runs English full-text search over the generated vector', async () => {
    const rows = await db
      .select({ name: s.products.name })
      .from(s.products)
      .where(sql`${s.products.searchVector} @@ websearch_to_tsquery('english', 'leather sofa set')`);
    expect(rows.map((r) => r.name)).toContain('Maroon Leather Sofa Set 3+2+1');
  });

  it('matches misspelt names with trigrams', async () => {
    const rows = await db
      .select({ name: s.products.name, score: sql<number>`similarity(${s.products.name}, 'chesterfeild sofa')` })
      .from(s.products)
      .orderBy(sql`similarity(${s.products.name}, 'chesterfeild sofa') desc`)
      .limit(1);
    expect(rows[0].name).toMatch(/Chesterfield/);
  });
});

describe('pgvector in PGlite (month-3 embeddings)', () => {
  it('creates a vector column with an HNSW index and orders by cosine distance', async () => {
    const { client, close } = await openPglite('memory://', { vector: true });
    await client.exec(`
      create extension if not exists vector;
      create table t (id int, e vector(3));
      insert into t values (1, '[1,0,0]'), (2, '[0,1,0]'), (3, '[0.9,0.1,0]');
      create index on t using hnsw (e vector_cosine_ops);
    `);
    const res = await client.query<{ id: number }>(`select id from t order by e <=> '[1,0,0]' limit 2`);
    expect(res.rows.map((r) => r.id)).toEqual([1, 3]);
    await close();
  });
});
