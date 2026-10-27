# Build guide for parallel agents

You are one of many agents building the Sofa Factory Outlet site at the same time. Read this whole file, then the parts of `../Plan.md` named in your task. Work only inside your own area, finish it properly, and report briefly.

## 1. What this is

A Next.js 16 app (App Router, React 19, TypeScript strict, Tailwind v4, Drizzle on Postgres) for a Sri Lankan sofa factory: landing page, store, cart that ends in a booked showroom visit, chatbot, admin, invoices, SEO. `../Plan.md` is the approved spec. `BUILD-STATUS.md` records progress and the placeholder register.

The app runs locally on an embedded Postgres (PGlite). Neon, Vercel Blob, OpenRouter, Resend and Turnstile are optional env-var upgrades (`.env.example`). Never hard-code a service.

## 2. Your workspace

You work in your own **git worktree on your own branch**. Find the app folder with `git rev-parse --show-toplevel`; it is `<root>/web`.

First step, from `<root>`: give the worktree its dependencies (no installing, ever):

```powershell
New-Item -ItemType Junction -Path web\node_modules -Target D:\Sofa_Factory\web\node_modules
```

Prepend Node to PATH in every shell (it is not on the machine PATH):

```powershell
$env:Path = 'C:\Users\janut\AppData\Local\Programs\node-portable;' + $env:Path     # PowerShell
export PATH="/c/Users/janut/AppData/Local/Programs/node-portable:$PATH"            # Git Bash
```

## 3. The machine is small: use the gate

8 logical CPUs, 7.7 GB RAM, many agents. Heavy commands **must** go through the 2-slot queue; they wait their turn automatically. Run from `web/`:

