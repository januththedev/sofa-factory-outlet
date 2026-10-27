// Seeds the database from the site capture (seed/capture) and the media
// manifest. Neon: run after db:migrate. PGlite: the app does this on first
// start; running it here needs the dev server stopped (the data folder is locked).
import './_env';
import { closeDb, dbMode, getDb } from '../src/lib/db';
import { ensureSeeded } from '../src/lib/seed';

async function main() {
  const db = await getDb();
  await ensureSeeded(db, (m) => console.log(m));
  console.log(`db:seed: done (${dbMode()})`);
  await closeDb();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
