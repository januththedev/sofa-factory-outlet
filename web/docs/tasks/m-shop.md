# Task: m-shop (shop, categories and product pages on phones)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/catalogue/**` (except `breadcrumbs.tsx`, owned by the chrome task), `src/components/product/**`, `src/app/(site)/shop/**`, `src/app/(site)/[category]/**`, `src/app/(site)/product/**`.

## What a real phone audit found (390 px, production build)
- On `/shop/` the whole filter list (Category, Colour with 9 swatches, Material, Shape, Seats, Price...) is printed above the products: a visitor scrolls about two screens of checkboxes before the first sofa. Filter checkboxes are about 16 px.
- Product cards are one per row, each about 600 px tall: 15 sofas take 10 screens. Names wrap to three lines.
- The sort control is a small native select; pagination links are small.
- 33 to 49 targets per page are under 40 px.
- `/shop/` has an eyebrow ("FACTORY COLLECTION") that collides with the header.

## Build
1. **Shop and category pages, phones.** A compact top bar under the header: result count, a **Filters** button with the number of active filters, and **Sort**. Tapping Filters opens a bottom sheet (a dialog with a backdrop, drag-free: just a close button, Escape and backdrop tap, focus trapped, body scroll locked) containing the filter groups as collapsible sections (Colour as large swatch chips with names, Material, Shape, Seats, Price) with 44 px rows, a sticky footer with **Show N pieces** and **Clear all**. Filters stay URL-driven exactly as now (`/shop/?colour=green&shape=l-shape`); on phones the sheet keeps its choices locally and applies them in one navigation when "Show N pieces" is pressed; on desktop the sidebar keeps instant filtering. The bar and sheet button count as a sticky bottom/top bar where needed (`data-sticky-bar` if you put a bar at the bottom).
2. **Active filters** shown as removable chips above the grid (each chip 44 px tall, "Remove filter: Green"), plus "Clear all". A polite live region announces "N pieces" after a change.
3. **Grid.** Two columns from 340 px up on phones (one column below), three at 768 px, four on desktop. Tile text: name at most two lines (clamp), price below, colour dots small but not interactive; the whole tile is one 44 px+ link. No second-photo hover swap on touch. Keep `ProductTile`'s public props.
4. **Pagination.** Numbered pages with 44 px targets (current marked `aria-current`), Previous/Next, scroll to the top of the grid when the page changes, keep filters.
5. **Empty state.** "No pieces match those filters" with Clear filters, a link to the whole shop, and a "Ask us on WhatsApp / Book a visit" suggestion (use TLink to `/book-visit/`; WhatsApp only through the existing settings helper if the page already has it, otherwise skip it).
6. **Loading.** `loading.tsx` skeletons for shop, category and product routes that reserve the final grid/gallery space.
7. **Product page, phones.** Gallery as a swipeable scroll-snap strip with dots and a visible "1 / 5" counter, tap to open the full-screen viewer (existing behaviour if present), thumbnails at least 56 px; colour swatches 44 px with the colour name beside the selected one; details (description, dimensions diagram, care) in an accordion with the first section open; "Complete the look" as a snap rail. A **sticky bottom bar** (`data-sticky-bar`) with **Add to cart** and **Ask about this sofa** appears when the main buttons scroll out of view and has safe-area padding. Price: "Price on request" gets one short line explaining that prices are confirmed at the showroom visit, with a link to book. After Add to cart the button changes to "Added to cart" with a "View cart" link for a few seconds, announced politely (the cart drawer behaviour that exists today stays).
8. **Back to results.** A product page reached from the shop shows "Back to results" that returns to the same filtered, scrolled list (use `history.back()` when the previous page is the shop, otherwise a link to the category).
9. Fix text under 12 px in your files.

## Tests
Keep `tests/e2e/shop.spec.ts`, `product.spec.ts`, `a11y.spec.ts` and `tests/unit/shop-params.test.ts` valid: grep for the accessible names they use before renaming (`Colour` group with checkboxes, `Search products`, `Product pages` navigation, `Open image 1 of`, `Add to cart`, `Ask about this sofa`, `Close cart`). If the filter markup moves into a sheet on phones, the desktop markup those tests drive must stay as it is. Add unit tests for new pure logic (for example counting active filters, building the removable-chip list).

## Don't
Touch `components/site/**`, `components/ui/**`, `globals.css`, `components/landing/**`, `lib/catalogue/**` logic (read only), other agents' files, `package.json`. Add dependencies. Add hover-only effects or any warp, skew, bend or ripple on photos.
