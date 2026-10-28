# Task: m-landing (home page on phones: shorter, faster, correct)

Read `web/docs/MOBILE-UX.md` first (it overrides the "never edit" list in BUILD-GUIDE section 4 for the files below), then `web/docs/BUILD-GUIDE.md`.

## You own
`src/components/landing/**` (except `hero-ripple.tsx`, which you must not change), `src/app/(site)/page.tsx`. You may read `src/lib/motion/**` and `src/components/webgl/**` but not edit them.

## What a real phone audit found (390 px, production build)
- **Wrong numbers.** `factory-story.tsx` shows "0+ colours and designs" and "0-15 working days" on phones. `count-up.tsx` only counts when its `active` prop flips, and `active` only changes in the pinned desktop timeline; with stacked steps on phones it stays `0` for ever. The real values are 1000+ and 10-15. A visitor must never see a wrong number, with or without JavaScript, reduced motion or a fast scroll.
- **Too long.** The home page is about 12,700 px tall at 390 px (16 screens). The factory section alone is several screens of tall line-art cards, one under each step.
- **Hero.** Fine visually; check the two buttons are 44 px tall and the headline never touches the header.
- **Collections.** "See everything" is `hidden sm:inline-block`, so phones have no link to the whole shop from there. The rail should say it scrolls.
- **Colour explorer.** The 3D sofa uses `OrbitControls`: on a phone a vertical swipe on the canvas can rotate the sofa instead of scrolling the page. It is also heavy for mid-range Android.
- **Visit section.** `visit.tsx` renders a Google Maps `<iframe>` straight away: a blank white card until it loads, heavy on 4G, and a third-party request on every home view.

## Build
1. **Counters.** Render the final value as the server-rendered text. Animate only when the element enters the viewport and only when motion is allowed; never start from a state that can stay at zero (if the animation does not run, the final number is already there). On phones, where steps are stacked, count when the step scrolls into view. Keep the desktop pinned behaviour.
2. **Factory story on phones (under 768 px).** Replace the stack of tall cards with something compact: for example the four steps as a horizontal snap carousel of cards at most about 420 px tall (small line art 160 to 200 px tall above the text, step number, one fact), with a visible progress indicator and swipe, or a tight vertical list with the art beside each step. The whole section is at most about three screens tall. Desktop keeps its pinned scrub. No scroll-jacking on touch.
3. **Page rhythm on phones.** Target at most 8 screens for the whole page. Order for conversion: hero, featured pieces, collections ("Find your shape"), colour explorer, why people choose us (proof), factory story, visit and book. If reordering needs a different order in `page.tsx` do it, but keep the same data fetching and keep every section reachable.
4. **Collections rail.** Native scroll-snap swipe with the next card peeking, a thin progress bar or dots, "See everything" visible on phones. Cards link with 44 px+ hit areas. Desktop keeps the pinned horizontal scrub. The bend/hover warp is gone; do not bring anything like it back.
5. **Colour explorer.** On touch devices and on low-end devices (`navigator.hardwareConcurrency` of 4 or fewer, or `deviceMemory` of 4 or less when available) show the flat illustration with big (44 px) swatches instead of the WebGL scene; on capable fine-pointer devices keep the 3D scene. When the scene is shown on touch, the canvas must not capture vertical scroll (`touch-action: pan-y` on its wrapper; rotate only on horizontal drag). Swatches are keyboard operable and announce the selected colour. "Shop this colour" stays.
6. **Visit section.** Do not load the Google Maps iframe until the visitor taps "Show the map" on a static card (address, "Open in Maps" link, "Get directions"); then render the iframe in place at a fixed aspect ratio so nothing jumps. Reuse `src/components/pages/lazy-map.tsx` if its API fits (it is owned by another task: read it, do not edit it; copy the pattern if you need a variant).
7. **Marquee.** Pauses when reduced motion is on or the tab is hidden (already) and never overflows the page; the text is not tiny at 360 px.
8. **Hero.** CTAs at least 44 px tall and side by side or stacked cleanly at 320 px; the first screen shows the headline, the sub line and both buttons without the buttons dropping below the fold at 390x844.
9. Fix text under 12 px in your files.

## Tests
Add a unit test for any new pure logic (for example a `shouldUse3d` decision helper, or the counter's final-text formatting). Keep existing tests valid. The integrator runs tsc, eslint and vitest, and checks the page in a real browser.

## Don't
Edit `hero-ripple.tsx`, `src/components/webgl/**`, `src/lib/motion/**`, `components/site/**`, `globals.css`, other agents' files, `package.json`. Add dependencies. Add warp, skew, bend or ripple effects anywhere. Invent facts or change the copy's claims (keep the wording; the owner reviews it).
