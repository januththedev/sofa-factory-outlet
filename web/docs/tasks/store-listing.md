# Task: store-listing (shop, category hubs, search)

Read `web/docs/BUILD-GUIDE.md` first. Spec sources in `../Plan.md`: "Store and product pages" (Store part), "SEO: ranking plan" sections 1 and 2 (keyword map, site structure, filters, pagination, noindex rules).

## You own
`src/lib/catalogue/search.ts` (replace the stub, same exports), `src/app/(site)/shop/**`, `src/app/(site)/[category]/**` (including `[category]/[hub]/`), `src/components/catalogue/filters/**`, `src/components/catalogue/{shop-grid,pagination,sort-menu,hub-intro}.tsx`, `content/hubs.ts`, `tests/db/search.test.ts`, `tests/unit/shop-params.test.ts`.

Shared and already real (use, don't edit): `src/components/catalogue/breadcrumbs.tsx` (`Breadcrumbs`, shared with the product page), `pageMetadata` in `src/lib/seo/metadata.ts`.

## Build
**`searchProducts(params)`** (published products only; hidden/draft never appear). Drizzle over `products` + `product_variants` + `categories`.
- `q`: `websearch_to_tsquery('english', …)` on `search_vector` OR trigram `similarity(name, q) > 0.25`; expand the query with the `synonyms` table (`term` → `variants`) before searching; rank by `ts_rank` then similarity.
- `category` is a category `path` (`sofas`, `tables/coffee`); a parent category includes its children. `hub` is a hub path (`sofas/l-shape`): apply that category row's `hub_filter` (`{shape}` or `{material}`) on top of its parent category.
- `colour` = variant `family` values; `material`, `shape`, `seats` match product columns; price range in whole rupees against `price_minor/100` (unpriced products are excluded only when a price filter is set).
- `sort`: `featured` (featured first, then newest), `newest`, `price-asc`/`price-desc` (unpriced last). Pagination: default page size 12; `pages` computed.
- `facets`: for each facet, counts computed with every *other* active filter applied (so options never lead to an empty result); colour facets carry the swatch `hex` of the most common variant of that family; labels from `FAMILY_LABELS` (`@/lib/colour/dictionary`). `price` = min/max whole-rupee prices among matches, or nulls.
- `parseShopParams`: from Next `searchParams`; comma-separated or repeated values; validate with Zod; drop unknown/invalid values silently; clamp page and pageSize. `buildShopUrl`: canonical `/shop/?…` with sorted, stable params, omitting defaults.
- Map the DB rows to `ProductCard` using `toCard` from `@/lib/catalogue/queries` (reuse it).

**Pages.**
- `/shop/`: H1, search box, filter bar/sidebar (category, colour swatches, material, shape, seats; the price range only when at least 2 published products have prices; today only one does, so it is hidden), sort menu, grid of `ProductTile` (`sizes` set sensibly), result count, numbered pagination with real `?page=N` links (never infinite scroll), empty state with "Ask us / Book a visit" links. Filters are a client component that updates the URL with `router.replace` (no curtain), keeps scroll position, and is keyboard accessible. Server component reads `searchParams` (a Promise).
- `/[category]/` for the category rows (`sofas`, `beds`, `chairs`, `tables`, `ottomans`, `pillows`) and `/[category]/[hub]/` for hubs and child categories (`sofas/l-shape`, `tables/coffee`, …): look the row up by `path`; unknown paths call `notFound()`. Each page: breadcrumbs (with `breadcrumbJsonLd` + `<JsonLd>` from `@/lib/seo/jsonld`), H1, a 150–300 word intro and buying tips (visible text) from `content/hubs.ts` keyed by path, the product grid, and links to the matching guides and sibling hubs. `/sofas/recliners/` and `/tables/coffee/` currently have no published products: render the intro plus a "Book a visit / ask us" panel and set `robots: { index: false, follow: true }`.
- `content/hubs.ts`: for every seeded category and hub path write `title`, `metaDescription` (about 155 chars), `intro` (150–300 words, honest, no invented facts, mention only what the captured site says: made in the Colombo workshop, factory-direct prices, custom colours and sizes, delivery across Sri Lanka), `tips` (3–5 practical buying tips), `guides` (slugs from the guide list in BUILD-GUIDE). Mark every intro as a draft for client review with a `// DRAFT for client review` comment.
- Metadata via `generateMetadata`: filtered/searched/sorted views and pages past the first with filters are `noindex, follow` with the canonical pointing at the unfiltered hub; plain hubs and `?page=N` are indexable (self canonical). Only the promoted filters (shape, material hubs) get their own indexable pages; every other combination stays noindex.
- `generateStaticParams` for hubs/categories from the database; unknown params 404 with a real status (no `loading.tsx`, no Suspense around the whole page).
- Reserved root slugs that a category must never shadow: `shop product admin api blob guides cart book-visit about-us factory visit trade privacy review`. Skip those in `generateStaticParams`.

## Tests
`tests/db/search.test.ts` on the seeded database (15 published, 20 hidden): hidden products never returned; `shape: ['l-shape']`; hub path `sofas/l-shape`; text query "leather sofa" finds the maroon leather set; misspelt "chesterfeild" still finds the Chesterfield; facet counts exclude own dimension; pagination; sort order with unpriced last. `tests/unit/shop-params.test.ts`: parsing, clamping, round trip with `buildShopUrl`.

## Don't
Edit the product page, header, footer or any shared file; invent copy that states prices, hours, delivery terms or warranty.
