# Task: colour-engine (Codex)

Read `web/docs/BUILD-GUIDE.md` first. Spec source in `../Plan.md`: "Cart and Book a Visit" → "Colour-matched suggestions, starting from the cart" (items 1–6).

**Environment note:** you can write files but cannot run Node, tsc, eslint or tests here (the sandbox cannot see the Node install). Write carefully and keep the code small and obviously correct; the integrator runs every check afterwards. Do not run any git command that writes.

## You own
`src/lib/colour/engine.ts` (replace the contract stub, same exports), `src/lib/colour/pairing.ts`, `src/lib/colour/reasons.ts`, `src/components/catalogue/complete-the-look.tsx` (replace the stub, same export and props), `tests/unit/colour-engine.test.ts`, `tests/db/colour-engine.test.ts`.

## Build
Reuse `classifyHex`, `hueDistance`, `hexToOklch`, `NEUTRAL_FAMILIES`, `Family` from `src/lib/colour/classify.ts` and `FAMILY_LABELS` from `dictionary.ts`. Data: `colour_pairings` (family, pairsWith, weight, reason verb), `category_complements` (categoryId, complementId, weight), published products via `getPublishedCards()` from `@/lib/catalogue/cached` (each `ProductCard` has `colours[]` with `id, name, hex, family`, `category.path`, `featured`).

**`pairing.ts` (pure, no database).**
- `harmony(anchorFamily, candidateFamily, pairings): { score: number; verb: string | null }`: explicit pairing weight (treat pairings as symmetric, take the max of both directions); a neutral family (`NEUTRAL_FAMILIES`) pairs with everything at 0.6; the same family scores 0.35; otherwise fall back to hue distance between representative hexes using `hueDistance` (analogous = small distance 0.4; complementary = large 0.5; the muddy middle = 0.2). Always in [0, 1].
- `categoryFit(anchorCategoryIds, candidateCategoryId, complements): number` = max complement weight (0 when unrelated).
- `scoreCandidate({ categoryFit, harmony, featured, inStock }): number` = `0.5*categoryFit + 0.4*harmony + (featured ? 0.06 : 0) + (inStock ? 0.04 : 0)`. A candidate with `categoryFit === 0` never qualifies.
- `pickSuggestions(input)`: pure function taking anchors (with category id/path, family, colour name), candidates (cards), pairings, complements, `limit`, `excludeProductIds`; skips anchors and excluded ids and any non-published candidate (callers pass published only); for each candidate chooses the colour variant with the best harmony against the anchors (best across anchors); sorts by score (ties by featured, then name); returns up to `limit` with `reason`.

**`reasons.ts`.** `describeReason({ candidateCategoryPath, candidateColourName, candidateFamily, anchorColourName, anchorMaterial, verb })` returns one short sentence in plain English, e.g. "Cream cushions soften emerald velvet", "A glass coffee table brings warmth to grey fabric" (use `verb` from the pairing; if none, "…goes well with …"). Noun by category: pillows → "cushions", ottomans → "ottoman", tables or tables/coffee → "coffee table", chairs → "armchair", beds → "bedding", sofas → "sofa". Lower-case colour names mid-sentence except the first word. No invented facts.

**`engine.ts` (`suggestFor`).** Loads published cards, pairings, complements (cache nothing beyond what `getPublishedCards` already caches), resolves each anchor's product and variant (default variant when `variantId` is missing), calls `pickSuggestions`, returns `Suggestion[]` as in the contract (default `limit` 4).

**`complete-the-look.tsx`.** Async server component: calls `suggestFor`, renders nothing when empty, otherwise a section with the heading (default "Complete the look") and a responsive grid of `ProductTile` (from `@/components/catalogue/product-tile`) each followed by its reason line in small muted text. Tailwind only; tokens in BUILD-GUIDE.

## Tests
`tests/unit/colour-engine.test.ts` (pure): symmetric pairings, neutral pairs with everything, same-family score, hue fallback range, category fit, scoring order, anchors and excluded ids skipped, the best variant is chosen, reasons read naturally. `tests/db/colour-engine.test.ts`: on the seeded database `suggestFor` for an emerald sofa returns up to 4 published items, never the sofa itself, never hidden products.

## Don't
Touch any other file; call a model; invent colour rules beyond the seeded tables (`src/lib/settings/defaults.ts`) plus the fallback above.
