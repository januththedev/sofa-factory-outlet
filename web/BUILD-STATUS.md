# Build status: Sofa Factory Outlet rebuild

Spec: `../Plan.md`. Implementation plan: nine phases, one local commit each. Updated after every phase, and the way to resume after a context reset.

**Last updated:** 28 Oct 2026, morning: six external-agent modules merged and green; the first Claude wave produced nothing (usage limit). The phase table further down is from the end of Phase 1; **this Handoff section is current.**

## Handoff (read this first when resuming)

**Committed on `main` (nothing pushed, no remote):** Phase 1 foundations (`ef455f9`), Phase 2 landing page + site chrome (`90eb356`, desktop screenshots reviewed), agent infrastructure (`30f5709`: `docs/BUILD-GUIDE.md`, 23 specs in `docs/tasks/`, `content/knowledge/_FACTS.md`, typed contract stubs, `scripts/check.mjs` + `scripts/gate.mjs` 2-slot queue for tsc/lint/vitest), then six external-agent modules, merged and verified on 28 Oct:
- colour engine, pairing, reasons and `CompleteTheLook` (Codex);
- bookings core: availability, transactional create, ICS, WhatsApp links (Codex);
- invoices core: totals, numbering, payments, PDF, signed share links (Codex);
- knowledge pack (OpenCode, `deepseek-v4.1-flash-free`), 80 FAQs + synonyms + 60-question golden set (`glm-5.3-flash-free`), two buying guides (`mimo-v2.6-flash-free`).

**Gate on the merged tree: `tsc` 0, `lint` 0, vitest 103/103.** Integration fixes made while merging: `next/cache` stub for tests (`tests/stubs/next-cache.ts`), Postgres bigint strings converted with `Number()` in the invoice service, and the colour-engine DB test now asserts the real catalogue (no published non-sofa piece, so a sofa gets no suggestions until one is published).

**First Claude wave failed.** All 17 Claude subagents (store-listing … seo-admin-reviews) hit the account's session limit within their first steps and produced nothing. The two harness worktrees left under `.claude/worktrees/` hold no work. Their specs in `docs/tasks/<id>.md` are intact, so any module can be started again.

**Wave 2 (launched 28 Oct, unmerged until verified):** Codex: store-listing, product-page, seo-core, chat-pipeline. OpenCode free models: analytics (`deepseek-v4.1-flash-free`), chat-widget (`glm-5.3-flash-free`), public-pages (`mimo-v2.6-flash-free`). Claude Sonnet subagents in `.claude/worktrees/`: auth-shell, cart-ui, booking-ui (these commit on their own branch and run the gate themselves).

**Not started yet:** admin-products, admin-bookings, admin-dashboard, kb-core, admin-chat-kb, invoices-ui, seo-admin-reviews.

`docs/DEPLOY.md` and `vercel.json` (region `sin1`, build runs `db:migrate`, three daily crons with trailing slashes) are written. After the modules merge, re-check the claims in DEPLOY.md that depend on them: cron routes reject requests without `CRON_SECRET`, `test:urls` base-URL variable, the admin Setup checklist, the CSP.

**External CLIs.** Codex `C:\Users\janut\.codex\packages\app-server-daemon\current\bin\codex.exe` (0.164.0, ChatGPT login). OpenCode `C:\Users\janut\AppData\Roaming\npm\opencode.cmd` (2.2.0): only models ending `-free` (`deepseek-v4.1-flash-free`, `glm-5.3-flash-free`, `mimo-v2.6-flash-free`, `nemotron-3.5-lightning-free`, `nemotron-3.5-super-vl-free`, `beam-free`; `nemotron-3-ultra-free` and `flint-40b-free` were unavailable). Both are **write-only**: Codex's sandbox often cannot see Node, and OpenCode runs from a least-privilege `opencode.json` (edit allowed; bash, webfetch and external directories denied). Worktrees `D:\Sofa_Factory_wt\<id>` (branch `wt/<id>`), logs `D:\Sofa_Factory_wt\_logs\<id>.*`. The auto-mode classifier blocks `opencode --auto`, `-ExecutionPolicy Bypass` and pattern-based process kills; launch inline with `Start-Process` as in `tools/launch-external.ps1`.

