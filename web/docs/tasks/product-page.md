# Task: product-page

Read `web/docs/BUILD-GUIDE.md` first. Spec sources in `../Plan.md`: "Store and product pages" (Product page, SEO and migration), "SEO: ranking plan" sections 3 and 4.

## You own
`src/lib/catalogue/product.ts` (replace the stub, same exports), `src/app/(site)/product/**` (everything except `opengraph-image.tsx`, which belongs to seo-core), `src/components/product/**`, `content/care.ts`, `tests/db/product.test.ts`.

## Build
**Data.** `productBySlug(slug)` returns `ProductDetail` (see `src/lib/catalogue/types.ts`) for a *published* product only, else null; variants sorted default-first with `PictureData` images (`pictureData()` from `@/lib/images/urls`); `reviews` = count and average of approved reviews for the product. `publishedSlugs()` for `generateStaticParams`. `relatedProducts(productId, limit)` = other published products in the same category, newest first (use `toCard`). Wrap reads in `unstable_cache` with tag `products` like `src/lib/catalogue/cached.ts`.

**Page `/product/[slug]/`.** `generateStaticParams` from `publishedSlugs()`; `params` is a Promise; unknown or hidden slugs call `notFound()` immediately (real 404; no `loading.tsx`, no Suspense above the page; the proxy already turns hidden-product URLs into 301s before they reach here).
- `generateMetadata`: title `seoTitle ?? "<name> | Sofa Factory Outlet"` (use `title: { absolute }`), description `seoDescription` or a 150–160 character plain-text summary of the description, canonical `/product/<slug>/`, `robots noindex` when `noindex`, Open Graph (the `opengraph-image` file is produced by seo-core, don't reference its URL).
- JSON-LD: `<JsonLd data={productJsonLd(product)} />` and `breadcrumbJsonLd([...])` from `@/lib/seo/jsonld`. Breadcrumbs: Home › category › product.
- Gallery (`gallery.tsx`, client): large photo with swipe on touch (CSS scroll-snap), thumbnails, click to open a full-screen lightbox with zoom, next/previous, Esc to close, focus trap. Cut-out photos (`data.cutout`) use `object-contain mix-blend-multiply`, others `object-cover`. The first image is the LCP: `priority`.
- Variant picker: colour dots with names; choosing one swaps the gallery to that variant's photos. Every product has exactly one variant today; render the picker only when there are 2 or more but keep the code path working.
- Price: "Price on request" or the price (`From …` when `priceFrom`; show `compareAtMinor` struck through when higher). Never invent prices. `attributes` such as Size render as a plain "Available sizes: …, confirmed at your visit" line.
- Facts: material, shape, seats (when known). Dimensions diagram (`dimensions-diagram.tsx`, simple SVG) renders only when `dimensions` has values; none exist today so it renders nothing.
- Description: Markdown to HTML with `markdown-it` (`html: false`), styled with Tailwind typography classes. `sellingPoints` as a list.
- Care notes (`content/care.ts`): general, truthful care guidance per material (velvet, leather, corduroy, fabric) written as general advice, plus "Delivery and warranty are confirmed at your visit." Do not state delivery times, prices or warranty terms.
- Actions (`add-to-cart.tsx`, client): "Add to cart" uses `useCart().add` with the selected variant (snapshot name, colour, hex, image, price) and calls `trackEvent('add_to_cart', { productId, variantId })`; "Book a visit with this piece" adds to the cart then links to `/book-visit/`; "Ask about this sofa" calls `openChat({ productId, variantId })` from `@/lib/events`. A client component calls `trackEvent('product_view', …)` once on mount. On mobile a sticky bottom bar repeats the price and the two buttons.
- "Complete the look": `<CompleteTheLook anchors={[{ productId, variantId }]} />` from `@/components/catalogue/complete-the-look` (owned by colour-engine; renders nothing until implemented). Then a "More like this" grid of `relatedProducts` with `ProductTile`.

## Tests
`tests/db/product.test.ts` on the seeded database: published product returns detail with variants and images; hidden product (`camaleonda`) returns null; `publishedSlugs()` has 15 entries; `relatedProducts` excludes the product itself and hidden items; care notes cover every material the seed derives.

## Don't
Create `opengraph-image.tsx`; edit shared files; state delivery/warranty/price facts.
