# Task: invoices-core (Codex)

Read `web/docs/BUILD-GUIDE.md` first. Spec source in `../Plan.md`: "Invoices" (steps 1–7, extras) and "Data model" (invoices, invoice_items, payments, invoice_counters).

**Environment note:** you can write files but cannot run Node, tsc, eslint or tests here (the sandbox cannot see the Node install). Write carefully; the integrator runs every check afterwards. Do not run any git command that writes.

## You own
`src/lib/invoices/**` (replace `api.ts`: keep **every** export name, type and signature; add files such as `totals.ts`, `numbering.ts`, `service.ts`, `pdf.tsx`, `share.ts`), `src/app/api/invoices/[id]/pdf/route.ts`, `tests/unit/invoice-totals.test.ts`, `tests/db/invoices.test.ts`.

## Build
All money is integer minor units (cents) of LKR; percentages are basis points. No floating point in money maths: use integer arithmetic and round half up exactly once, at the documented step.

**`computeTotals` (pure, in `totals.ts`).** For each line: `line = quantity * unitMinor − (discountMinor ?? 0)` clamped to ≥ 0; `subtotal = Σ lines`; invoice discount: `amount` (minor units, clamped to the subtotal) or `percent` (basis points: `round(subtotal * value / 10000)`, value clamped 0–10000); `taxable = subtotal − discount + delivery`; `tax = round(taxable * taxRateBp / 10000)`; `total = taxable + tax`; `balance = max(0, total − paid)`. Never returns negative values; `paidMinor` defaults to 0.

**Service (`service.ts`, re-exported through `api.ts`).**
- `saveInvoiceDraft`: create or update (when `id` is given) a `draft` invoice/quotation and replace its lines inside a transaction; recompute and store totals with `computeTotals`; defaults for `taxRateBp`, `terms` and delivery from `getSettings()` (`invoice` settings: tax only applies when `taxEnabled`); refuses to edit anything that is not a draft.
- `issueInvoice`: in one transaction `INSERT INTO invoice_counters (year, type, last) VALUES (…, 1) ON CONFLICT (year, type) DO UPDATE SET last = invoice_counters.last + 1 RETURNING last` (the upsert row-locks, so concurrent issues never repeat a number), then number `SFO-2026-0001` for invoices and `SFO-Q-2026-0001` for quotations (prefixes from settings, year from Asia/Colombo today, 4-digit padding done in code), set `issued` and `issuedAt`. Draft only; empty invoices (no lines) are refused.
- `recordPayment`: transaction; refuse on drafts, cancelled invoices and quotations; reject amounts ≤ 0 or above the balance; insert the payment, update `paidMinor`, status `partially_paid` or `paid`; return the new status and balance.
- `cancelInvoice` sets `cancelled` and `cancelledAt` (never deletes; refuses already-cancelled).
- `convertQuotationToInvoice`: copy an issued quotation into a new draft invoice (same customer, lines, discount, delivery, notes), set `convertedFromId`, return its id.
- `createInvoiceFromBooking(bookingId)`: draft invoice, `source: 'website'`, `bookingId` set, customer from the booking, one line per booking item (description = product name, colour name, quantity, `unitMinor` = the booking-time price snapshot or 0 when "on request"); idempotent: if a non-cancelled invoice already exists for the booking return it.
- `listInvoices` (filters, newest first, total count, `ILIKE` on number/customer name/phone), `getInvoice` (full view including payments, customer, booking reference), `revenueReport` (per month invoiced/paid split by source for issued non-cancelled invoices, plus the outstanding list). Date columns come back as `YYYY-MM-DD`/ISO strings, never `Date` objects.

**PDF.** `renderInvoicePdf(invoiceId)` with `@react-pdf/renderer` (`renderToBuffer`, A4): logo (`public/brand/logo.png`, read via `fs`), business name/address/WhatsApp from `settings.business`, bank details from `settings.invoice.bank` (skip empty ones), customer block, items table (description, colour, qty, unit, discount, line total), totals block, delivery date, warranty and terms from settings, two signature lines, "Rs. 1,250,000.00" money format (`formatLkr(minor, { decimals: true })`). Use built-in Helvetica (no font downloads). Route `GET /api/invoices/[id]/pdf/`: allowed with a valid share token (`?t=`, via `verifyShareToken`) or an admin session (`requireRole('any')` from `@/lib/auth/session`); responds `application/pdf` with `Content-Disposition: inline; filename="<number>.pdf"`; 404 for unknown/draft ids; `runtime` stays Node; `params` is a Promise.

**Share links (`share.ts`).** `createShareLink(invoiceId)` signs a 30-day token with `jose` (HS256, secret from `AUTH_SECRET`, falling back to `CRON_SECRET`; throw a clear error if neither is set); returns `/api/invoices/<id>/pdf/?t=<token>`. `verifyShareToken` checks signature, expiry and that the token's invoice id matches.

## Tests
`tests/unit/invoice-totals.test.ts`: line discounts, amount and percent discounts, clamping, tax rounding half up, delivery, advance and balance, never negative, example from the plan (Rs. 1,250,000.00 formatting is covered elsewhere). `tests/db/invoices.test.ts` on the seeded database (create a customer first): draft → issue gives `SFO-2026-0001` style numbers (year from Colombo); 20 concurrent `issueInvoice` calls on separate drafts yield 20 distinct consecutive numbers; quotations use their own series; payments move status and reject overpayment; cancelled invoices stay in the list; quotation → invoice conversion links back; `createInvoiceFromBooking` is idempotent (create the booking rows directly with inserts); share token round trip and tamper rejection.

## Don't
Edit any other file; use floats for money; delete invoices.
