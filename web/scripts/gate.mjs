// Runs a heavy command (tsc, vitest, eslint) through a machine-wide 2-slot queue.
// The build machine has 8 logical CPUs and 7.7 GB of RAM, and many agents share
// it, so heavy checks wait their turn instead of running all at once.
//
//   node scripts/gate.mjs <label> -- <command> [args...]
//   npm run gate:tsc | gate:lint -- <paths> | gate:test -- <test files>
//
// Slots are lock files in GATE_DIR; a lock whose process died (or is 20+ minutes
// old) is reclaimed automatically.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GATE_DIR = process.env.GATE_DIR || 'D:/Sofa_Factory/.gate';
const SLOTS = Number(process.env.GATE_SLOTS || 2);
const separator = process.argv.indexOf('--');
if (separator < 0 || separator === process.argv.length - 1) {
  console.error('usage: node scripts/gate.mjs <label> -- <command> [args...]');
  process.exit(2);
}
const label = process.argv[2] === '--' ? 'job' : process.argv[2];
const command = process.argv.slice(separator + 1);
fs.mkdirSync(GATE_DIR, { recursive: true });

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tryAcquire() {
  for (let slot = 0; slot < SLOTS; slot += 1) {
    const file = path.join(GATE_DIR, `slot-${slot}.lock`);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        fs.writeFileSync(file, JSON.stringify({ pid: process.pid, label, since: Date.now() }), { flag: 'wx' });
        return file;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (alive(owner.pid) && Date.now() - owner.since < 20 * 60_000) break;
        } catch {
          // unreadable lock: treat as stale
        }
        fs.rmSync(file, { force: true });
      }
    }
  }
  return null;
}

let lock = null;
const waitStart = Date.now();
let announced = 0;
while (!(lock = tryAcquire())) {
  if (Date.now() - waitStart > announced * 20_000 + 20_000) {
    announced += 1;
    console.error(`[gate] ${label}: waiting for a free slot (${Math.round((Date.now() - waitStart) / 1000)}s)…`);
  }
  await sleep(1000 + Math.random() * 600);
}

const release = () => {
  try {
    fs.rmSync(lock, { force: true });
  } catch {
    // already gone
  }
};
process.on('exit', release);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const child = spawn(command.join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=1536`.trim() },
});
child.on('exit', (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