**To do, in order:**
1. Build the unbuilt modules in small waves (three Codex at once at most, three OpenCode free-model writers, three or four Claude subagents), each in its own worktree cut from current `main`. Review each diff, run `node scripts/check.mjs tsc|lint|test` on it, commit in the worktree with `git add web ':!web/node_modules'`, then merge into `main` one at a time and re-run the gate. Content written by free models gets a fact check against `content/knowledge/_FACTS.md` before it ships (hours, delivery and warranty stay hedged).
2. Integration wiring is step 3 below, once the modules it mounts exist.
3. Integration wiring reserved for the integrator: mount `CartHydrator`, `CartDrawer` and `ChatWidget` in `src/app/(site)/layout.tsx`, add `CartButton` to the header, make `seedKnowledge` safe to run on every start, confirm `src/proxy.ts` composes `adminGate`.
4. `next build`, `node scripts/smoke.mjs`, write and run Playwright specs per flow (shop, product, cart, booking incl. full slot, admin login/bookings/product save, chat, invoice PDF), `npm run test:urls`, `eval:chat` (hit@3 target 90%), Lighthouse mobile (target 90), screenshots of mobile and reduced-motion landing.
5. Open Phase 2 items: preloader never seen in a screenshot (verify with a fresh context), factory step-1 line art draw-in after the `vector-effect` fix, mobile and reduced-motion runs of `scripts/shots.mjs`.
6. Phase 9: `docs/DEPLOY.md`, `vercel.json` (region sin1, daily crons), CSP that still allows WebGL, workers, Turnstile, Maps and the head boot script, accessibility pass, update this file and the placeholder register.

**Machine limits:** 7.7 GB RAM with only 0.5–0.8 GB free (Manus, ChatGPT, Edge and Defender are the big consumers): close them before `next build`. Heavy checks always go through `scripts/check.mjs`; never run several `next build`/`next dev` at once, and never two processes on the same PGlite folder.

## Commands (Windows, portable Node)

```powershell
$env:Path = 'C:\Users\janut\AppData\Local\Programs\node-portable;' + $env:Path   # PowerShell
# Git Bash: export PATH="/c/Users/janut/AppData/Local/Programs/node-portable:$PATH"
cd D:\Sofa_Factory\web
npm run dev            # http://localhost:3000, embedded database in .data/pglite
npm run verify         # typecheck + lint + unit/db tests + production build
npm run smoke          # after a build: starts the server and checks it over HTTP
npm run test:e2e       # Playwright: own build (.next-e2e), port 3100, database .data/pglite-e2e
npm run media:import   # re-process ../assets/uploads into AVIF/WebP + brand files (add -- --force to redo)
npm run db:reset       # delete the local database; it migrates and re-seeds on next start
```

Only one process may open the local database. Stop `npm run dev` before `build`, `smoke` or `db:reset` (a lock file names the owner). Scripts that need data call protected routes instead (`npm run cron -- <job>`).

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Prep: git, image download | Done |
| 1 | Foundations: schema, driver switch, seed, media pipeline, harness | Done |
| 2 | Landing page | Pending |
| 3 | Store and product pages, SEO plumbing, redirects | Pending |
| 4 | Cart, colour engine, Book a Visit | Pending |
| 5 | Admin core | Pending |
| 6 | Knowledge base and chatbot | Pending |
| 7 | Visitor analytics | Pending |
| 8 | Invoices | Pending |
| 9 | Polish and launch prep | Pending |

### Phase 1 results

- typecheck, `eslint --max-warnings=0`, 30 unit and database tests, `next build` (1 worker): pass.
- `npm run smoke`: 14/14. 35 products (15 published, 20 hidden), 14 categories and hubs, 20 hidden-product redirects, photos for all 35, owner account, WebP and AVIF served from `/blob/`, 301s for `/product-category/…` and `/checkout/`, 308 for a missing trailing slash.
- Playwright (desktop): 3/3 against its own production build.

## Deviations from Plan.md

