# Sofa Factory Outlet: functionality improvement plan

Prepared 29 October 2026 from repository `januththedev/sofa-factory-outlet`, branch `main`, commit `ef5a798`.

## Implementation status — first release

Implemented locally after the review: public quote requests linked from product/cart pages; an assigned Leads inbox with follow-up queues and activity history; quotation drafts copied from selected products; campaign metadata retained across navigation; private booking access and contact snapshots; repeat-safe booking/quotation/payment operations; shared database limits; stable notification ordering; and a guard against issuing unknown prices as free items.

The remaining roadmap is still planned: customer-facing quote acceptance/revisions, manual social lead entry, comparisons, expanded catalogue availability, fulfillment/delivery tracking, automated reminders, complete translations and campaign-to-sales reporting. These are not represented as completed in this release.

Migration: `drizzle/0002_living_vision.sql`. It adds tables/nullable columns without deleting historic records. Reference-only booking pages now show recovery instructions; existing calendar downloads require private access. No hosted database or deployment was changed.

## Recommendation

Keep the existing application and make it a complete enquiry-to-delivery system. The next release should let a customer request a price without committing to a showroom visit, give staff an assigned follow-up queue, and preserve the connection between the original campaign, enquiry, quotation and eventual sale.

Fix the booking-access and transaction-integrity gaps first. More animation, a replacement framework, or a new chatbot will deliver less immediate value than completing these business workflows.

This is a source-based assessment and implementation plan, not a claim that the deployed application was tested. No application behavior, remote repository or production data was changed during planning. Production data may differ from the capture and seed files.

## Existing capabilities to retain

| Area | Already implemented in the source |
|---|---|
| Catalogue | Search, category/hub pages, filters, colour variants, gallery, dimensions, related pieces and colour pairing |
| Shortlisting | Browser-persisted cart, quantity/colour edits, complementary products, booking with selected items |
| Visits | Slot availability, transaction-locked capacity checks, booking reference, calendar download, staff rescheduling/cancellation |
| Sales administration | Customer records, booking statuses, notes, calendar, quotations, quotation-to-invoice conversion, payment recording, balances, PDFs and exports |
| Chat | Knowledge/FAQ retrieval, product recommendations, optional OpenRouter generation, fallback answers, WhatsApp handoff, conversations and evaluation tools |
| Marketing | First-party events, traffic/funnel reports, UTM fields, SEO metadata, redirects, guides and review requests |
| Operations | Owner/staff access, product import/editing, business settings, notifications and optional owner email alerts |

Current stack: Next.js/React/TypeScript, Drizzle, Neon Postgres with a local PGlite fallback, Vercel Blob with local storage fallback, Auth.js, and optional OpenRouter/Resend. Retain these services; no extra provider is required for the first delivery slice.

## Findings that drive the priorities

These are code observations. Their production impact still needs verification on an isolated preview.

