// Old WordPress/WooCommerce URLs that move permanently. Product URLs keep
// their /product/<slug>/ path, so they are not listed here; redirects that
// depend on database state (hidden products, slug changes, 410s) live in the
// redirects table and are applied by src/proxy.ts.
//
// statusCode 301 (not `permanent: true`, which sends 308) to match the plan.
// The `?p=265` / `?p=267` WooCommerce compare/wishlist links are handled in
// the proxy: a redirects() rule for `/` would carry the query along and loop.

type LegacyRedirect = { source: string; destination: string; statusCode: 301 };

const categoryMoves: Array<[string, string]> = [
  ['sofa', '/sofas/'],
  ['beds', '/beds/'],
  ['chair', '/chairs/'],
  ['table', '/tables/'],
  ['ottoman', '/ottomans/'],
  ['pillows', '/pillows/'],
  ['coffee', '/tables/coffee/'],
];

export const legacyRedirects: LegacyRedirect[] = [
  ...categoryMoves.flatMap(([oldSlug, destination]) => [
    { source: `/product-category/${oldSlug}/page/:page/`, destination, statusCode: 301 as const },
    { source: `/product-category/${oldSlug}/`, destination, statusCode: 301 as const },
  ]),
  { source: '/product-category/:rest*/', destination: '/shop/', statusCode: 301 },
  { source: '/product-tag/:rest*/', destination: '/shop/', statusCode: 301 },
  { source: '/checkout/:rest*/', destination: '/book-visit/', statusCode: 301 },
  { source: '/checkout/', destination: '/book-visit/', statusCode: 301 },
  { source: '/my-account/:rest*/', destination: '/', statusCode: 301 },
  { source: '/my-account/', destination: '/', statusCode: 301 },
  { source: '/wishlist/', destination: '/', statusCode: 301 },
  { source: '/compare/', destination: '/', statusCode: 301 },
  { source: '/shop/page/:page/', destination: '/shop/', statusCode: 301 },
];
