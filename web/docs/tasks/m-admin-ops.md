# Task: m-admin-ops (products, invoices, settings, SEO, chat and knowledge admin on phones)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/admin/{products,invoices,settings,seo,chat,knowledge}/**`, `src/app/admin/(panel)/{products,categories,invoices,settings,seo,chat,knowledge}/**`. Another task owns the admin shell, dashboard, bookings, customers and visitors: do not touch them.

## Context
The owner edits products, writes invoices and answers chat handoffs from a phone. Typical jobs: add or fix a product with photos taken on the phone, price it, publish it, write an invoice at a customer's side and share it, read a chat handoff and reply, change opening hours. Every page and server action keeps its `requireRole()` check and its owner-only restrictions.

## Build
1. **Products.** The list is a card list on phones (photo thumbnail, name, status badge, price or "on request", checklist score) with search, a status filter and a 44 px "New product" button; the table stays from 1024 px up. The editor is a single column of collapsible sections (Basics, Photos, Colours, Details, SEO) with a **sticky Save bar** (`data-sticky-bar`) showing "Unsaved changes" / "Saved" and the Publish control; unsaved changes warn before leaving. The photo uploader accepts the phone camera and gallery (`accept="image/*"`, multiple), shows previews with upload progress and per-file errors (plain words), lets the owner reorder with up/down buttons (44 px) and choose the main photo, and never loses the other photos if one fails. The CSV import page is usable at 360 px (file button 44 px, the result summary as a list).
2. **Invoices.** The list as cards on phones; the builder: line items as stacked cards (description, quantity stepper, unit price, line total), "Add line" at 44 px, totals and the primary action in a sticky bottom bar (`data-sticky-bar`), customer picker with search; the detail page: share link, download PDF, record payment each as 44 px buttons; keep the print view untouched in layout (it is printed) and every currency formatted through `formatLkr`.
3. **Settings.** The tab list becomes a horizontally scrolling segmented control or a select on phones, forms single column with 16 px fields and visible labels, one sticky Save bar per tab with success/failure feedback, the slots editor usable by thumb (day chips, 44 px time inputs), the staff manager as cards with 44 px actions and a confirm step before disabling someone.
4. **SEO, chat and knowledge.** The SEO tabs scroll horizontally with the active tab in view, tables become cards or scroll inside their own container, charts fit the width. The chat inbox: conversation list then conversation view as two screens on phones (a back button at 44 px), messages readable at 16 px, the flag/answer actions 44 px, the playground input pinned above the keyboard. Knowledge: documents, FAQs, synonyms and gaps as card lists, dialogs/modals become full-screen sheets on phones with a close button and sticky actions, upload areas accept the phone's files.
5. **States and trust.** Loading skeletons, empty states with the next step, and plain-language errors on every page; destructive actions always ask first with a clear sentence; saved/failed feedback is a polite live region.
6. Fix every text under 12 px and every target under 44 px in your files.

## Tests
Keep `tests/e2e/admin.spec.ts`, `invoice.spec.ts` and every test touching your files valid (grep first; the e2e edits a product by searching `Search products`, opening the product link and changing `Name`). Keep desktop markup working at 1024 px and up. Add unit tests for new pure logic (for example the photo upload queue state, unsaved-change detection, the settings tab model).

## Don't
Touch `components/site/**`, `components/ui/**`, `globals.css`, the admin shell/dashboard/bookings/customers/visitors files, `lib/**` logic (read only), other agents' files, `package.json`. Weaken any `requireRole()` or owner-only check. Add dependencies. Add any decorative or warp effect. Change what a server action stores.
