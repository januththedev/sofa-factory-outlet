# Task: m-booking-cart (cart, Book a Visit and confirmation on phones)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/booking/**`, `src/components/cart/**`, `src/app/(site)/book-visit/**`, `src/app/(site)/cart/**`.

## Context
Booking is the site's conversion: a visitor picks pieces (optional), a day and a time slot, enters name and phone, agrees to the privacy notice, and gets a reference like `SFO-B-1234`. Turnstile has been removed on purpose (spam is handled by validation, rate limits and capacity checks on the server): do not add any captcha or third-party widget. The server action in `book-visit/actions.ts` and `components/booking/schema.ts` define the contract; keep their exported names and validation rules.

## What a real phone audit found (390 px, production build)
- `/book-visit/` has 49 targets under 40 px (calendar day cells, radios, chips). The page is about 3,700 px tall: usable, but the date picker is a month grid that is fiddly with a thumb, and a slot is only visible after choosing a date.
- The cart drawer and `/cart/` are fine when empty, but with items each line, the quantity stepper and "Change colour" need 44 px targets and a layout that survives 320 px.
- Nothing remembers a half-filled form if the visitor leaves for WhatsApp and comes back.

## Build
1. **Date and slot, phones.** Replace the month grid with a horizontally scrollable row of the next 14 open days (each a 56 x 64 px chip: weekday, date, "Full" or places left) plus a "Pick another date" control that opens the full calendar. A one-tap **Earliest available** chip selects the first open day and its first free slot. Slots are a two-column grid of buttons at least 48 px tall showing the time and "N places left"; full slots are disabled with the reason in text. A summary line under the pickers ("Saturday 2 November, 10:00 to 12:00") stays visible and is announced politely when it changes. Closed and full days are explained in text (not colour only). Keep the desktop calendar.
2. **Form.** `autocomplete="name"`, `autocomplete="tel"` with `inputmode="tel"` and a hint ("077 123 4567"), `autocomplete="email"` with `inputmode="email"`, `enterkeyhint="next"` and `"done"` on the last field, all fields 16 px or larger. Validate on blur and on submit with the existing Zod schema (reuse it, do not duplicate rules); an error summary at the top links to each field and receives focus on a failed submit; the first invalid field scrolls into view above the sticky bar. Contact preference chips 44 px tall, WhatsApp first.
3. **Submit.** A sticky bottom bar (`data-sticky-bar`, safe-area padding) with "Book my visit", disabled with a spinner label ("Booking...") while pending and guarded against double taps; if the request fails (network, rate limit, capacity taken meanwhile) show a plain message with a Try again button and keep everything typed; if the chosen slot filled up, say so and bring the picker back with the next free option selected.
4. **Draft.** Save the form (not the consent checkbox) to `sessionStorage` as the visitor types (debounced), restore it on return, clear it after a successful booking. Wrap every storage call in try/catch (private mode).
5. **Confirmation page.** A large reference with a copy button, a three-line "what happens next" (we confirm by WhatsApp or phone; the visit is by appointment; prices are confirmed at the showroom), **Add to calendar** (the existing `.ics` link, `/api/bookings/<ref>/ics/`), **Get directions** (only from confirmed settings), **Message us on WhatsApp** (only if a number is confirmed), **Back to the shop**. `confirmation-effects.tsx` respects reduced motion and never delays reading.
6. **Cart drawer and `/cart/`, phones.** The drawer is a bottom sheet with a drag-free handle area, close button (44 px), line items that hold up at 320 px (photo 72 px, name two lines, colour, quantity stepper with 44 px buttons, remove button with a clear label), an "Undo" notice for 5 seconds after removing, a sticky "Book a visit" button (`data-sticky-bar` on `/cart/`), and the suggestions rail as a two-column snap rail. Empty state stays, with the two actions at 44 px.
7. Fix text under 12 px in your files.

## Tests
Keep `tests/unit/booking-submit.test.ts`, `booking-form.test.ts` (if present), `cart-store.test.ts`, `tests/e2e/booking.spec.ts`, `invoice.spec.ts`, `admin.spec.ts` valid: the e2e helpers (`tests/e2e/helpers.ts`) use `getByLabel('Full name')`, `getByLabel('Phone number')`, the calendar `grid` with day `button`s, slot `radio`s clicked through their label, `I agree that`, `Book my visit`. Keep those names working on desktop (if the phone layout uses different markup, render the desktop markup at 1024 px and up). Add unit tests for new pure logic (draft save/restore with a fake storage, earliest-available selection, next-14-days list).

## Don't
Touch `components/site/**`, `components/ui/**`, `globals.css`, `lib/bookings/**` logic (read only), the server action's contract, other agents' files, `package.json`. Add dependencies, a captcha or any third-party script. Add any warp or distortion effect.
