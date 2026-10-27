// Builds and starts a production server for Playwright on its own port, with a
// fresh PGlite database and its own build folder, so it never touches the
// database or .next folder that `npm run dev` is using.
//   E2E_SKIP_BUILD=1 reuses the existing .next-e2e build (database is still reset)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const port = process.env.E2E_PORT ?? '3100';
const dataDir = path.join('.data', 'pglite-e2e');
const env = {
  ...process.env,
  PGLITE_DIR: dataDir,
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  E2E: '1',
};

fs.rmSync(dataDir, { recursive: true, force: true });
fs.rmSync(`${dataDir}.lock`, { force: true });

// Run Next's CLI with node directly (no npx/cmd shell) so the process can be
// stopped cleanly by Playwright on every platform.
const nextBin = path.join('node_modules', 'next', 'dist', 'bin', 'next');
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], { env, stdio: 'inherit' });
    const stop = () => child.kill();
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`next ${args.join(' ')} exited with ${code}`))));
  });

try {
  if (!process.env.E2E_SKIP_BUILD) await run(['build']);
  await run(['start', '-p', port]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
