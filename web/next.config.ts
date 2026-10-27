import type { NextConfig } from 'next';
import { legacyRedirects } from './src/lib/seo/legacy-redirects';

// Without DATABASE_URL the app uses PGlite, which only one process may open.
// `next build` defaults to several worker processes, so pin it to one.
const usingPglite = !process.env.DATABASE_URL;

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  // Lets the e2e server build into its own folder while `next dev` keeps running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector'],
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  experimental: {
    ...(usingPglite ? { cpus: 1 } : {}),
    serverActions: { bodySizeLimit: '12mb' },
  },
  async redirects() {
    return legacyRedirects;
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
