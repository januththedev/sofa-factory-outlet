# Task: booking-core (Codex)

Read `web/docs/BUILD-GUIDE.md` first. Spec sources in `../Plan.md`: "Cart and Book a Visit" (Book a Visit steps 2–4), "Admin panel → The Bookings section", "Data model" (bookings, booking_items, booking_slots).

**Environment note:** you can write files but cannot run Node, tsc, eslint or tests here (the sandbox cannot see the Node install). Write carefully; the integrator runs every check afterwards. Do not run any git command that writes.

## You own
`src/lib/bookings/**` (replace `api.ts`, same exports and types; add helpers), `src/app/api/bookings/[ref]/ics/route.ts`, `tests/db/bookings.test.ts`, `tests/unit/bookings-rules.test.ts`.

## Build
Schema: `src/lib/db/schema/{bookings,people,admin}.ts`; `booking_ref_seq` is a real Postgres sequence; settings: `getSettings()` from `@/lib/settings/get` (`booking.leadDays/horizonDays`, `hours.closedDates/days/confirmed`, `business`). Helpers already present: `normaliseLkPhone`, `isLkMobile` (`@/lib/phone`), `notify` (`@/lib/notify/bell`), `pictureData`, `getDb`, `s` schema.

**`getAvailability({ from?, days? })`.** Dates in Asia/Colombo (`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' })`). For each date from `from` (default today) for `days` (default `booking.horizonDays`): `open` is false when the weekday has no active slot, the date is in `hours.closedDates`, the date is earlier than today + `leadDays`, or `hours.confirmed` is true and that weekday's hours are null. Slots come from `booking_slots` where `weekday` matches (0 = Sunday); `booked` counts bookings for that date+slot whose status is not `cancelled` or `lost`; `remaining = capacity − booked` (min 0). Label "10:00–12:00".

**`createBooking(input)`.** Validate the whole input with Zod first (`BookingInput` in `api.ts`): name 2–80 chars, phone passes `normaliseLkPhone`, optional email shape, date `YYYY-MM-DD`, `consent: true`, items 0–20 with quantity 1–20. Return `{ ok: false, code: 'invalid', fieldErrors }` rather than throwing. Then in **one transaction**: (1) `SELECT … FROM booking_slots WHERE id = $1 FOR UPDATE` (row lock); reject `slot_closed` when the slot is inactive, its weekday does not match the date, the date is closed or outside lead-time/horizon; (2) count active bookings for that date+slot and reject `slot_full` at capacity; (3) upsert the customer by normalised phone (update name, email, city; set `whatsapp` to the phone when `whatsappSame` and it is a mobile number); (4) read each item's product and variant from the database (never trust client-supplied names or prices): snapshot `productName`, `productSlug`, `colourName`, `hex`, first image, `priceMinor`; use the default variant when `variantId` is missing; ignore unknown or unpublished products; (5) take the number with `SELECT nextval('booking_ref_seq')` and format `SFO-B-` + number padded to 4 digits (do the padding in code); (6) insert the booking (`slotLabel`, `preferredContact`, `consentAt`, meta fields) and items; (7) insert a bell notification inside the transaction with `createNotification(…, tx)`: type `booking`, title "New booking SFO-B-0042", body with name, date and slot, link `/admin/bookings/<id>/`. Return `{ ok: true, reference, bookingId }`. Unexpected errors return `{ ok: false, code: 'unknown' }` and are logged.

**`getBookingByReference(ref)`** returns `BookingSummary` (items with `pictureData`) or null. Case-insensitive on the reference.

**`ics.ts`.** `buildIcs(summary, business)` returns a valid iCalendar string (CRLF line endings, folded lines at 75 octets, escaped text, `DTSTART;TZID=Asia/Colombo` from the slot start/end, `UID` from the reference, `SUMMARY` "Showroom visit: Sofa Factory Outlet", `LOCATION` from the business address, a short `DESCRIPTION` listing the reference and chosen pieces). Route `GET /api/bookings/[ref]/ics/` serves it as `text/calendar` with a download filename, 404 when unknown (`params` is a Promise; `force-dynamic`).

**`whatsapp.ts`.** `bookingWhatsappLink(summary, whatsappNumber)` prefilled "Hi, I booked a showroom visit (SFO-B-0042) for …" via `whatsappLink` from `@/lib/settings/get`.

**`rules.ts`.** Pure date/slot rule helpers used by both functions (Colombo "today", weekday from a `YYYY-MM-DD`, within horizon, lead time) so they can be unit-tested without a database.

## Tests
`tests/unit/bookings-rules.test.ts`: Colombo dates across midnight UTC, weekday maths, lead time and horizon edges, ICS escaping/folding/CRLF. `tests/db/bookings.test.ts` on the seeded database (24 placeholder slots, capacity 3): availability shape; a valid booking returns a `SFO-B-` reference and creates customer, booking, items and a notification; a second booking by the same phone reuses the customer; ten simultaneous `createBooking` calls for one capacity-3 slot give exactly 3 `ok` and 7 `slot_full`; closed weekday (Sunday) → `slot_closed`; weekday/slot mismatch → `slot_closed`; invalid phone → `invalid` with a field error; unpublished product ignored; references increase.

## Don't
Edit any other file; trust client-supplied prices or names; throw for expected failures.