| Finding | Evidence relative to `web/` | Consequence and proposed change |
|---|---|---|
| Public confirmation and calendar routes use a sequential reference as their only lookup credential | `src/app/(site)/book-visit/done/[ref]/page.tsx`, `src/app/api/bookings/[ref]/ics/route.ts`, `src/lib/bookings/api.ts` | A guessed reference can reveal visit time and chosen products. The examined page/ICS do not display the customer's phone or name. Require an unpredictable, scoped access token; keep the human-readable reference for staff use. `noindex` does not authorize access. |
| Public bookings overwrite matched customer records | `createBooking` in `src/lib/bookings/api.ts` | Phone-based upsert replaces name, email and city, including clearing omitted values. Keep the submitted details on the enquiry/booking; do not overwrite an established customer profile based only on an unverified phone number. |
| Submissions and financial transitions need stronger repeat/concurrency protection | `src/lib/bookings/api.ts`, `src/lib/invoices/service.ts` | Booking retries can create duplicate visits; repeated quotation conversion can create multiple drafts. Conversion also omits the source quotation's `bookingId`. Add transaction-safe idempotency, preserve provenance, and lock draft edits/cancellation against issuing/payment changes. Existing slot, invoice-number and payment locks should be retained. |
| Quoted pricing is tied to a visit in the product UI | `src/components/product/product-experience.tsx` | The page says prices are confirmed at the showroom. Add a first-class Request a quote path that does not require a visit date. Staff quotations already exist and should be reused. |
| Customer records are a history view, not an assigned work queue | `src/lib/db/schema/people.ts`, `src/lib/db/schema/bookings.ts`, `src/lib/admin/customers.ts` | There are notes and booking statuses, but no lead owner, next-follow-up date or general lead pipeline. Add these rather than rebuilding customers. |
| Notifications primarily alert staff | `src/lib/notify/email.ts`, `src/lib/analytics/digest.ts` | Optional email covers owner alerts/digest. Add customer confirmation, reminders and retry visibility after contact details are trusted; retain staff-assisted WhatsApp initially. |
| Campaign metadata is read from the current page URL | `src/lib/analytics/client.ts`, `src/components/booking/booking-form.tsx` | UTM parameters can disappear during internal navigation. Persist a bounded first/last-touch attribution record and snapshot it when an enquiry is saved. |
| Availability is a colour-variant boolean | `src/lib/db/schema/catalogue.ts` | It cannot distinguish showroom display, ready stock, made-to-order, lead time or reserved stock. Introduce explicit fulfillment information before offering delivery promises. |
| Local-language support is partial | `src/lib/chat/normalise.ts`, `src/lib/chat/templates.ts`, product/booking components | Some Sinhala/Tamil/Singlish synonyms exist, but full translated UI and localized answer templates do not. Expand the whole customer journey, not just the language switch. |
| Handoff documentation is inconsistent | `BUILD-STATUS.md`, repository history | The cloned remote includes the latest desktop pass, while the document still says those changes are not pushed and retains old pending phase tables. Replace with a current capability/verification matrix. Historical test counts are not fresh verification. |
| Fresh tests expose unstable notification ordering | `tests/db/auth.test.ts:437`, `src/lib/notify/bell.ts` | The query orders only by `createdAt`, without a tie-breaker. The local run returned two recent notifications in the wrong expected order. Add descending ID as a stable tie-breaker and a fixture with explicitly equal timestamps. This is the likely cause from source inspection, not a separately reproduced production incident. |

## Delivery sequence

Effort is a planning estimate for one developer familiar with the code, including focused tests and review. It excludes waiting for product data, translations, provider access and business decisions. Re-estimate after the first release.

### Release 0 — reliable foundation (approximately 3–5 developer days)

1. **Protect booking access.** Issue hashed, random capability tokens with scope, expiry and revocation for confirmation/ICS/manage links. Prevent shared caching and token leakage through referrers/logs. Old reference-only links should expose no booking details and provide a recovery/contact path.
2. **Make repeat actions safe.** Persist submission IDs for booking/quote requests and payment-recording retries. Convert each quotation to one invoice atomically, return the existing result on retry, and preserve booking/lead/campaign links. Add a uniqueness rule for conversion provenance.
3. **Preserve customer data.** Store booking contact snapshots; treat unverified changes as proposed updates for staff review. Separate matching a customer from authenticating one.
4. **Close invoice transition races.** Lock draft edit, issue, cancel and payment operations consistently. Require an explicit reconciliation/refund path for invoices with recorded payments; retain payment history rather than hiding it through cancellation.
5. **Harden abuse controls.** Replace per-process login counters and non-atomic booking count checks with shared, atomic limits using the existing database initially. Document failure behavior. Keep the existing no-CAPTCHA approach.
6. **Establish a reproducible baseline.** Refresh stale handoff notes, add CI for typecheck/lint/unit/database checks and a minimal isolated browser journey, and document media setup. Use fixtures for multiple colours, unknown prices and unavailable variants.

Acceptance: guessed references reveal no visit data; repeat/replayed requests create one intended record; existing customer data survives a new unverified booking; concurrent invoice actions cannot corrupt balances/status; conversion retains attribution. Verify on both PGlite and an isolated Neon preview because concurrency behavior matters.

### Release 1 — capture and follow up enquiries (approximately 5–8 days)

**Customer journey**

- Add **Request a quote** beside **Book a visit** on product and cart pages. Carry the exact product, colour and quantity into the request.
- Ask only for name, phone, preferred contact and city, with optional room dimensions, budget and notes. Do not require an account or visit date.
- Give a reference and a clear next step after successful submission. Preserve the form on failure; flag removed or changed products instead of silently losing selections.
- Make the cart's purpose explicit: selected pieces for a quotation or showroom visit, with no implication that an online purchase has been completed.

**Staff journey**

