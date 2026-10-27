// Deletes the local PGlite database so the next start re-migrates and re-seeds
// it from the capture. Refuses while another process holds the lock.
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { acquireLock } from '../src/lib/db/lock';

async function main() {
  if (process.env.DATABASE_URL) {
    console.error('db:reset only works on the local PGlite database (DATABASE_URL is set).');
    process.exit(1);
  }
  const dir = process.env.PGLITE_DIR || '.data/pglite';
  const release = await acquireLock(dir, 1_000);
  fs.rmSync(path.resolve(dir), { recursive: true, force: true });
  release();
  console.log(`db:reset: removed ${dir}. It will be rebuilt on the next start.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
