import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The proxy runs in its own bundle; it must never open the database
    // (a second PGlite instance on the same folder would corrupt it).
    files: ['src/proxy.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@/lib/db', '@/lib/db/*', '@/lib/seed/*'] }],
    },
  },
  globalIgnores([
    '.next/**',
    '.next-e2e/**',
    'out/**',
    'build/**',
    '.data/**',
    'next-env.d.ts',
    'test-results/**',
    'playwright-report/**',
    'drizzle/**',
  ]),
]);

export default eslintConfig;