- Create a Leads inbox: New → Contacted → Qualified → Quote sent → Won/Lost. Visits remain a separate lifecycle linked to a lead.
- Assign a salesperson, next follow-up date, priority, structured lost reason and append-only activity notes. Provide Today, Overdue and Unassigned queues.
- Link customer, conversation, booking and quotations in one lead view. Support manual walk-in, phone and social enquiries with an explicit source.
- Reuse the existing quotation editor and PDF generation. Add quote validity, revision history and an expiring customer quote page with Accept / Request changes. Acceptance records intent; it does not mark an invoice paid.
- Provide prefilled WhatsApp follow-up actions and log staff-confirmed contact outcomes. Opening WhatsApp is not proof that a message was sent.

Acceptance: a phone visitor can request a quote without choosing a slot; staff can claim it, follow up and issue a quote without retyping products; a quote accepted twice creates one acceptance; leads can proceed with or without a showroom visit.

### Release 2 — make the catalogue decision-ready (approximately 4–7 days, plus content collection)

- Add a product-completeness queue that extends existing review notes: approved photos, dimensions, materials, upholstery choices, price mode, lead time and warranty confirmation.
- Use explicit price modes: fixed, approved starting price, or quote required. Unknown prices remain unknown, including invoice drafts created from bookings; require staff confirmation before issuing an unpriced line, with an intentional zero-price override if needed.
- Add ready stock / made to order / unavailable, estimated lead-time range, showroom display availability and SKU. Avoid promising stock reservations from the current boolean.
- Add a compare view for up to three products: size, seats, material, price mode, availability and lead time. Display unknown values honestly.
- Add shareable shortlists containing products only, with a random link and expiry; do not attach customer details to a publicly shareable list.
- Add a simple room-fit assistant using actual room and product dimensions. Account for clearance and orientation; present it as a size check, not a guaranteed fit or photorealistic room simulation.
- Where the business supplies approved delivery rules, show an area-based delivery estimate with assumptions and an explicit quote fallback.

Acceptance: customers can distinguish ready stock from made-to-order items, compare real dimensions, and recover gracefully from product changes. Staff can see exactly which data prevents a product being ready for publication.

### Release 3 — manage visits, orders and delivery (approximately 6–10 days)

- Add token-protected customer rescheduling/cancellation with cutoff rules and capacity checks, reusing the existing admin logic. Model confirmed/no-show explicitly if those are required operational states.
- Add an order record after an accepted quote or staff-confirmed sale: awaiting deposit → confirmed → production/preparation → ready → dispatched → delivered. Keep payment status separate from fulfillment status.
- Track delivery address snapshots, expected date/window, assigned delivery staff, internal notes and completion evidence. Capture customer-approved changes to made-to-order specifications.
- Add deposit/balance milestones, payment due dates, receipts and owner-authorized corrections/refunds. Extend existing payment recording before integrating an online gateway.
- Create an outbox for customer notifications, with deduplication, retry count, last error and cancellation when a visit/order changes. Start with dashboard tasks; enable email or approved messaging only when configured.
- Show a secure customer status page, then trigger a review-request task after the appropriate visit/delivery milestone. Existing reviews and review links should be reused.

Acceptance: staff can trace an order from lead to delivery; financial balances reconcile with payment records; changing a visit cancels stale reminder jobs; repeated delivery/payment actions do not duplicate effects; customer access never exposes another customer's records.

### Release 4 — language, better chat and measurable marketing (approximately 5–8 days)

- Translate the public catalogue, filters, cart, quote/booking forms, errors, confirmation and policy copy into English, Sinhala and Tamil. Persist the chosen locale, retain cart/form state on switching, and use reviewed business terminology.
- Test Sinhala/Tamil combining marks and Singlish normalization, local-language retrieval, mixed-script searches and localized fallback responses. Expand the existing evaluation set with real, anonymized customer questions.
- Improve chat qualification around budget, room size, city and upholstery; make its next step a quote, a visit or a named staff queue. Keep answers grounded in confirmed catalogue/business data.
- Persist first/last-touch attribution across navigation, then carry a snapshot through lead, quote, invoice and payment. Distinguish website attribution from staff-entered social sources.
- Add reports for response time, overdue follow-ups, enquiry-to-quote, quote-to-sale, visit attendance and campaign-attributed sales/collections. Keep invoiced totals separate from collected cash.
- Add a UTM link builder for Facebook/Instagram campaigns. Do not claim ad spend or ROAS until real spend data is imported or integrated; do not label WhatsApp clicks as messages or sales.

Acceptance: switching language preserves selections; factual chat answers remain grounded across supported languages; an ad landing → product → cart → enquiry journey preserves attribution; campaign reports reconcile to the linked sales records and label unattributed activity.

