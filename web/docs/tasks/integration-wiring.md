# Task: integration-wiring (mount the shared UI, compose the proxy, boot-time seeds, stub audit)

Read `web/docs/BUILD-GUIDE.md` first. Unlike every other task, this one may edit the shared files other tasks must not touch, but only for the items below.

## You own
`src/app/(site)/layout.tsx`, the header and footer components under `src/components/site/`, `src/proxy.ts` (composition only), `src/instrumentation.ts`, the knowledge seed in `src/lib/kb/` (only to make it idempotent), `scripts/db-seed.ts` (only to call the knowledge seed), `tests/unit/proxy-compose.test.ts`.

## Do
1. **Cart.** In `src/app/(site)/layout.tsx` mount `CartHydrator` and `CartDrawer` once (they live under `src/components/cart/` and `src/lib/cart/`: find the exports). In the header add `CartButton` next to the primary navigation; it must be visible at 360 px wide.
2. **Chat.** Mount `ChatWidget` (`src/components/chat/chat-widget.tsx`) in the same layout. It loads its panel lazily; do not import the panel.
3. **Navigation.** Header links: Shop, About, Factory, Visit, Guides, Book a visit. Footer adds Trade and Privacy. Use `TLink`. Keep one `h1` per page and leave the landing sections alone.
4. **Proxy.** `src/proxy.ts` composes, in this order: the admin gate for `/admin/**` except `/admin/login` (`adminGate` from `src/lib/auth/gate.ts`), then the DB-driven redirect map the SEO module already added. It must not import the database. The matcher excludes `_next`, `blob`, files with an extension and `api/cron`.
5. **Knowledge seed.** Make `seedKnowledge` (kb module) idempotent: running it twice changes nothing and never duplicates chunks. Call it from the local boot path in `src/instrumentation.ts` (PGlite mode only) and from `scripts/db-seed.ts`.
6. **Stub audit.** Search `src/` for `notImplemented` (`src/lib/not-implemented.ts`). Every contract stub should have been replaced by now. Do NOT write an implementation for one that remains: list it in your report with its file and the module that owns it.

## Tests
`tests/unit/proxy-compose.test.ts`: an admin path without a session redirects to the login page, `/admin/login` passes through, a legacy URL still answers 301, static asset paths are untouched. Use the real functions with `NextRequest` objects from `next/server`.

## Don't
Edit other modules' files, add dependencies, change contracts, or touch `src/components/landing/**`.
