import type { NextConfig } from 'next';
import { legacyRedirects } from './src/lib/seo/legacy-redirects';
import { buildContentSecurityPolicy } from './src/lib/security/csp';

// Without DATABASE_URL the app uses PGlite, which only one process may open.
// `next build` defaults to several worker processes, so pin it to one.
const usingPglite = !process.env.DATABASE_URL;

const servedOverHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');

// `next dev` needs eval for React's debugging tools and hot reload, so only built sites get the policy.
const contentSecurityPolicy = process.env.NODE_ENV === 'production'
  ? [{
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy({ upgradeInsecure: servedOverHttps }),
  }]
  : [];

// Two years, the usual value. Not includeSubDomains: other subdomains of the client's domain are not ours.
const strictTransportSecurity = servedOverHttps
  ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]
  : [];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...contentSecurityPolicy,
  ...strictTransportSecurity,
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  // Lets the e2e server build into its own folder while `next dev` keeps running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector'],
  // The guide loader accepts a test directory; do not trace the whole project for that dynamic path.
  outputFileTracingIncludes: { '/*': ['./content/guides/**/*.md'] },
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
