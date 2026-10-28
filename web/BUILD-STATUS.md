# Build status: Sofa Factory Outlet rebuild

Spec: `../Plan.md`. Implementation plan: nine phases, one local commit each. Updated after every phase, and the way to resume after a context reset.

**Last updated:** 28 Oct 2026: the autopilot (`tools/orchestrate.ps1`) is running the remaining queue. The phase table further down is from the end of Phase 1; **the Handoff section is current.**

## Handoff (read this first when resuming)

**Merged on `main` (local only, nothing pushed):** Phase 1 foundations, Phase 2 landing page and chrome, the agent infrastructure, then module by module: colour engine, bookings core, invoices core, knowledge pack, FAQs and golden set, guides, store (search, shop, hubs), product page, SEO core (JSON-LD, sitemaps, robots, proxy redirects, OG images, URL test), cart UI, chat widget. Gate on `main` after the store, product, SEO and cart merges: tsc 0, lint 0, vitest 19 files / 155 tests. `git log --oneline` shows every merge.

**Autopilot (needs no Claude):** `tools/orchestrate.ps1` works through `tools/queue.json`. For each task it launches Codex or an OpenCode free model in its own worktree (`D:\Sofa_Factory_wt\<id>`, branch `wt/<id>`), waits, runs the gate on the result (`tools/verify-worktree.ps1`), sends failures back as a fix pass (`tools/fix-pass.ps1`, three runs per task at most), merges green work into `main` (`tools/merge-worktree.ps1`), then runs the whole gate on `main` and reverts the merge if main went red. It never pushes. If Codex runs out of quota it moves tasks to OpenCode. Branches built by Claude (`"tool": "claude"`) are merged as soon as they have commits.
- Start: `Start-Process powershell -ArgumentList '-NoProfile','-File','D:\Sofa_Factory\tools\orchestrate.ps1' -WindowStyle Hidden`. Plan only: `& tools\orchestrate.ps1 -DryRun`. Stop after the current step: create the file `D:\Sofa_Factory_wt\_logs\STOP`.
- Look: `& tools\status.ps1` (queue, orchestrator, log tail, last merges, memory). State is `D:\Sofa_Factory_wt\_logs\state.json`; each task has `<id>.tsc.log`, `.lint.log`, `.test.log` and `.err` beside it; `summary.md` appears when the queue ends.
- Statuses: `queued`, `running`, `finished` (agent exited, to be verified), `verified`, `merged`; `failed` (three runs did not get green: read the task's logs and `web/docs/tasks/_fix-<id>.md` in its worktree); `blocked` (a dependency failed, a merge conflict, or main went red after the merge and the merge was reverted).
- Keep `main`'s tracked files clean while it runs: it waits to merge when there are uncommitted tracked changes.
- Queue: kb-core, chat-pipeline, admin-products, analytics, public-pages, invoices-ui (already running when the orchestrator was written), then admin-bookings, seo-admin-reviews, admin-dashboard, admin-chat-kb, then integration-wiring (mounts cart and chat, composes the proxy, makes the knowledge seed idempotent, audits leftover stubs) and e2e-specs (Playwright specs, never run). auth-shell and booking-ui were built by Claude subagents and are merged by the orchestrator.

**Not automated (next Claude session):**
1. Triage `failed` and `blocked` tasks from `summary.md` and fix or re-queue them (delete the entry from `state.json` to run a task again).
2. Read the report of `integration-wiring` for stubs that are still not implemented, then `next build`, `node scripts/smoke.mjs`, `npm run test:e2e` (the specs were written blind and need a first run and fixes), `npm run test:urls`, `eval:chat` (hit@3 target 90%), Lighthouse mobile (target 90), screenshots on desktop, mobile and reduced motion (`scripts/shots.mjs`) with a visual review of every page, the preloader and the factory line art.
3. Phase 9: CSP in `next.config.ts` (WebGL, workers, Turnstile, Maps, the head boot script), accessibility pass, re-check the claims in `docs/DEPLOY.md` (cron auth, `test:urls` base URL, admin Setup checklist), refresh the placeholder register below.
4. Style debt: several external modules are dense (lines over 140 characters; `tools/verify-worktree.ps1` lists them) and no formatter is installed.
5. Known behaviour: with `DATABASE_URL` set and no Turnstile secret, bookings are refused (fail closed); the booking rate limit is best-effort, not atomic.
6. Auth notes: production needs an AUTH_SECRET of 32+ characters or sign-in stays closed (make sure scripts/e2e-server.mjs sets one for the e2e run); orbidden() is not used because it needs experimental.authInterrupts, staff are sent to /admin/?notice=owner-only instead; the login rate limiter is per instance. <CartHydrator /> is not mounted in the site layout until integration-wiring has run.

**Machine limits:** 7.7 GB RAM and about 25 GB commit limit, nearly all in use: Codex and OpenCode crash at start-up with "insufficient system resources" when too many agents run. Heavy checks go through `scripts/check.mjs` (2-slot queue); never run several `next build` or `next dev` at once, and never two processes on the same PGlite folder. Close Edge, Manus and ChatGPT before a build.

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
