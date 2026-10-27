// Friendly entry point for the queued checks (no npm needed):
//   node scripts/check.mjs tsc
//   node scripts/check.mjs lint src/lib/yourarea src/app/yourroute
//   node scripts/check.mjs test tests/unit/yours.test.ts
// Each one waits for a free slot in scripts/gate.mjs, so many agents can share the machine.
import { spawnSync } from 'node:child_process';

const [kind, ...rest] = process.argv.slice(2);
const commands = {
  tsc: ['node', 'node_modules/typescript/bin/tsc', '--noEmit'],
  lint: ['node', 'node_modules/eslint/bin/eslint.js', '--max-warnings=0'],
  test: ['node', 'node_modules/vitest/vitest.mjs', 'run', '--pool=forks', '--maxWorkers=1'],
};
if (!commands[kind]) {
  console.error('usage: node scripts/check.mjs <tsc|lint|test> [paths or test files]');
  process.exit(2);
}
const result = spawnSync(process.execPath, ['scripts/gate.mjs', kind, '--', ...commands[kind], ...rest], { stdio: 'inherit' });
process.exit(result.status ?? 1);
