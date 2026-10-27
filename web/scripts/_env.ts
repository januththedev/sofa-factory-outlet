import fs from 'node:fs';
import path from 'node:path';

/** CLI scripts are not run by Next, so load .env.local / .env the way Next would. */
export function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(process.cwd(), name);
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
}

loadEnvFiles();
