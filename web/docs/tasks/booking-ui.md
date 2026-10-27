# Task: booking-ui (Book a Visit form, confirmation, spam protection, email)

Read `web/docs/BUILD-GUIDE.md` first. Spec source in `../Plan.md`: "Cart and Book a Visit" → "Book a Visit (/book-visit), the end of the cart" (steps 1–4 and the empty-cart note).

## You own
`src/app/(site)/book-visit/**` (page, `actions.ts`, `done/[ref]/page.tsx`), `src/components/booking/**`, `src/lib/turnstile.ts`, `src/lib/rate-limit.ts`, `src/lib/notify/email.ts`, `tests/unit/booking-form.test.ts`, `tests/db/rate-limit.test.ts`.

## Build
You consume the contract in `src/lib/bookings/api.ts` (`getAvailability`, `createBooking`, `getBookingByReference`, types); another agent implements it behind the same signatures, so code against the types and handle every `BookingResult` code.

**`/book-visit/`** (server shell + client form; `generateMetadata` noindex). The server component loads `getAvailability()` (catch errors → show a friendly "We could not load visit times, please message us on WhatsApp" state), settings (`getSettings()`: business, WhatsApp) and the Turnstile site key (`env.TURNSTILE_SITE_KEY`), and passes plain props down. Client form with React Hook Form + Zod (`@hookform/resolvers`):
1. **Review**: the cart lines from `useCart()` (thumbnail, name, colour, quantity, remove/edit), with a clear note that the visit works with an empty cart too ("Not sure yet? Book without picking a piece").
2. **Details**: full name; phone (validated with `normaliseLkPhone`) with a "Same number on WhatsApp" toggle (default on); email optional; city/district; **date** chosen from a calendar of the next days that only enables `open` days; **time slot** list for the chosen date showing remaining places and disabling full slots (`remaining === 0`); notes; preferred contact method (WhatsApp, call, email); a required consent checkbox linking to `/privacy/`; Turnstile widget (load `https://challenges.cloudflare.com/turnstile/v0/api.js` lazily when the form scrolls near; render explicitly; expose the token in a hidden field; if the script cannot load, show a retry message instead of hanging).
3. **Submit** with a server action `submitBooking(previous, formData)` in `actions.ts`: validate with the same Zod schema (put it in `src/components/booking/schema.ts` and share it), verify Turnstile (`src/lib/turnstile.ts`: POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret; skip verification only when `TURNSTILE_SECRET_KEY` is unset **and** `DATABASE_URL` is unset (local mode)), rate-limit (`src/lib/rate-limit.ts`: generic `isRateLimited({ key, limit, windowMs })` that counts recent rows; for bookings count recent bookings by `visitorId` and by phone: at most 5 per hour; implement the counting with a small query over `bookings`, no new table), then call `createBooking`. On `ok` → `redirect('/book-visit/done/<reference>/')`; on `slot_full` return an error that asks the visitor to pick another slot and includes refreshed availability; other codes map to clear field or form errors. Never show raw error text.
4. On success the owner is told by email via `sendOwnerBookingEmail(summary)` in `src/lib/notify/email.ts` (Resend SDK; only when `hasEmail()` from `@/lib/env`; run inside `after()`; **never throws**, logs and returns). The bell notification is created inside `createBooking`.

**Confirmation `/book-visit/done/[ref]/`** (`params` is a Promise; noindex): `getBookingByReference`; unknown reference → `notFound()`. Show the reference prominently, date and slot, chosen pieces, "Add to calendar" (`/api/bookings/<ref>/ics/`), "Get directions" (`mapsDirectionsUrl` from `@/lib/settings/get`), a WhatsApp button to the showroom with the reference prefilled (`whatsappLink`), and "What happens next". A small client component clears the cart once (`useCart().clear()`) and fires `trackEvent('booking_submit')`; the form fires `trackEvent('booking_start')` on mount.

Accessibility: every field has a label and an `aria-describedby` error; errors are announced; the date and slot pickers are keyboard operable (arrow keys / roving tabindex) with visible selection; the form is usable at 360px.

## Tests
`tests/unit/booking-form.test.ts` (schema: phone formats, required consent, date format, items), Turnstile verification with a mocked `fetch` (success, failure, network error, skipped locally), the email helper is a no-op without Resend config and never throws. `tests/db/rate-limit.test.ts`: counts within and outside the window (insert bookings with explicit timestamps).

## Don't
Implement booking logic (that is `createBooking`); add dependencies; leak the Turnstile secret to the client.
