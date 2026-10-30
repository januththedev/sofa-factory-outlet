import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('accepts the assigned preview URL, still requires secrets and keeps production URL explicit', () => {
  const base = { ...process.env, VERCEL:'1', DATABASE_URL:'test', DATABASE_URL_UNPOOLED:'test', BLOB_READ_WRITE_TOKEN:'test', CRON_SECRET:'c'.repeat(32), BLOB_ACCESS:'private', AUTH_SECRET:'x'.repeat(40), NEXT_PUBLIC_SITE_URL:'', VERCEL_ENV:'preview', VERCEL_URL:'feature.example.vercel.app' };
  const run = (env: NodeJS.ProcessEnv) => spawnSync(process.execPath, ['scripts/check-production-env.mjs'], { env, encoding:'utf8' });
  expect(run(base).status).toBe(0);
  const missing = run({...base, AUTH_SECRET:''});
  expect(missing.status).toBe(1); expect(missing.stderr).toContain('AUTH_SECRET');
  expect(run({...base, VERCEL_ENV:'production'}).status).toBe(1);
  expect(run({...base, VERCEL_ENV:'production', NEXT_PUBLIC_SITE_URL:'https://example.com'}).status).toBe(0);
});

it('rejects example secrets, a short cron secret and a public Blob store', () => {
  const ok = { ...process.env, VERCEL: '1', DATABASE_URL: 'test', DATABASE_URL_UNPOOLED: 'test', BLOB_READ_WRITE_TOKEN: 'test', BLOB_ACCESS: 'private', CRON_SECRET: 'c'.repeat(32), AUTH_SECRET: 'x'.repeat(40), NEXT_PUBLIC_SITE_URL: 'https://example.com', OWNER_PASSWORD: '' };
  const run = (env: NodeJS.ProcessEnv) => spawnSync(process.execPath, ['scripts/check-production-env.mjs'], { env, encoding: 'utf8' });
  expect(run(ok).status).toBe(0);
  expect(run({ ...ok, AUTH_SECRET: 'replace-with-a-long-random-string-xxxxxxxx' }).stderr).toContain('AUTH_SECRET');
  expect(run({ ...ok, CRON_SECRET: 'replace-with-a-random-string' }).stderr).toContain('CRON_SECRET');
  expect(run({ ...ok, BLOB_ACCESS: '' }).stderr).toContain('BLOB_ACCESS');
  expect(run({ ...ok, OWNER_PASSWORD: 'replace-before-first-run' }).stderr).toContain('OWNER_PASSWORD');
});
