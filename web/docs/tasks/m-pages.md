# Task: m-pages (About, Factory, Visit, Trade, Guides, Privacy and the review form on phones)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/pages/**`, `src/components/reviews/**`, `src/app/(site)/about-us/**`, `src/app/(site)/factory/**`, `src/app/(site)/visit/**`, `src/app/(site)/trade/**`, `src/app/(site)/guides/**`, `src/app/(site)/privacy/**`, `src/app/(site)/review/**`.

## What a real phone audit found (390 px, production build)
- These pages have no horizontal overflow, but each has 14 to 15 targets under 40 px (links in the page header, CTA blocks, breadcrumb, footer-like link rows) and 5 to 7 pieces of text under 12 px.
- `/visit/` is the page people open on the way to the showroom: the address, hours, the map and "get directions" need to be the first thing, and a map that loads only after a tap (see below).
- The long pages (`/about-us/` about 5,400 px, `/factory/` about 6,000 px at 390 px) are walls of text with big headings; the privacy page is a single long column with no way to jump.

## Build
1. **`/visit/` first.** On phones the first screen shows the showroom name, address, opening hours (from settings; if unconfirmed, say they are confirmed when booking), and three big buttons: **Get directions**, **Call** (only if a phone number is confirmed in settings), **Book a visit**. Below that the map: a static card with "Show the map" (tap loads the iframe at a fixed aspect ratio) and an "Open in Maps" link. Never load Google Maps before a tap. Reuse and improve `components/pages/lazy-map.tsx`: it is yours. Keep the section anchors other pages link to.
2. **Page header and CTA blocks** (`page-header.tsx`, `cta-section.tsx`, `note.tsx`): comfortable spacing at 320 to 430 px, headings that do not overflow (use `text-balance`, `break-words`, sensible clamp sizes), CTA buttons at least 44 px tall, stacked full-width on phones. Body copy 16 px with generous line height.
3. **Long pages.** About and Factory: shorter vertical rhythm on phones (section spacing about half of desktop), images sized for phones with `sizes`, no blank screens. Privacy: a collapsible "On this page" list at the top (anchors to each heading, 44 px rows) and `scroll-margin-top` so anchors do not hide under the header.
4. **Guides.** The index: cards in one column on phones with readable titles and a visible reading time; the article page: comfortable measure (16 to 18 px text, about 65 characters per line), a collapsible table of contents, images that never overflow, tables and code in a horizontally scrollable wrapper, "Related guides" at the end, and the Book a visit/ask CTA at the end of the article. `guide-meta.tsx` text is at least 12 px.
5. **Trade page.** The primary action (contact us about trade orders) is one tap from the first screen: WhatsApp (only if a number is confirmed in settings) and Book a visit. If the page has a form, apply the form rules in `MOBILE-UX.md` (16 px fields, `autocomplete`, `inputmode`, inline errors).
6. **Public review form (`/review/[token]/`, `components/reviews/**`).** Star rating as five 48 px buttons in a `radiogroup` with a visible label for the chosen value ("4 out of 5"), keyboard operable; the textarea shows a live character counter (10 to 2000) and 16 px text; submit button full width and pending-aware; a warm thank-you state; a clear message for an expired or used link with a way to contact the showroom. The page stays `noindex` and keeps its referrer policy.
7. Fix every text under 12 px and every interactive element under 44 px in your files.

## Tests
Keep `tests/e2e/mobile.spec.ts`, `a11y.spec.ts`, `tests/unit/guides.test.ts` and any test that touches your files valid (grep first). Add unit tests only for new pure logic (for example reading time, table-of-contents building).

## Don't
Touch `components/site/**`, `components/ui/**`, `globals.css`, `components/landing/**`, `lib/**` logic (read only), other agents' files, `package.json`. Add dependencies. Invent business facts (hours, phone, delivery terms, warranty, awards): use the settings or say "confirmed at your visit". Add any warp or distortion effect.
