# Deploying Sofa Factory Outlet

The existing local data has been migrated to Neon, and 320 compressed catalogue image files have been uploaded to the private Vercel Blob store. Production environment variables are configured on the Vercel project `web`. Never commit environment files or credentials.

## 1. What runs where

| Part | Local (today) | Hosted |
|---|---|---|
| App | `npm run dev` / `npm run start` | Vercel, project root directory **`web`**, functions in `iad1` near the database |
| Database | PGlite in `.data/pglite` | Neon Postgres, US East, `pg_trgm` extension |
| Product photos | `.data/blob`, served by `/blob/…` | Private Vercel Blob, streamed through `/blob/` with CDN caching |
| Chatbot | template answers from the knowledge pack | OpenRouter free models, template fallback stays |
| Email | admin bell only | Resend (optional) |
| Booking controls | Form validation, phone/browser rate limits and slot capacity | Same controls; no CAPTCHA service |

Pushing to the hosted services is outward-facing: do the steps below only when the client has agreed to the accounts and costs.

## 2. Accounts (client's name)

Required services are Vercel, Neon and Vercel Blob. OpenRouter is optional for model-generated chat answers; without its key, templates and catalogue answers remain available. Resend, Search Console and IndexNow are optional integrations and do nothing without their keys. Vercel commercial usage requires an eligible paid plan; see https://vercel.com/docs/limits/fair-use-guidelines.

## 3. Environment variables

Set for **Production and Preview**. `src/lib/env.ts` is the single source of truth; the app starts without any of the optional ones.

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string. Its presence switches the app off PGlite |
| `DATABASE_URL_UNPOOLED` | yes | Neon direct connection, used by `npm run db:migrate` |
| `BLOB_READ_WRITE_TOKEN` | yes | Server-only Vercel Blob credentials; private catalogue images are read through the app |
| `BLOB_ACCESS` | yes for private stores | Set to `private` for this project; public catalogue images use `/blob/`, while other files in the private store are never exposed by that route |
| `AUTH_SECRET` | yes, already configured | Signs admin sessions; generated securely and saved in Vercel |
| `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME` | first deploy | Creates the owner account when the database is seeded; change the password after the first login |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://sofafactoryoutlet.lk`: canonical URLs, sitemaps, share images. An https value also turns on HSTS and `upgrade-insecure-requests` |
| `CRON_SECRET` | yes, already configured | Generated securely and saved in Vercel; authenticates scheduled jobs |
| `OPENROUTER_API_KEY` | for the model | Without it the chatbot answers from the knowledge pack only |
| `OPENROUTER_CHAT_MODELS`, `OPENROUTER_EMBED_MODEL` | no | Model list in fallback order; embedding model (admin settings can override) |
| `RESEND_API_KEY`, `ADMIN_ALERT_EMAIL`, `EMAIL_FROM` | no | Booking emails and the morning digest |
| `INDEXNOW_KEY` | no | Pings Bing and others when products change |
| `GSC_SERVICE_ACCOUNT_JSON`, `GSC_SITE_URL` | no | Search Console data on the SEO page; the daily job is a no-op without them |

## 4. First deploy

1. **Neon.** Use the connected US East database. `drizzle/0000_extensions.sql` enables `pg_trgm`. Use separate database branches for previews when enabling preview deployments.
2. **Blob.** Connect the private store and set `BLOB_ACCESS=private` alongside its token. The `/blob/` route streams only content-addressed catalogue images and sets browser/CDN cache headers.
3. **Env.** Add every variable above in Vercel (Production and Preview).
4. **Seed, once, from this machine** with the Neon and Blob values in `web/.env.local` (never commit it):

   ```powershell
   $env:Path = 'C:\Users\janut\AppData\Local\Programs\node-portable;' + $env:Path
   cd D:\Sofa_Factory\web
   npm run db:migrate     # schema, extensions, indexes (uses DATABASE_URL_UNPOOLED)
   npm run media:import   # sizes the originals into AVIF/WebP and uploads them to Blob
   npm run db:seed        # categories, 35 products (15 published, 20 hidden), settings, owner, knowledge pack
   ```

   `media:import` needs the originals in `../assets/uploads` (`download-images.ps1` fetches them; the folder is git-ignored). Preview branches inherit Neon data from their parent branch, so the seed runs once.
5. **Vercel project.** Import the GitHub repository, root directory `web`, Node 24. `vercel.json` sets the region, the build command (`scripts/check-production-env.mjs`, which stops the build and lists any missing required variable, then `db:migrate`, then `build`) and the three daily crons (rollup 00:15, digest 08:00 and Search Console 03:30, Colombo time; Hobby allows once-a-day jobs). The cron paths end in `/` because the app uses trailing slashes and Vercel cron jobs do not follow redirects.
6. **Deploy**, then open the preview URL and run the checks in section 5.

## 5. Checks on the preview deployment

- [ ] `/api/health/` reports 35 products, 15 published and 20 hidden; photos load through `/blob/` and return cache headers
- [ ] `@img/sharp-linux-x64` resolved in the install log (the lockfile was written on Windows, and sharp also runs on Vercel for admin photo uploads), then upload one photo in admin to prove it
- [ ] `BASE_URL=<preview> npm run test:urls`: every captured URL answers 200, or 301 then 200
- [ ] Booking flow end to end: pick a slot, receive the reference, `.ics` downloads, the admin bell shows it
- [ ] Admin login works, a product edit appears on `/shop/` within a minute
- [ ] Chat: template answers work; with the OpenRouter key a model answer streams; `npm run eval:chat` hit@3 is 90% or above
- [ ] Lighthouse mobile on `/`, `/shop/` and a product page: 90 or above, LCP under 2.5 s
- [ ] Google Rich Results Test on one URL of each type: product, breadcrumb, organization, article
- [ ] The CSP shows no violations in the browser console (WebGL, workers and Maps must keep working)

## 6. Launch checklist (from Plan.md)

- [ ] Replace the 20 borrowed product photos with the client's own, then publish those products in admin (their old URLs currently 301 to the category hub)
- [ ] Fill every item of the placeholder register in `BUILD-STATUS.md` (admin → Settings → Setup shows what is still unconfirmed)
- [ ] Add `sofafactoryoutlet.lk`, redirect `www`, switch DNS; keep a full WordPress backup for 90 days
- [ ] Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools; check coverage daily for two weeks
- [ ] Create or claim the Google Business Profile; add the review link in admin Settings
- [ ] A staff account for each team member; verify a Resend domain only if booking emails are enabled

## 7. Month 3 switch (about half a day)

Move the project to a Vercel Pro team, buy OpenRouter credits, turn on embeddings in admin settings (the admin action probes the model's dimension, adds the `vector` column and index, and re-indexes), re-run the golden test. No code changes.

## 8. Rollback

Vercel keeps every deployment: promote the previous one. Neon keeps point-in-time history for restoring the database. The seed is idempotent, so running it again never duplicates products.

## Preview environment setup

Production-only variables are not supplied to branch previews. Configure `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `BLOB_ACCESS`, `AUTH_SECRET` and `CRON_SECRET` for Preview too, using isolated database/storage resources and separate secrets. Preview deployments use `https://${VERCEL_URL}` when `NEXT_PUBLIC_SITE_URL` is absent; Production still requires an explicit HTTPS site URL. The checker and application use the same fallback. Changes to Vercel settings apply to new deployments. The npm `cache-dir` warning is unrelated to missing application settings.
