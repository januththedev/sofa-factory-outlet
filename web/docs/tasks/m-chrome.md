# Task: m-chrome (header, footer, chat, shared UI, global CSS: phones first)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/site/**` (header, footer, footer-wordmark, magnetic, cursor, preloader, smooth-scroll, transition), `src/components/chat/**`, `src/components/ui/**`, `src/components/catalogue/breadcrumbs.tsx`, `src/app/globals.css`, `src/app/(site)/layout.tsx`. You are the only task that may edit `globals.css` and `components/ui/**`; the other mobile tasks rely on the rules you add there.

## What a real phone audit found (390 px, production build)
- The header is crammed: the "Book a visit" pill wraps onto two lines and overlaps the wordmark ("SOFA FACTORY OUT LET"); the logo link is 36 px tall, the menu button 36 px wide. On `/shop/` the page eyebrow slides under the header.
- The footer wordmark ("SOFA FACTORY OUTLET", 19 letters with `justify-between` on one line) is stretched and letters touch each other on phones.
- 30 to 50 targets per page are under 40 px (breadcrumb links 20 to 24 px tall, footer links, chips).
- Several texts are under 12 px.
- Navigation feels slow: `transition.tsx` plays a 0.55 s maroon curtain before every route change, `smooth-scroll.tsx` (Lenis) takes over scrolling, and the first visit plays a counter preloader. On a phone on 4G that is seconds of nothing.

## Build
1. **Header (320 to 430 px).** One tidy row at most 64 px tall: logo (mark plus wordmark that never clips; mark only if the room runs out), cart button, menu button, each hit area 44 x 44. "Book a visit" never wraps (`whitespace-nowrap`; below about 400 px show a shorter label such as "Book" or move it into the menu and a visible button inside the open menu). Nothing overlaps at 320 px. The open menu is a full-height `dvh` sheet: links at least 56 px tall, Book a visit and (if the settings give a confirmed WhatsApp number) WhatsApp as large buttons at the bottom, focus trapped inside, Escape and a backdrop tap close it, it closes on route change, page scroll is locked while open, and focus returns to the menu button.
2. **Footer.** The wordmark wraps to two big lines on phones ("SOFA FACTORY" over "OUTLET", left aligned, no `justify-between` stretching, no clipped letters; keep the letter-rise on desktop and respect reduced motion). Footer links are 44 px tall rows in two columns. Address, phone and WhatsApp are tap-to-open (`tel:`, wa.me) only when the settings say they are confirmed (look at how the footer already reads them).
3. **Navigation feel.** `transition.tsx`: skip the curtain on touch devices and narrow screens (`(pointer: coarse)` or under 768 px wide) and on reduced motion: navigate immediately; keep it for desktop. `smooth-scroll.tsx`: do not hijack scrolling on touch devices (native momentum scroll); keep Lenis for fine pointers. `preloader.tsx`: no preloader on phones/touch and none on returning visits (as now); on desktop first visits it must still never block interaction for more than about two seconds.
4. **Chat launcher and panel.** Launcher 56 px, bottom-right with safe-area insets. It sits above any element with `data-sticky-bar` (use a CSS rule such as `body:has([data-sticky-bar]) .chat-launcher { bottom: calc(5.5rem + env(safe-area-inset-bottom)) }` in `globals.css` and a class on the launcher). On phones an open chat is a full-height `dvh` sheet: header with title and a 44 px close button, scrolling message list, input row pinned above the on-screen keyboard (use `window.visualViewport` resize to lift it, input font 16 px), quick-reply chips that scroll horizontally and are at least 40 px tall, product cards in messages tappable and not cramped at 320 px. Escape closes it, focus returns to the launcher, new messages are announced politely. Keep every accessible name that `tests/e2e/chat.spec.ts` uses.
5. **`globals.css`.** Add and document: `touch-action: manipulation` on interactive elements (no 300 ms tap delay); on screens under 768 px every `input`, `select`, `textarea` is at least 16 px; `scroll-padding-top` matching the sticky header; a small convention block for `[data-sticky-bar]` (the launcher rule above, plus a CSS variable or class others can use for bottom padding); `-webkit-text-size-adjust: 100%`; `overscroll-behavior` that does not trap scrolling. No new fonts, no new effects, nothing that warps or distorts imagery.
6. **`components/ui/**`.** `Button`, `Field` and form controls reach 44 px height on phones (`min-h-11`), `Field` shows the error text with `aria-describedby` and a visible icon or label (not colour alone), `Table` gets a horizontally scrollable wrapper with an edge fade so wide tables never widen the page.
7. **Breadcrumbs.** Each link has a 44 px tall hit area on phones (padding with a compensating negative margin), the list scrolls horizontally with the current page last and in view, `aria-current="page"` on the last item, no wrapping onto a second line at 360 px.
8. Fix every text under 12 px you find in the files you own (use `text-xs` or larger).

## Tests
Keep `tests/unit` and `tests/e2e` expectations that touch your files valid (read them first). Add a unit test only for new pure logic (for example a helper that decides whether to skip the curtain). The integrator runs tsc, eslint and vitest.

## Don't
Touch `components/landing/**`, `components/webgl/**`, `hero-ripple.tsx`, the hero ripple behaviour, other agents' files, `package.json`, `next.config.ts`, `src/app/layout.tsx`. Add dependencies. Add any warp, skew, bend or ripple effect.