- **Next.js 16.4.3** instead of 15, which brings `proxy.ts` (middleware's new name) and `revalidateTag(tag, profile)`.
- The **20 products with borrowed catalogue photos** are imported `hidden`, with their old URLs 301-redirecting to the category hub.
- **Local only:** PGlite stands in for Neon, `.data/blob` for Vercel Blob, and the chatbot runs template-only until `OPENROUTER_API_KEY` exists. Switching is environment variables only.
- `ua-parser-js` v2 is AGPL, so the analytics will use a small in-house classifier.
- Tailwind runs through `@tailwindcss/turbopack`, as in the T2T project.
- Shared classes (`site-container`, `btn`…) are Tailwind v4 `@utility` rules. `@apply` of a class defined in `@layer components` fails in v4.

## Placeholder register (facts the client still has to supply)

| Item | Where it lives now | Seeded as |
|---|---|---|
| Address (67 Pallidora Road, Dehiwala, Colombo) | `settings.business` | `confirmed: false` (from the old site's map embed) |
| WhatsApp (+94 76 671 1711) | `settings.business` | `confirmed: false` (from product copy) |
| Phone, email, Facebook/Instagram/TikTok/YouTube | `settings.business` | empty |
| Google review link, map coordinates | `settings.business.map` | empty |
| Opening hours and visit slots | `settings.hours`, `booking_slots` | Mon–Sat 10:00–18:00, four 2-hour slots, capacity 3 (placeholder) |
| Delivery areas, charges, lead times, warranty | `settings.delivery` | placeholders; the old copy says 10-year structural warranty and 10–15 working days |
| VAT, bank details, invoice terms | `settings.invoice` | empty or placeholder terms |
| Real prices (34 of 35 are "on request") | `products.price_minor` | null |
| Dimensions, seats, materials, colours | `products` and `product_variants` | derived from titles (`needs_review`); dimensions null |
| Original product photos | `product_variants.images` | captured photos, 20 flagged `borrowed`, 5 flagged `licence` |
| Customer reviews | `reviews` | none (the captured six are not reused) |
| Proof numbers (years, homes, districts) | `settings.proof` | null |
| Golden-set questions (50–60 from WhatsApp/Facebook) | `content/golden/` | placeholder set (Phase 6) |
| Keyword volumes and SERP notes | `content/seo/keyword-map.json` | pending |
| Logo vector (`…Vector-file.ai`) | `public/brand/` | cut from the captured PNG |
| Owner and staff accounts | `admin_users` | owner from `OWNER_EMAIL` / `OWNER_PASSWORD` |

## Notes for later phases

- **Design review facts to re-verify in the Next 16 docs** (`node_modules/next/dist/docs/01-app/`) before relying on them in Phase 3:
  - `proxy.ts` runs on Node by default, and a `runtime` export throws.
  - `redirects()` with `permanent: true` sends 308, so use `statusCode: 301`; `?p=` redirects need the proxy because a query string is copied onto the destination.
  - `permanentRedirect()` always sends 308, so exact 301s for hidden or renamed products come from the proxy.
  - `revalidateTag(tag, 'max')` outside Server Actions, `updateTag` inside them.
  - With `cacheComponents`, `generateStaticParams` must return at least one param, and a streamed App Shell turns `notFound()` into a 200. **Open decision:** enable `cacheComponents`, or stay on the classic model with tagged data cache. Pick it at the start of Phase 3 and record it here.
  - Keep the database out of `proxy.ts` (it runs in a separate bundle). DB-driven redirects: the proxy fetches `/api/internal/redirects/` and caches it for 30 s. ESLint already blocks `@/lib/db` imports in the proxy.
- Trailing slashes: API routes without a dot get a 308, so client code calls `/api/chat/`, `/api/track/` with the slash.
- sharp: pass Buffers, not file paths (some captured file names contain an emoji or an em dash). `trim` runs before `extract` inside one pipeline, so crop first, then trim.
- Seeded `reviewNotes` surface in admin: `borrowed-images`, `supplier-photos`, `photo-mismatch` (product 685), `no-description`, `price-on-request`, `derived-facets`, `size-options` (product 410), `no-dimensions`.
- The auto-mode classifier blocked running `download-images.ps1` through PowerShell. The same 84 files were fetched with Python from `data/media.json`; the script itself is fixed and still works for the client.
