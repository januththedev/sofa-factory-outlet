import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('accepts the assigned preview URL, still requires secrets and keeps production URL explicit', () => {
  const base = { ...process.env, VERCEL:'1', DATABASE_URL:'test', DATABASE_URL_UNPOOLED:'test', BLOB_READ_WRITE_TOKEN:'test', CRON_SECRET:'test', AUTH_SECRET:'x'.repeat(40), NEXT_PUBLIC_SITE_URL:'', VERCEL_ENV:'preview', VERCEL_URL:'feature.example.vercel.app' };
  const run = (env: NodeJS.ProcessEnv) => spawnSync(process.execPath, ['scripts/check-production-env.mjs'], { env, encoding:'utf8' });
  expect(run(base).status).toBe(0);
  const missing = run({...base, AUTH_SECRET:''});
  expect(missing.status).toBe(1); expect(missing.stderr).toContain('AUTH_SECRET');
  expect(run({...base, VERCEL_ENV:'production'}).status).toBe(1);
  expect(run({...base, VERCEL_ENV:'production', NEXT_PUBLIC_SITE_URL:'https://example.com'}).status).toBe(0);
});
