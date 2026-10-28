# Task: e2e-specs (Playwright specs for the main flows)

Read `web/docs/BUILD-GUIDE.md` and `web/playwright.config.ts` first. You cannot run Playwright here. Write the specs carefully from the real pages (read the components for labels, roles and names); the integrator runs them later with `npm run test:e2e` (own production build, port 3100, database `.data/pglite-e2e`, owner account from `scripts/e2e-server.mjs`).

## You own
`tests/e2e/**` only. The existing smoke spec stays. Shared helpers go in `tests/e2e/helpers.ts`.

## Specs (one file each; every test independent of the others except for the documented seed data)
- `shop.spec.ts`: `/shop/` lists the 15 published products; a colour filter and a shape filter change the URL and the count; pagination keeps the filters; a misspelt search word still finds a product; hidden products never appear.
- `product.spec.ts`: the product page shows a gallery; a colour swap changes the main image; "Add to cart" updates the cart button count; "Ask about this sofa" opens the chat.
- `booking.spec.ts`: add a product, open the cart, go to Book a visit, fill the form with a Sri Lankan phone number, submit, land on the confirmation with a reference matching `SFO-B-\d{4,}`; the `.ics` link returns `text/calendar`; once a slot is at capacity it renders disabled (fill it by submitting bookings in a loop).
- `admin.spec.ts`: log in with the e2e owner account; see the booking created by the booking spec; change its status; the notification bell shows a badge; edit a product title and see it on `/shop/` after revalidation; after logging out `/admin/` redirects to the login page.
- `chat.spec.ts`: open the widget, ask about delivery times and get the hedged FAQ answer (no model key in e2e); ask for a sofa and get product cards; "talk to a person" shows the WhatsApp button.
- `seo.spec.ts`: `/sitemap.xml` lists the sitemap files; `/robots.txt` allows crawling and names the sitemap; a hidden product URL 301s to its category hub; a product page carries Product JSON-LD without `offers` when there is no price; `/llms.txt` answers 200.
- `invoice.spec.ts`: convert a booking to an invoice in admin, open `/api/invoices/<id>/pdf/`, expect 200 and `application/pdf`.
- `a11y.spec.ts`: `@axe-core/playwright` on `/`, `/shop/`, a product page, `/book-visit/` and `/cart/`: no serious or critical violations.
- `mobile.spec.ts`: at 360 px wide the landing page and `/shop/` have no horizontal scroll and the header menu opens.

## Rules
Use roles and labels, not CSS classes. No fixed sleeps: web-first assertions only. Where you cannot find a selector in the code, mark that test `test.fixme` with a one-line reason instead of guessing. The gate checks tsc and eslint on your files.
