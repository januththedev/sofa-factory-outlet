# Task: cart-ui (drawer, cart page, suggestions)

Read `web/docs/BUILD-GUIDE.md` first. Spec source in `../Plan.md`: "Cart and Book a Visit" → "Cart" and "Colour-matched suggestions" (items 5 and 6).

## You own
`src/components/cart/**` (`cart-button.tsx` exists: restyle but keep the `CartButton` export), `src/app/(site)/cart/**`, `src/lib/cart/**` (you may improve `store.ts` and `types.ts` but keep every existing export and behaviour), `tests/unit/cart-store.test.ts`.

## Build
- **`CartDrawer`** (`src/components/cart/cart-drawer.tsx`, client, default mount point is the site layout which the integrator wires: export `CartDrawer`): slides in from the right when `useCart().drawerOpen`; overlay, focus trap, Esc closes, returns focus, `role="dialog"` with `aria-modal`, locks page scroll while open (use `getLenis()?.stop()/start()` from `@/components/site/smooth-scroll` plus `document.documentElement.style.overflow`). Lines: thumbnail (`Picture`; cut-out rules in BUILD-GUIDE), name linking to the product, colour dot and name, quantity stepper (1–20), remove, **change colour in place**. Footer: total via `cartTotal` + `formatLkr` only when every line has a price, otherwise the text "Prices are confirmed at your visit"; primary button "Book a visit" → `/book-visit/`; secondary "View cart" → `/cart/`. "Complete the look" row under the lines.
- **Change colour / suggestions need server data.** Put server actions in `src/app/(site)/cart/actions.ts` (`'use server'`): `getVariantsAction(productId)` returns that published product's variants (`id, colourName, hex, family, image: PictureData | null`) read through the database (`getDb`, schema `s`); `getSuggestionsAction(cartRef)` calls `suggestFor({ anchors: cartRef, limit: 4 })` from `@/lib/colour/engine` (a contract owned by another agent; it throws until implemented, so catch and return `[]`) and returns plain serialisable objects: `{ productId, variantId, slug, name, href, priceMinor, image, colourName, hex, reason }`. Validate inputs with Zod. Call `getSuggestionsAction` from client components with `useTransition`, debounced (300 ms) when the cart changes, and ignore stale responses.
- **Suggestion tiles** have an "Add" button that calls `useCart().add` for the suggested variant; cart lines show a small "goes with" reason line from the suggestion.
- **`/cart/` page** (server shell + client body): full-width editable lines (same controls as the drawer), totals, suggestions, empty state with links to `/sofas/` and `/shop/`, an "Ask our assistant" button that calls `openChat({ cart: toCartRef(lines), nudge: true })` from `@/lib/events`, and the primary "Book a visit" button. Metadata `robots: { index: false }`. The page works with an empty cart and while the cart is still rehydrating (no hydration mismatch: read the store only in client components).
- Track `trackEvent('remove_from_cart', { productId, variantId })` when a line is removed.
- Keep the `CartButton` in the header accessible (count announced); animate the badge on change but respect reduced motion.

## Tests
`tests/unit/cart-store.test.ts` (stub `globalThis.localStorage` with an in-memory object before importing the store; call `useCart.persist.rehydrate()`): add merges quantities, quantity clamps at 20, `setQuantity(…, 0)` removes, `replace` swaps colour and merges when the target colour is already in the cart, `clear`, persistence round trip, `cartTotal` null when any line is unpriced or the cart is empty, `cartCount`.

## Don't
Edit the header or layout (the integrator mounts `CartDrawer` and `CartHydrator`); call the colour engine directly from client code; store anything but cart lines in localStorage.
