# Task: m-admin-core-2 (finish the admin core on phones: login, dashboard, bookings, customers, visitors)

This continues `web/docs/tasks/m-admin-core.md`: read that spec in full, plus `web/docs/MOBILE-UX.md` (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files you own) and `web/docs/BUILD-GUIDE.md`.

## Already done and merged: do not redo
The admin **shell** is finished: `components/admin/{shell,sidebar,topbar,user-menu,bell,page-header}.tsx` now give an off-canvas navigation drawer under 1024 px, a compact top bar and a wrapping page header. Read them to see the conventions (and keep them working), but do not rewrite them.

## You own (same as m-admin-core, minus the shell files)
`src/components/admin/{dashboard,bookings,customers,visitors}/**`, `src/app/admin/layout.tsx`, `src/app/admin/login/**`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/page.tsx`, `src/app/admin/(panel)/{bookings,customers,visitors}/**`.

## Build (items 2 to 9 of m-admin-core.md, all still open)
Login, dashboard (with Call and WhatsApp on upcoming visits), bookings list as cards with a collapsible filter panel, booking detail with a sticky action bar (`data-sticky-bar`), the day-list calendar for phones, customers as cards, visitors charts and tables for phones, and loading/empty/error states.

Also fix while you are in `components/admin/visitors/**`: the funnel says "-1 (100% drop-off)" when a step has fewer people than the next one counts. A drop-off is never negative: show "1 left before this step (100%)" or similar plain wording, and never a minus sign. The funnel step maths lives in `src/lib/analytics/queries.ts`, which you may read but not change: do the fix when formatting the text.

## Tests
Same as m-admin-core.md: keep `tests/e2e/admin.spec.ts` and every test touching your files valid, keep desktop markup at 1024 px and up, add unit tests for new pure logic (the booking card model, the active-filter count, the funnel wording).

## Don't
Touch the shell files listed above (read only), `components/site/**`, `components/ui/**`, `globals.css`, `components/admin/{products,invoices,settings,seo,chat,knowledge}/**` (another task), `lib/**` logic, other agents' files, `package.json`. Weaken any `requireRole()` check. Add dependencies or decorative effects.
