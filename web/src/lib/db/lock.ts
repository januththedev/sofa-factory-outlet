import fs from 'node:fs';
import path from 'node:path';

// PGlite is single-process: two processes opening the same data folder will
// corrupt it. A PID lock file next to the folder makes a second opener wait
// briefly, then fail with a clear message instead.

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function acquireLock(dir: string, timeoutMs = 10_000): Promise<() => void> {
  const file = `${path.resolve(dir)}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      fs.writeFileSync(file, String(process.pid), { flag: 'wx' });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const owner = Number.parseInt(fs.readFileSync(file, 'utf8').trim(), 10);
      if (!owner || owner === process.pid || !isAlive(owner)) {
        fs.rmSync(file, { force: true });
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `The local database (${dir}) is in use by process ${owner}. Stop that process (usually \`npm run dev\`) or point PGLITE_DIR somewhere else.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      if (Number.parseInt(fs.readFileSync(file, 'utf8'), 10) === process.pid) fs.rmSync(file, { force: true });
    } catch {
      // Already gone.
    }
  };
  process.once('exit', release);
  return release;
}
