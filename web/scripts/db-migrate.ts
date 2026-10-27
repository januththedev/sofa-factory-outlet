// Applies migrations to Neon. Locally (no DATABASE_URL) the app migrates its
// embedded database itself on first use, so there is nothing to do here.
import './_env';
import { closeDb, getDb } from '../src/lib/db';
import { runMigrations } from '../src/lib/db/migrate';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('db:migrate: no DATABASE_URL — the local PGlite database migrates itself when the app starts.');
    return;
  }
  if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
  const db = await getDb();
  await runMigrations(db, 'neon');
  console.log('db:migrate: done');
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