| Command | Does |
|---|---|
| `npm run gate:tsc` | typecheck the whole app (also shows errors in files you don't own: ignore those) |
| `npm run gate:lint -- src/lib/yourarea` | eslint on your paths (`--max-warnings=0`) |
| `npm run gate:test -- tests/unit/yours.test.ts` | vitest on your test files |

Never run `next dev`, `next build`, `next start`, Playwright, `npm install` or anything that opens a browser or a server. The integrator does that. No other long-running processes.

## 4. Ownership and git

- Create or edit **only files in your ownership list** (your task says which). Other agents are writing everywhere else at the same time.
- Never edit: `package.json`, `package-lock.json`, `src/app/globals.css`, `src/lib/db/schema/**`, `drizzle/**`, `src/lib/settings/**`, `src/components/site/**`, `src/app/layout.tsx`, `src/app/(site)/layout.tsx`, `src/app/(site)/page.tsx`, `src/components/landing/**`, `src/components/ui/**`, `next.config.ts`, `.env*`, any other agent's files. If you need a change there (a new dependency, a schema column, a layout hook, a CSS rule), do not make it: describe it in your report.
- Contracts are typed stubs listed in section 6. Implement them behind **exactly the same exported names and signatures**. Don't change a contract: if it blocks you, work within it and say so in the report.
- Commit your work on your branch when done: `git add -A && git commit -m "feat(<area>): <summary>"` with a body ending in `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push, merge, rebase, checkout other branches, stash, reset or delete branches.
- Do not read or print `.env*` files.

## 5. Conventions

**Next 16.** Read the relevant page of `web/node_modules/next/dist/docs/01-app/` before using an API you are unsure of; Next 16 differs from older versions.
- `params` and `searchParams` are **Promises**: `const { slug } = await params`.
- `trailingSlash: true`: internal links end with `/` (`/shop/`, `/product/<slug>/`); call your own API routes with the slash (`fetch('/api/chat/')`).
- `src/proxy.ts` replaces middleware.ts. It must not import the database.
- Public pages read the database through `unstable_cache` wrappers with tags (see `src/lib/catalogue/cached.ts`); after a write call the helpers in `@/lib/revalidate` (`revalidateCatalogue()` …) from a server action or route handler.
- `permanentRedirect()` sends 308; the plan wants 301s, which come from `next.config.ts` redirects or the proxy.
- Route handlers and pages that must run per request use `export const dynamic = 'force-dynamic'`.
- `server-only` is aliased to a stub in tests.

**React lint (strict, errors fail the gate).** No `setState` called synchronously in an effect body (derive state, use `useSyncExternalStore` — see `src/lib/motion/hooks.ts` — or set state inside a callback). Never mutate values returned by hooks. Prefer event handlers over effects.

**TypeScript.** Strict, no `any`, no non-null assertions on user input. Zod 4 (`import { z } from 'zod'`) validates all external input (forms, JSON bodies, query strings, uploaded files). Server actions live in `actions.ts` with `'use server'`, validate with Zod, check the session where required, and return `{ ok: false, error }` objects instead of throwing for expected failures.

**Database.** `import { getDb } from '@/lib/db'` and `import * as s from '@/lib/db/schema'`. Use `db.transaction(async (tx) => …)` for multi-step writes. All money is **integer minor units (cents)** of LKR; format with `formatLkr` from `@/lib/money`. Phones: `normaliseLkPhone` from `@/lib/phone`. Time zone for the business is Asia/Colombo.

**Styling.** Tailwind v4 classes only (don't touch globals.css). Tokens: `bone bone-2 paper ink ink-2 mute line maroon maroon-deep clay clay-soft cocoa good warn bad`; `font-display` (Fraunces, headings) and `font-sans`. Helpers: `site-container`, `eyebrow`, `btn btn-primary btn-ghost`, `link-underline`, radius `rounded-[var(--radius-card)]`. Public look: warm editorial minimalism, big serif headlines (`text-[clamp(...)] font-light leading-[1]`), generous whitespace. Admin look: same tokens, denser. Mobile first; every page works at 360px wide and has no horizontal scroll.

**Components.** Internal links on public pages use `TLink` (`@/components/site/transition`). Product photos use `Picture` (`@/components/picture`) with `PictureData`; white-background cut-outs (`data.cutout`) use `object-contain mix-blend-multiply`, other photos `object-cover`. Reuse `ProductTile`, `ui/*` (Button, Field, Card, Badge, Table), `PageHeader`, `cn()`. Interactive pieces are small client components; data fetching stays in server components.

**Accessibility.** Real labels on every field, visible focus (already global), `aria-live` for async status, keyboard operable, respect `prefers-reduced-motion`, alt text on images, one `h1` per page.

**Truthfulness (important).** Never invent business facts: opening hours, delivery terms, warranty details, prices, awards, customer counts, phone numbers, staff names. Use what is in `src/lib/settings` (values with `confirmed: false` are placeholders from the old site) or word it so it stays true ("confirmed at your visit"). Copy is warm, plain and practical, Sri Lankan/British spelling (colour, metre), no hype.

**Tests.** Vitest in `tests/unit/*.test.ts` (pure logic) and `tests/db/*.test.ts` (uses `getDb()`, which gives a fresh in-memory Postgres already seeded with the 35 captured products; call `closeDb()` in `afterAll`). Test behaviour, edge cases and failure paths, not implementation details.

## 6. Contract stubs (implement behind these signatures)

| File | Owner task | Used by |
|---|---|---|
| `src/lib/catalogue/search.ts` | store-listing | shop, hubs, chat |
| `src/lib/catalogue/product.ts` | product-page | product page, sitemap |
| `src/lib/colour/engine.ts` | colour-engine | cart, product page, chat |
| `src/lib/bookings/api.ts` | booking-core | book-visit UI, admin, chat |
| `src/lib/chat/api.ts` | chat-pipeline | chat route, widget |
| `src/lib/kb/api.ts` | kb-core | chat, admin knowledge |
| `src/lib/invoices/api.ts` | invoices-core | admin bookings/invoices |
| `src/lib/seo/jsonld.tsx` | seo-core | all pages |
| `src/lib/auth/{session,gate,actions}.ts` | auth-shell | every admin page, proxy |

Already real and shared (read, don't edit): `src/lib/cart/*`, `src/lib/notify/bell.ts`, `src/lib/revalidate.ts`, `src/lib/analytics/client.ts`, `src/lib/phone.ts`, `src/lib/money.ts`, `src/lib/settings/*`, `src/lib/catalogue/{queries,cached,types}.ts`, `src/components/{picture,catalogue/product-tile}.tsx`, `src/components/ui/*`, `src/components/admin/page-header.tsx`, `src/components/cart/cart-button.tsx`.

## 7. Finishing

Before you report: `npm run gate:tsc` shows no errors in your files, `npm run gate:lint -- <your paths>` is clean, your tests pass, everything is committed on your branch.

Report in **200 words or fewer**: DONE or PARTIAL; branch name; key files; commands run and results; any contract change you need; known gaps. No code in the report.
