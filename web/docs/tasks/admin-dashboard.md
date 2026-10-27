# Task: admin-dashboard (dashboard, settings, setup checklist)

Read `web/docs/BUILD-GUIDE.md` first. Spec sources in `../Plan.md`: "Admin panel" (Dashboard and Settings rows), "Visitor analytics" (what the Dashboard summarises), "Open questions for the client" (the setup checklist).

## You own
`src/app/admin/(panel)/page.tsx` (the dashboard at `/admin/`), `src/app/admin/(panel)/settings/**`, `src/components/admin/dashboard/**`, `src/components/admin/settings/**`, `src/lib/admin/stats.ts`, `src/lib/admin/settings.ts`, `src/lib/admin/setup-checklist.ts`, `tests/db/admin-stats.test.ts`, `tests/unit/setup-checklist.test.ts`.

## Build (every page and action starts with `requireRole()` from `@/lib/auth/session`; **settings are owner-only**, the dashboard is for staff and owners)
**Dashboard `/admin/`**: header with today's date (Asia/Colombo), then cards: visitors today and over 7 days, bookings (new today, next 7 days, by status), visitor-to-booking conversion, most-viewed products (top 5 with counts), top chatbot questions (top 5 from `chat_messages`), open knowledge gaps count (with a link), unread notifications count, upcoming visits (next 5 bookings with date/slot/name), low-hanging setup items. Read visitor numbers from `daily_stats` (rolled up nightly) plus today's raw `events` (the analytics agent writes both; if a table is empty show "No data yet" states rather than zeros that look like errors). Small sparkline/bar charts with `recharts` in client components (`dynamic` import not needed); accessible text alternatives for each chart. Pure query functions in `src/lib/admin/stats.ts` (they take a `db` handle or call `getDb()`), unit-testable with inserted rows.

**Setup checklist** (`setup-checklist.ts` + a card at the top of the dashboard, dismissible per item stays visible until fixed): derives from settings and data what the client still has to confirm, each item with a link to where to fix it: address (`business.address.confirmed`), phone, WhatsApp, email, social links, Google review URL, opening hours (`hours.confirmed`), visit slots (`booking.confirmed`), delivery and warranty terms (`delivery.confirmed`), bank details and VAT (`invoice.confirmed`), proof numbers (`proof.confirmed`), real prices (count of published products with no price), photos flagged borrowed or licence (count), products needing review, no approved reviews yet, no Search Console/OpenRouter/Resend keys configured (read presence only, never print values), owner password still the seed default is NOT detectable so skip. Pure function over a plain input object, unit-tested.

**Settings `/admin/settings/`** (owner-only; tabs or sections, each a Zod-validated server action that upserts the matching `settings` key through `src/lib/admin/settings.ts` and then calls `revalidateSettings()` from `@/lib/revalidate`): 
- **Business** (`settings.business`): name, tagline, address (street, locality, city, postal code), phone, WhatsApp (normalised with `normaliseLkPhone`), email, Facebook/Instagram/TikTok/YouTube URLs (must be `https`), Google review URL, map link, price range text; each detail with a "Confirmed by the client" checkbox that sets `confirmed: true` (the public site and structured data only use confirmed details).
- **Hours and visits** (`settings.hours`, `settings.booking`, `booking_slots`): opening hours per weekday (open/close or closed), closed dates list, lead days and horizon, **visit slots table** (weekday, start, end, capacity, active; add/remove rows; validation: end after start, no overlaps within a weekday).
- **Invoices** (`settings.invoice`): prefix, quotation prefix, tax on/off, label, rate (percent in the UI, basis points stored), VAT number, bank details, default terms, warranty text, logo preview.
- **Delivery and warranty** (`settings.delivery`) and **Proof numbers** (`settings.proof`).
- **Chat and SEO switches** (`settings.chat`, `settings.seo`): daily model budget, buffer calls, per-session model answers, messages per 10 minutes, model list override (comma separated), temperature, max tokens, timeout; AI-crawler policy allow/block; IndexNow on/off. (The knowledge-base agent adds its own embeddings controls elsewhere.)
- **Staff accounts**: list, add (name, email, role, temporary password set once and shown once), deactivate/reactivate, reset password, change role; the owner cannot deactivate themselves or remove the last owner. Hash with `hashPassword` from `@/lib/auth/password` (an auth-shell file; import it, don't recreate it).
Show unconfirmed items with an amber "Placeholder from the old site" badge. All saves show a toast-like inline status (`aria-live`).

## Tests
`tests/db/admin-stats.test.ts` (insert events/daily_stats/bookings/chat rows): each stat query, empty-data behaviour, Colombo date boundaries. `tests/unit/setup-checklist.test.ts`: each item appears and clears correctly. Add unit tests for the slot validation (overlaps, ordering) and basis-point conversion.

## Don't
Edit `src/lib/settings/**` (types and defaults are fixed: read them); print secret values; let staff reach settings.
