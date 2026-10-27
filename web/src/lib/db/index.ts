import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env } from '../env';
import * as schema from './schema';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

type State = {
  mode: 'pglite' | 'neon';
  db?: Db;
  opening?: Promise<Db>;
  close?: () => Promise<void>;
};

// One handle per process, shared across Next's separate server bundles
// (pages, route handlers, instrumentation) and across dev hot reloads.
const g = globalThis as unknown as { __sfoDb?: State };

export const dbMode = (): State['mode'] => (env.DATABASE_URL ? 'neon' : 'pglite');

export function getDb(): Promise<Db> {
  const state = (g.__sfoDb ??= { mode: dbMode() });
  if (state.db) return Promise.resolve(state.db);
  state.opening ??= open(state).catch((error) => {
    state.opening = undefined;
    throw error;
  });
  return state.opening;
}

async function open(state: State): Promise<Db> {
  if (state.mode === 'neon') {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    if (typeof WebSocket === 'undefined') {
      const { default: ws } = await import('ws');
      neonConfig.webSocketConstructor = ws;
    }
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
    const db = drizzle({ client: pool, schema }) as unknown as Db;
    state.close = () => pool.end();
    state.db = db;
    // Neon is migrated and seeded by `npm run db:migrate` / `npm run db:seed`.
    return db;
  }

  const { openPglite } = await import('./pglite');
  const { db, close } = await openPglite(env.PGLITE_DIR);
  state.close = close;
  const { runMigrations } = await import('./migrate');
  await runMigrations(db, 'pglite');
  const { ensureSeeded } = await import('../seed');
  await ensureSeeded(db);
  state.db = db;
  return db;
}

/** Close the process-wide handle (scripts and tests). */
export async function closeDb(): Promise<void> {
  const state = g.__sfoDb;
  if (!state) return;
  await state.close?.();
  g.__sfoDb = undefined;
}

export { schema };
