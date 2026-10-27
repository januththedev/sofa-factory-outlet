# Task: seo-core (structured data, sitemaps, robots, proxy, redirects, OG images, URL test)

Read `web/docs/BUILD-GUIDE.md` first. Spec sources in `../Plan.md`: "SEO and migration", "SEO: ranking plan" sections 3, 4, 8, 9; the redirect table.

## You own
`src/lib/seo/{metadata.ts,jsonld.tsx,sitemaps.ts,redirects.ts,indexnow.ts}`, `src/app/sitemap.xml/route.ts` (sitemap index), `src/app/sitemaps/[name]/route.ts`, `src/app/robots.ts`, `src/app/llms.txt/route.ts`, `src/proxy.ts`, `src/app/api/internal/redirects/route.ts`, `src/app/opengraph-image.tsx`, `src/app/(site)/product/[slug]/opengraph-image.tsx`, `scripts/test-urls.ts`, `tests/unit/{jsonld,sitemaps,redirects}.test.ts`. (`src/lib/seo/legacy-redirects.ts` already exists and is used by `next.config.ts`; read it, don't edit.)

## Build
**JSON-LD (`jsonld.tsx`, keep the contract signatures).** `organizationJsonLd()` returns Organization + WebSite (logo `/brand/logo.png`, `sameAs` from `settings.business.social`, only non-null). `furnitureStoreJsonLd()`: `FurnitureStore` with name, url, logo; include address, telephone, opening hours and price range **only when the matching settings value has `confirmed: true`** (today all are unconfirmed, so emit just name/url/logo/sameAs). `productJsonLd(product)`: `Product` with images (absolute URLs from `siteUrl()` + `imageUrl()`), brand, color, material, `Offer` in LKR (`price` = `priceMinor/100`, `availability` InStock) **only when a price exists**, `aggregateRating` **only when approved reviews exist**. `breadcrumbJsonLd`, `articleJsonLd` per schema.org. Every URL is absolute and ends with `/` for pages.

**Metadata helpers (`metadata.ts`).** `pageMetadata({ title, description, path, noindex?, image? })` returning Next `Metadata` with canonical (`siteUrl()` + path), Open Graph and Twitter fields. Other agents import it.

**Sitemaps.** `/sitemap.xml` is a sitemap index listing `/sitemaps/pages.xml`, `products.xml`, `categories.xml`, `guides.xml`, `images.xml`. `/sitemaps/[name]/` generates each from the database (published products, categories/hubs with at least one published product, static pages `/`, `/shop/`, `/about-us/`, `/factory/`, `/visit/`, `/trade/`, `/book-visit/`, guides from `content/guides/*.md` front matter `slug`/`dateModified`, image entries for product photos). Put the XML building in pure functions in `sitemaps.ts` and unit-test them. Cache with `unstable_cache` tagged `products`/`guides`.

**robots + llms.** `robots.ts`: allow all; disallow `/admin/`, `/api/`, `/cart/`, `/book-visit/done/`; `Sitemap:` line; when `settings.seo.aiCrawlers === 'block'` add Disallow rules for GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot. `llms.txt`: plain-text summary of the business and key URLs, no invented facts.

**Redirects (`redirects.ts`, route, proxy).**
- `src/proxy.ts` exports `proxy(request)` and a `config.matcher` that skips `_next`, `blob`, `brand`, files with extensions and `/api/internal`. Order: (1) `adminGate(request)` from `@/lib/auth/gate` (return its response when present); (2) `/?p=265` and `/?p=267` (old Woodmart compare/wishlist links) → 301 to `/` with the query removed; (3) database-driven redirects: fetch `GET /api/internal/redirects/` (header `Authorization: Bearer ${CRON_SECRET}`) and keep the map in module memory for 30 seconds (also refetch on miss at most once per 30 s); a hit with status 301 redirects; status 410 returns a small HTML "This page has been removed" response with status 410. The proxy must **not import the database** (ESLint enforces it) and must fail open (a fetch error continues normally).
- `GET /api/internal/redirects/` (route handler, `force-dynamic`): requires the bearer token (401 otherwise), returns `{ redirects: [{ from, to, status }] }` from the `redirects` table.
- Hidden products already have 301 rows seeded to their category hub; slug changes and deletions create more later (admin-products writes them).

**OG images.** `next/og` `ImageResponse`: default site card (bone background, maroon accent, wordmark text) and a product card (product name, category, "Sofa Factory Outlet"; no photo needed). Fonts: use the default font; don't download any. `params` is a Promise.

**`scripts/test-urls.ts`** (run with tsx; no database): builds the URL list from `seed/capture/products.json` (35 `/product/<slug>/`), the 7 old category URLs, `/`, `/shop/`, `/about-us/`, `/cart/`, `/checkout/`, `/my-account/`, `/?p=265`, `/?p=267`; against `BASE_URL` (default `http://localhost:3000`) each must return 200, or one 301 to a URL that returns 200. Print a table and exit non-zero on any failure. Hidden products (those matching the borrowed-image rule) must 301 to their category hub, published ones must be 200 with no redirect.

## Tests
Unit tests for the JSON-LD builders (confirmed vs unconfirmed fields, price on request, ratings), sitemap XML builders (escaping, lastmod format, index), redirect map building and the 30-second cache logic, `pageMetadata`.

## Don't
Import the database in the proxy; hard-code the domain (use `siteUrl()`); emit unconfirmed business details in structured data.
