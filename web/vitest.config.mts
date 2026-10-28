import path from 'node:path';
import { defineConfig } from 'vitest/config';

const root = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      '@/': `${path.join(root, 'src')}/`,
      '@content/': `${path.join(root, 'content')}/`,
      '@seed/': `${path.join(root, 'seed')}/`,
      // `server-only` throws outside React Server Components; tests run plain Node.
      'server-only': path.join(root, 'tests', 'stubs', 'server-only.ts'),
      // unstable_cache needs a Next request context; tests get a pass-through.
      'next/cache': path.join(root, 'tests', 'stubs', 'next-cache.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts'],
    // Each test file gets its own process and its own in-memory database.
    pool: 'forks',
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: { PGLITE_DIR: 'memory://', NODE_ENV: 'test', OWNER_EMAIL: 'owner@test.local', OWNER_PASSWORD: 'test-password-123' },
  },
});
