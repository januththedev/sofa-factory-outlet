# Task: chat-widget (public chat UI)

Read `web/docs/BUILD-GUIDE.md` first. Spec source in `../Plan.md`: "Chatbot → In the interface" and the product-page/cart integrations ("Ask about this sofa", the cart nudge, "Talk to a person").

## You own
`src/components/chat/**`, `src/lib/chat/client.ts` (browser helpers only: NDJSON stream reader and session ids), `tests/unit/chat-client.test.ts`.

## Build
The widget talks to `POST /api/chat/` (implemented by chat-pipeline) and consumes its NDJSON stream of `ChatEvent` (types in `src/lib/chat/api.ts`; import types only, never the server functions). It loads lazily: export `ChatWidget` from `src/components/chat/chat-widget.tsx` as a tiny client component that renders only a floating button and loads the panel code with `next/dynamic` when first opened (the integrator mounts `ChatWidget` in the site layout).
- **Floating button** bottom-right (above the sticky mobile bar on product pages: `bottom` offset 5.5rem on small screens, 1.5rem on large), maroon, with an accessible label and a subtle pulse that respects reduced motion; it hides while the mobile menu or cart drawer is open (listen for `aria-expanded`/`document.documentElement` data attributes is not available, so simply keep a high enough z-index below the drawer's and ignore this edge).
- **Panel**: branded header (logo mark, "Sofa Factory Outlet assistant", close), message list (`role="log"`, `aria-live="polite"`), streaming assistant text appearing as it arrives, **product cards** (compact card with photo, name, price or "Price on request", link to the product, "Add to cart" using `useCart().add`), **quick-reply chips** ("Show it in grey", "Add to cart", "Book a visit", "Talk to a person"; chip `action` values `send | add_to_cart | book_visit | whatsapp | link` from the contract), thumbs up/down on assistant messages (`POST /api/chat/feedback/`), typing indicator, input with send button (Enter sends, Shift+Enter newline, 600-character limit with counter), error state with a retry and the WhatsApp fallback, a short honest welcome ("Ask me about sofas, colours, sizes or booking a visit. I'm an automated assistant; for anything else the team is on WhatsApp.") and starter chips. On mobile the panel is full-height with safe-area padding and the input stays above the keyboard.
- **Context**: sends `{ page: location.pathname, productId?, variantId?, cart: toCartRef(lines) }` with each message. Listens for the `CHAT_OPEN_EVENT` window event (`@/lib/events`): opens the panel, applies `productId/variantId` as context (and shows "Asking about: <name>" using the product's slug from the page URL when available), applies `cart` and, when `nudge` is true, sends an automatic first message asking for pieces that go with the cart; when `message` is set, sends it. Keeps the conversation for the session in `sessionStorage` (messages and `conversationId`), per visitor ids from `getVisitorIds()` (`@/lib/analytics/client`).
- **Handoff**: a `handoff` event renders a "Talk to a person on WhatsApp" button (opens `whatsappUrl`, `trackEvent('whatsapp_click')`). `trackEvent('chat_open')` when opened, `trackEvent('chat_message')` per sent message.
- `client.ts`: `readNdjson(response)` async generator that parses lines robustly (partial chunks, blank lines, malformed lines skipped); `sendChat(request, signal)` returns the generator; abort in-flight requests on close/unmount; ignore events after abort.
- Accessibility: focus moves into the panel on open and returns to the button on close; Esc closes; focus trap; contrast ok on bone/maroon; reduced motion removes slide/pulse animations.

## Tests
`tests/unit/chat-client.test.ts`: NDJSON parsing across chunk boundaries, blank/malformed lines, error status handling, abort behaviour (mock `fetch` with a `ReadableStream`).

## Don't
Edit the site layout, header or any shared file; import server-only modules; store personal data in localStorage.
