# Task: m-admin-core (admin shell, login, dashboard, bookings, customers, visitors on phones)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/admin/{shell,sidebar,topbar,user-menu,bell,page-header}.tsx`, `src/components/admin/{dashboard,bookings,customers,visitors}/**`, `src/app/admin/layout.tsx`, `src/app/admin/login/**`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/page.tsx`, `src/app/admin/(panel)/{bookings,customers,visitors}/**`.

## Context
The owner and staff run the business from a phone: they open the admin to see who is coming, call or WhatsApp a visitor, change a booking's status, and check how the site is doing. They do it standing in a showroom, one-handed. The admin is not public and has no flashy effects: it has to be quick and clear. Every page and server action keeps its `requireRole()` check.

## Problems to fix
- The shell is built for a desktop sidebar: on phones it needs an off-canvas navigation, a compact top bar and no horizontal scroll at 320 px.
- Bookings and customers lists are tables: on phones they must become card lists with the useful actions on each card.
- Detail pages are long forms: the actions (status, call, WhatsApp, notes) must be reachable without scrolling.
- Calendar day/week views are grids that do not fit a phone.
- Inputs on the login page and filters must be 16 px or larger and have the right `autocomplete`/`inputmode`.

## Build
1. **Shell.** Under 1024 px: a top bar of at most 56 px with a 44 px menu button, the page title, the notification bell and the user menu; the sidebar becomes an off-canvas drawer (backdrop, focus trap, Escape and backdrop close, closes on navigation, body scroll lock, 56 px tall nav rows with icons and the unread count). From 1024 px up the current sidebar stays. The page header (`page-header.tsx`) wraps long titles and puts its action buttons in a full-width row on phones.
2. **Login.** Centered card at any width, 16 px fields, `autocomplete="username"` / `"current-password"`, a show/hide password button (44 px), a pending state, a plain error message that keeps the typed email, Enter submits, no layout jump when the error appears.
3. **Dashboard.** KPI tiles two per row on phones, the first tile (today's visits / new bookings) first; "Upcoming visits" as cards each with the customer name, time, pieces count and **Call** and **WhatsApp** buttons (use `tel:` and the existing wa.me helper from settings); charts fill the width, axis labels at least 12 px, and each chart keeps its text alternative; the setup checklist card is collapsible on phones.
4. **Bookings list.** Card list on phones (reference, name, visit date and slot, status badge, product thumbnails and count, source), filters in a collapsible panel with a count of active filters, search at the top with a 44 px clear button, pagination with 44 px targets, the "Export CSV" action in an overflow menu. Keep the table on 1024 px and up. Each card has a 44 px **Call** and **WhatsApp** action and a one-tap status change (the existing allowed transitions only).
5. **Booking detail.** Single column on phones; a sticky bar (`data-sticky-bar`) with the primary status action, Call and WhatsApp; the customer block, products, visit block, notes, convert-to-invoice and print each in their own card; the notes editor saves with visible feedback ("Saved").
6. **Calendar.** On phones a day list (agenda): each slot with how full it is and its bookings underneath, previous/next day buttons at 44 px, "Today"; week grid only from 768 px up.
7. **Customers.** Card list on phones with phone tap-to-call, last activity and counts; the detail page single column with a sticky Save.
8. **Visitors.** Charts responsive, summary tiles two per row, the live count readable, tables become cards or scroll inside their own container.
9. **States.** Loading skeletons for the list pages, empty states that say what to do, error messages in plain words. Fix every text under 12 px and every target under 44 px in your files.

## Tests
Keep `tests/e2e/admin.spec.ts` and every test touching your files valid (grep first: the e2e uses `Email`, `Password`, `Sign in`, `/admin/bookings/`, the booking reference link). Keep desktop markup working at 1024 px and up. Add unit tests for new pure logic (for example building the card model from a booking row, the active-filter count).

## Don't
Touch `components/site/**`, `components/ui/**`, `globals.css`, `components/admin/{products,invoices,settings,seo,chat,knowledge}/**` (another task), `lib/**` logic (read only), other agents' files, `package.json`. Weaken any `requireRole()` check. Add dependencies. Add any decorative or warp effect.
