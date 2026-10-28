# Mobile and everyday UX rules

Read this with your task. It applies to everything you touch. The task file overrides `BUILD-GUIDE.md` section 4 for the files in its "You own" list (you may edit shared files there, nothing else).

**Who uses this site.** Sri Lankan visitors on mid-range Android phones (320 to 412 px wide), often on 4G and in the sun, who mostly want to see a sofa, ask a question on WhatsApp and book a showroom visit. The owner and staff run the admin panel from a phone as well. The experience matters, not just the looks: it has to be fast, obvious, forgiving and kind to thumbs.

**How it is checked.** After you finish, the integrator loads every page at 360x740, 390x844 and 768x1024 in a real browser and reports: horizontal page overflow, interactive elements under 40 px, text under 12 px, broken images, console errors. Then a person uses the site. You cannot run a browser: write mobile-first Tailwind and reason about 360 px carefully.

## Rules

1. **Touch.** Every button, link-as-button, icon button, checkbox, radio and chip has a hit area of at least 44 x 44 CSS px (`min-h-11 min-w-11`, or padding that reaches it; a small visual with a bigger hit area is fine). Neighbouring targets are 8 px or more apart. Links inside running text are exempt. Nothing works only on hover: whatever hover reveals must also work by tap and keyboard focus.
2. **Type.** Body text is 16 px on phones. Nothing is under 12 px (captions 12 px at the smallest). `input`, `select` and `textarea` are at least 16 px, otherwise iOS zooms the page on focus. Keep lines under about 65 characters.
3. **Layout.** Mobile-first. No horizontal page scroll from 320 to 1024 px. Wide things (tables, rails) scroll inside their own container and show that they do (peeking next card, edge fade). Full-height means `dvh` or `svh`, not `vh`. Anything fixed to the bottom or top respects `env(safe-area-inset-*)`. A fixed header is at most 64 px tall.
4. **Thumb zone.** The main action of a screen is reachable at the bottom: a sticky bar on the product page (Add to cart), the shop (Filters), the booking form (Book my visit) and the cart (Book a visit). **Every sticky bottom bar carries the attribute `data-sticky-bar`**, has `pb-[max(0.75rem,env(safe-area-inset-bottom))]`, and the page leaves matching bottom padding so it never covers content. The chat launcher moves up above any `[data-sticky-bar]` (the chrome task implements that); you only add the attribute.
5. **Feedback and states.** Every action that takes time shows a pending state within 100 ms (disabled button, changed label) and cannot be double-submitted. Success is confirmed in plain words (inline or a polite live region), failure says what happened and how to try again, and neither wipes what the user typed. Empty states say what to do next. Loading reserves the final space (skeleton or fixed aspect ratio) so nothing jumps. Forms: labels always visible, `autocomplete`, `inputmode`, `enterkeyhint` set, validate on blur and on submit, an error summary that links to the fields, focus moves to the first problem, the on-screen keyboard never hides the field being typed in.
6. **Motion.** `prefers-reduced-motion` is respected. **No effect that bends, warps, skews or ripples imagery anywhere except the hero's existing ripple.** That is the owner's decision: do not add any, and do not add hover-only WebGL. No scroll-jacking or pinned scrubbed sections on touch devices (native scrolling, native momentum). UI feedback animations take 300 ms or less.
7. **Weight.** Phones on 4G: nothing heavy above the fold, third-party embeds (maps) load only after a tap, images use `sizes`, no layout shift.
8. **Words.** Short, plain, warm, Sri Lankan/British spelling. Never invent facts (hours, delivery terms, warranty, prices, phone numbers): use settings or say "confirmed at your visit".
9. **Don't break what exists.** Keep accessible names that tests use (`tests/e2e/**` and `tests/unit/**` find buttons and links by role and name): grep the tests for a string before you change it, and update the test in the same change if you must. Keep `TLink`/`Link` for internal links (never a raw `<a href="/...">`). No new dependencies. Lines under 120 characters, one statement per line. Do not touch the hero ripple (`hero-ripple.tsx`, `webgl/`).

## Per-viewport sanity list (check each of your screens mentally)

- 320 px: nothing clipped, nothing overlapping, one-line labels do not wrap into the next control.
- 360 px: the primary action is visible without scrolling on short forms, two-column grids still have readable cards.
- 390 to 430 px: comfortable; the sticky bar and the chat launcher do not collide.
- 768 px: tablet portrait uses the extra room (two or three columns) rather than stretching phone layouts.
- With a software keyboard open: the focused field and its error stay visible.
