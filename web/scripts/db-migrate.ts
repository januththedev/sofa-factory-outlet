// Applies migrations to Neon. Locally (no DATABASE_URL) the app migrates its
// embedded database itself on first use, so there is nothing to do here.
import './_env';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { Db } from '../src/lib/db';
import { runMigrations } from '../src/lib/db/migrate';
import * as schema from '../src/lib/db/schema';
import { env } from '../src/lib/env';

async function main() {
  if (!env.DATABASE_URL) {
    console.log('db:migrate: no DATABASE_URL — the local PGlite database migrates itself when the app starts.');
    return;
  }
  if (typeof WebSocket === 'undefined') {
    const { default: ws } = await import('ws');
    neonConfig.webSocketConstructor = ws;
  }
  // env is parsed at import time: changing process.env later would leave getDb() on the pooled URL.
  const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL, max: 1 });
  try {
    const db = drizzle({ client: pool, schema }) as unknown as Db;
    await runMigrations(db, 'neon');
    console.log('db:migrate: done');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') : 'Database migration failed');
  process.exit(1);
});