## Data and implementation shape

Use additive migrations and keep public validation, business rules and admin UI separate. Reuse `requireRole`, existing catalogue queries, booking locks, currency helpers, settings and notification infrastructure.

| Addition/change | Purpose |
|---|---|
| `leads`, `lead_items`, `lead_activities`, `follow_up_tasks` | Capture enquiries, immutable selected-item snapshots, assignment and accountable follow-ups |
| `customer_access_tokens`, `idempotency_keys` | Scoped access, revocation and safe retries; store token hashes, not raw bearer tokens |
| Booking contact snapshots; controlled customer-update workflow | Preserve submitted details without allowing public requests to mutate verified profiles |
| `quote_revisions`, quote validity/acceptance fields | Preserve what the customer accepted and support a safe single conversion |
| `orders`, `order_items`, `order_status_events`, delivery records | Separate fulfillment progress from visit and financial status |
| Payment idempotency keys, due dates, adjustment/refund records | Reconcile collections and corrections without deleting history |
| `notification_outbox`, `audit_events` | Reliable notification attempts and actor-attributed changes |
| Product availability/lead-time fields, translation records | Accurate product decisions and language support |
| Attribution snapshots and stable lead/invoice references | Preserve marketing provenance through conversion |

Backfill existing bookings/invoices without inventing historic attribution or lead stages. Preview migration and rollback/recovery steps before release. Bound token, event and outbox retention. Customer exports and sensitive financial actions retain explicit role checks.

## Testing and rollout

- **Existing baseline:** run `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=1`, production build, then existing Playwright and mobile journeys on an isolated database with seeded media.
- **Release 0:** add meaningful database/concurrency tests for duplicate submissions, token scope/expiry, customer preservation, conversion uniqueness and draft/issue/payment/cancel races.
- **Release 1:** browser test product → quote request → staff assignment → quotation, plus validation failures, refresh/retry and a removed variant.
- **Release 2:** verify compare/shortlist state, missing dimensions, unknown prices and variant-specific availability.
- **Release 3:** test simultaneous reschedules, reminder deduplication, partial payments/refunds and invalid order-state transitions.
- **Release 4:** test translations and keyboard/mobile access, Unicode retrieval, attribution across routes and report reconciliation.
- Roll out changes as small reviewable releases. Do not run booking-creating audits against production. Measure a baseline before claiming any conversion or revenue uplift.

## Inputs to collect while building

These do not block foundation work: real prices/starting prices, clean approved product photos, dimensions and upholstery options; ready-stock versus made-to-order policy; lead times and delivery charges; confirmed warranty terms; who owns incoming enquiries; desired response/follow-up cadence; quote validity and deposit policy; reviewed Sinhala/Tamil translations.

The captured source reports mostly unknown prices and flagged images. Treat that as a content audit starting point, not proof of the current production catalogue's state.

## First implementation slice

Deliver Release 0, then **Request a quote → assigned lead → next follow-up → existing quotation editor**. This is the smallest useful increment that turns browsing interest into accountable sales work. Next add catalogue completeness and campaign attribution. Defer AR room placement, a full ERP, automated social publishing and online checkout until product data and the core sales process justify them.

## Verification of the implemented first release

- TypeScript and ESLint pass. The production build passes with a fresh isolated local PGlite database.
- Full unit/database suite: **1,114 passed across 77 files**. After the campaign-cookie refinement, the focused attribution/proxy suite also passed **10 tests**, including browser-encoded and server-decoded cookie values with literal percent signs.
- Browser verification against a production build: **4 passed**. Covered booking plus authenticated calendar download; full-slot behavior; mobile product/cart → quote → assigned staff → Colombo-time follow-up → existing quotation editor; and validation preserving inputs plus reference-only booking privacy.
- Phone quote form and desktop lead details were visually inspected. Browser tests use fake contact data and isolated local databases.
- The earlier notification-ordering failure is fixed with a descending ID tie-breaker. Existing seed/contact tests were updated for the additive tables and the new customer-preservation behavior.
- GitHub Actions now checks typecheck, lint, unit/database tests and build on pull requests and main pushes. The hosted workflow has not been run from this workspace.
- Migration, token access and transaction behavior were verified on PGlite. A Neon preview migration, real-device testing and live provider integrations remain deployment checks.
- No hosted database was migrated and no production deployment was changed. The remaining releases in this roadmap are still planned.
