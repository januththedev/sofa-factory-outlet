import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle } from 'drizzle-orm/pglite';
import type { Db } from './index';
import { acquireLock } from './lock';
import * as schema from './schema';

/**
 * Opens the embedded Postgres used when DATABASE_URL is not set.
 * `memory://` gives a throwaway in-memory database (tests).
 */
export async function openPglite(dir: string, options: { vector?: boolean } = {}) {
  const inMemory = dir.startsWith('memory://');
  let release = () => {};
  if (!inMemory) {
    fs.mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
    release = await acquireLock(dir);
  }

  const extensions: Record<string, unknown> = { pg_trgm };
  if (options.vector) {
    const { vector } = await import('@electric-sql/pglite-pgvector');
    extensions.vector = vector;
  }

  const client = await PGlite.create(inMemory ? undefined : dir, {
    extensions: extensions as NonNullable<Parameters<typeof PGlite.create>[1]>['extensions'],
  });
  const db = drizzle({ client, schema }) as unknown as Db;

  return {
    db,
    client,
    close: async () => {
      await client.close();
      release();
    },
  };
}
