# Sofa Factory Outlet — Rebuild Plan

Oct 27, 2026 · @Januth Nimnal

Rebuild sofafactoryoutlet.lk as one Next.js app on Vercel. It has six parts:

- an Awwwards-grade landing page
- a store that updates itself whenever a product is added
- a cart that ends in a booked showroom visit instead of a payment
- a chatbot that answers from the live catalogue plus a starter knowledge pack I write
- an admin with a Bookings section, a notification bell, visitor analytics, an SEO page and printable invoices
- a search-first build aimed at the top of Google in Sri Lanka: fast server-rendered pages, one strong page per search, rich product data, a Google Business Profile and reviews plan, and a monthly content engine

Months 1–2 cost nothing: the site runs on Vercel Hobby and OpenRouter's free tier, and the chatbot answers most questions without the model, so 50 model calls a day is enough. Month 3 moves to Vercel Pro and a 10-credit OpenRouter top-up, which only takes configuration changes.

## At a glance

&#91;embedded content: System overview · 2 front ends, 1 app, 4 services\]

Visitors and staff use the same app. Only the chatbot talks to OpenRouter, and every fact it uses comes from Postgres.

## Stack and hosting

The whole thing is one TypeScript codebase: a single Next.js app serves the public site, the admin and the API. That keeps deploys to one `git push`.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript | Server rendering for SEO, built-in API routes, made for Vercel |
| Styling | Tailwind CSS v4 + CSS variables for design tokens | Fast to build, one source for colours and type |
| Motion | GSAP + ScrollTrigger + SplitText, Lenis smooth scroll, Motion for UI transitions | The standard Awwwards toolkit; GSAP plugins are free |
| WebGL | React Three Fiber + drei + custom GLSL shaders | Image-distortion hovers and the 3D colour explorer |
| Database | Neon Postgres (Vercel Marketplace) with `pgvector` and `pg_trgm`, Drizzle ORM | One database for products, bookings, chat, analytics and knowledge search |
| Files | Vercel Blob | Product photos and uploaded knowledge files |
| Admin login | Auth.js v5, email + password (bcrypt), roles: owner / staff | No third-party sign-in needed |
| AI | OpenRouter: a free chat model with 2 free fallbacks, and embeddings from month 3 | See the chatbot section |
| Email (optional) | Resend free tier | Booking alerts to the owner's inbox |
| Forms and validation | React Hook Form + Zod | Shared validation on client and server |
| Admin charts | Recharts | Visitor and booking charts |
| Invoices | Print CSS (A4) + `@react-pdf/renderer` | Print straight from the browser or download a PDF |

Languages in play: TypeScript/TSX, CSS, GLSL (shaders), SQL (migrations and search), and Markdown/JSON (knowledge files).

**Running costs**

- **Months 1–2: zero cost.**
  - **Vercel Hobby (free) includes, per month:**
    - 1,000,000 function calls
    - 100 GB of transfer
    - 4 CPU-hours
    - 5,000 image transformations
    - cron jobs that run once a day

    That's plenty for launch traffic in Sri Lanka.
  - **OpenRouter free models with no credit:** 20 requests a minute and 50 a day. The chatbot is designed around that budget (see Chatbot).
  - **Neon:** free tier.
  - **Vercel Blob:** the Hobby allowance (1 GB).
  - **Resend:** free tier.
  - **Risk to know:** Vercel's terms limit Hobby to personal, non-commercial use, and a shop site counts as commercial. Vercel can pause a project that breaks this. Treat the two months as a soft launch and be ready to move to Pro on short notice.
- **From month 3, or sooner if traffic grows.**
  - **Vercel Pro:** $20 a month per developer seat, with $20 of usage credit included.
  - **OpenRouter:** a one-time purchase of 10 credits lifts the daily cap to 1,000 and pays for embeddings.
  - **The switch is configuration only:** move the project to a Pro team, add credit, turn on embeddings in admin settings. No code changes.

## Landing page

The concept is “straight from the factory floor”: warm, editorial minimalism. Every section tells the one story the competition can't, that these sofas are made here and sold without a middleman.

**Design direction**

- **Palette:** bone `#F3EFE8` background, ink `#141211` text, the existing brand maroon `#842323` as the single accent, and clay `#C9A88A` for warm details.
- **Type:** Fraunces, a variable serif, for huge display headlines, with Inter Tight for UI and body text. Both are self-hosted through `next/font`.
- **Layout:** a 12-column grid, generous whitespace, oversized type, and full-bleed photography.
- **Logo:** the current logo stays. A simplified wordmark is used for the oversized footer.

| # | Section | What happens | Built with |
| --- | --- | --- | --- |
| 1 | Preloader | Counter 0→100, logo revealed through a mask, maroon curtain lifts. First visit only | GSAP timeline |
| 2 | Hero | Giant split-text headline, full-bleed sofa photo with a cursor-following ripple, magnetic “Explore the collection” button | SplitText, GLSL displacement shader |
| 3 | Marquee | Endless strip of categories that skews with scroll speed | GSAP + Lenis velocity |
| 4 | The factory (pinned) | Four steps — Frame, Foam, Fabric, Finish — play while the section is pinned; images crossfade and short facts count up | ScrollTrigger pin + scrub |
| 5 | Collections | Horizontal-scroll gallery of categories; hovering bends the image; click opens the store pre-filtered | ScrollTrigger, R3F image planes |
| 6 | Colour explorer (signature) | A 3D sofa built in code from rounded blocks; tap a fabric swatch and it re-upholsters with an eased blend; “Shop this colour” filters the store | React Three Fiber, custom material |
| 7 | Featured pieces | 4–6 picks, second photo on hover, quick add to cart | Motion |
| 8 | Proof | Numbers that count up (years, homes furnished, districts delivered to) and real customer reviews supplied by the client | GSAP |
| 9 | Visit the showroom | Map, opening hours and a “Book a visit” call to action over a parallax showroom photo | Next.js Image, parallax |
| 10 | Footer | Oversized wordmark revealed on scroll, WhatsApp, Facebook, links | CSS + GSAP |

**Site-wide touches:** a custom cursor (a dot and ring that becomes “View” over products), magnetic buttons, a curtain-wipe transition between pages, and a subtle grain overlay.

**Guardrails, so it scores on usability as well as looks:**

- **Reduced motion:** turns off pinning, scrubbing and WebGL and shows still images.
- **WebGL loading:** loads only after the hero has painted.
- **Speed targets:** mobile Lighthouse at 90 or above, and LCP under 2.5 seconds.
- **Images:** served as AVIF/WebP.
- **Mobile:** gets its own designed version of each effect rather than a scaled-down desktop.

The biggest single upgrade for the Awwwards entry is original photography of the client's own pieces. It also clears up the borrowed-image problem from the capture.

## Store and product pages

The store is fully server-rendered, so every product page can rank on Google. It also keeps the old WooCommerce URLs working, so the client's existing search traffic isn't lost.

**Store (`/shop/`, plus category hubs such as `/sofas/l-shape/`)**

- **Filters:**
  - category
  - colour family (swatches)
  - material (fabric, leather, velvet, corduroy)
  - shape (L-shape, U-shape, 3+2+1 set, single)
  - seats
  - price range, once real prices exist
- **Shareable:** filters live in the URL (`/shop/?colour=green&shape=l-shape`), so a filtered view can be shared or linked from the chatbot.
- **Sort:** featured, newest, price.
- **Cards:** a second photo on hover, and colour dots that swap the card image to that variant.

**Product page (`/product/[slug]/`, the same URL as today)**

- **Gallery:** swipeable with zoom. Each colour variant has its own photos, and choosing a colour swaps them.
- **Details:** dimensions shown as a simple diagram, plus material, care and delivery notes.
- **Price:** shown when set, otherwise “Price on request” (34 of the 35 current products have no price).
- **Add to cart:** stores the product together with the chosen colour.
- **“Ask about this sofa”:** opens the chatbot already knowing which product and colour the visitor is on.
- **“Complete the look”:** colour-matched suggestions from the same engine the cart uses.

**SEO and migration**

- **Search markup:** `Product`, `FurnitureStore` and breadcrumb structured data on every relevant page. The full search plan is in the SEO section.
- **URLs stay where Google already knows them.** Product pages keep `/product/[slug]/` and `/shop/` and `/about-us/` stay as they are, with `trailingSlash: true` to match WordPress exactly. Only category pages move, with permanent 301s:

  | Old URL | New URL |
  | --- | --- |
  | `/product/:slug/` | unchanged |
  | `/shop/`, `/about-us/` | unchanged |
  | `/product-category/sofa/` | `/sofas/` |
  | `/product-category/beds/`, `/chair/`, `/table/`, `/ottoman/`, `/pillows/` | `/beds/`, `/chairs/`, `/tables/`, `/ottomans/`, `/pillows/` |
  | `/product-category/coffee/` | `/tables/coffee/` |
  | `/my-account/…`, `/?p=267` (wishlist) | Home |
- **Product import:** a seed script loads the 35 captured products from `data/products.json`, uploads their images to Vercel Blob, and flags the images that look borrowed so they get replaced.
- **About page:** the About, Factory and Visit pages are rebuilt in the same visual language.

## Automated product pipeline

Adding a product in the admin is the only step. Saving it updates the store, the landing page, search, the sitemap, the chatbot and the colour suggestions within seconds. Nobody ever writes a dataset for a product.

**What happens on Save**

1. **Photos.** Each photo is resized to 4 widths, converted to AVIF and WebP, and stored in Vercel Blob. Pages load these ready-made sizes directly, so the Hobby limit of 5,000 image transformations a month isn't touched.
2. **Colours.** The admin picks a hex, or uses an eyedropper on the photo. Code works out the colour family, tone and warmth, and the admin can override any of them.
3. **Search text.** Built automatically from the name, category, material, shape, seats, colours and description, with synonyms applied. The full-text index updates on save.
4. **Chatbot facts.** The bot reads each product live from the database when a question comes in. Its fact card is built from the record: name, category, shape, seats, material, colours, dimensions, and price or “on request”. Care advice is linked automatically through the material (a velvet sofa pulls in the velvet-care notes), so “how do I clean this?” works for every new product.
5. **Suggestions.** The colour engine includes the new product at once.
6. **Pages.** `revalidateTag('products')` refreshes the store, the landing page's featured row, the product page and the sitemap.

**The product list fills itself**

- **The 35 current products** are imported automatically on the first deploy, from the site capture. Categories are mapped, and the 22 uncategorised items are sorted by name into sofa, chair or table for review.
- **New products** are added one at a time in the editor, or many at once by CSV upload (one row per product, one column per colour).
- **Featured and “New” labels** run themselves. New products are marked “New” for 30 days, and the landing page shows the featured ones first, then the newest.

## SEO: ranking plan

Nobody can guarantee position 1. The plan pulls every lever Google rewards:

- fast server-rendered pages
- one strong page per search
- complete product data
- a well-run Google Business Profile with steady real reviews
- new useful content every month

The target is the top 3 in Google Sri Lanka for 20 priority searches within 6 months. Rankings move over months, not weeks. Every tool below is free.

**1. Keyword map: one page per search intent**

| Cluster | Example searches | Page that targets it |
| --- | --- | --- |
| Brand | sofa factory outlet | Home |
| Sofas in general | sofa Sri Lanka, sofa set price in Sri Lanka, sofa shop Colombo | `/sofas/` hub |
| L-shape and corner | L shape sofa Sri Lanka, corner sofa price | `/sofas/l-shape/` |
| Sets | 3+2+1 sofa set, living room sofa set | `/sofas/sets/` |
| Recliners | recliner sofa Sri Lanka | `/sofas/recliners/` |
| Materials | velvet sofa, leather sofa Sri Lanka, fabric sofa | `/sofas/velvet/`, `/sofas/leather/`, `/sofas/fabric/` |
| Other categories | beds, chairs, tables, ottomans, pillows + “Sri Lanka” / “price” | One hub per category |
| Factory and custom | sofa manufacturer Sri Lanka, factory price sofa, custom made sofa | `/factory/` story page + Home |
| Local | sofa shop near me, furniture shop + area name | Google Business Profile + `/visit/` |
| Questions | best sofa fabric for humid weather, how to clean a velvet sofa | `/guides/…` |
| Sinhala / Singlish | සෝෆා, sofa set mila | Sinhala versions of the top pages (`/si/…`) |

Before building, check search volumes in Google Keyword Planner (free with an Ads account). Then search each term in Google from Sri Lanka and record the current top 10, and lock the map. A single page never targets two clusters, so pages don't compete with each other.

**2. Site structure built for search**

- **Category hubs** have a real 150–300-word introduction, the product grid, buying tips and links to the matching guides. The tips are visible content.
- **Filters:** only the promoted ones (shape, material) get indexable pages. Every other combination stays `noindex, follow` and points its canonical at the hub, so Google doesn't crawl thousands of near-duplicates.
- **Breadcrumbs** on every page.
- **Automatic internal links:** product → category hub → guide → related products.
- **Pagination** uses real numbered URLs, never only infinite scroll.
- **Area pages** exist only for places the client really serves, each with genuine content such as delivery times and photos of local deliveries. Thin copy-paste city pages break Google's spam policy.

**3. Technical SEO, built in**

- **Rendering:** every public page is server-rendered HTML. Products use static generation and refresh on save.
- **Speed targets,** measured on a mid-range Android over 4G, since most Sri Lankan traffic is mobile: LCP under 2.5 s, INP under 200 ms, CLS under 0.1. The Awwwards effects load only after the content. The hero image is preloaded and fonts are subset.
- **Titles and descriptions:** generated from product data, and editable. Title example: “Emerald Velvet L-Shape Sofa with Chaise | Sofa Factory Outlet”. Descriptions are built from material, seats, colours and price.
- **URLs:**
  - one host, with canonicals on every page
  - `trailingSlash: true` to match the old WordPress URLs exactly
  - changing a slug creates a 301 automatically
  - real 404 and 410 pages
- **Sitemaps and robots:** a sitemap index split into pages, products, categories, guides and images, plus `robots.txt`.
- **Sharing:** a share image is generated for every product, so links look good on Facebook and WhatsApp.
- **Alt text:** generated from the product data, e.g. “Emerald green velvet L-shape sofa with chaise, front view”.
- **Sinhala pages:** `hreflang` (`en-LK` / `si-LK`) once they launch.
- **Bing:** a ping through IndexNow whenever a product is published.

**4. Structured data**

| Page | Markup | Notes |
| --- | --- | --- |
| Every page | `Organization`, `WebSite`, `BreadcrumbList` | Logo, Facebook and other profiles via `sameAs` |
| Home, `/visit/` | `FurnitureStore` (a local business type) | Address, map pin, hours, phone, WhatsApp, price range. Must match the Business Profile exactly |
| Product pages | `Product` + `Offer` (LKR) + `aggregateRating` | Colour, material and dimensions included. Shows prices and stars in results |
| Guides | `Article` | Author is a named person from the company |

Three limits shape this:

- **No merchant listings.** Google's merchant listings only cover pages where shoppers can buy online, and this site books visits instead. Product pages therefore aim for product snippets.
- **Price-on-request products won't show a price in results.** That is the strongest reason to publish at least “from” prices.
- **FAQ rich results are gone.** Google stopped showing them in May 2026, so FAQs stay as visible content only.

**5. Local SEO and reviews, probably the biggest lever**

- **Google Business Profile:**
  - verify it, choose “Furniture store” as the primary category, and add the closest secondary ones
  - fill in exact hours and the website link
  - add the main products
  - post new photos (showroom, factory, deliveries) and an update every week
  - a WhatsApp link for messages
- **Reviews on autopilot.** When staff mark a booking *Visited* or an invoice *Paid*, the admin offers a one-tap WhatsApp message with the Google review link. Every customer is asked: no rewards for reviews and no filtering of who gets asked, as Google's rules require. The dashboard tracks review count and rating.
- **On-site reviews:** visitors who came in can review the product they bought. These feed the stars on product pages.
- **Consistent details everywhere:** name, address and phone match exactly on the site, the Business Profile, Facebook, Instagram, ikman.lk listings and local directories, and each of them links back.
- **The `/visit/` page:** an embedded map, directions from main roads and parking information.

**6. Content engine**

The buying guide, materials and colour files from the chatbot's knowledge pack are also published as `/guides/` pages. One source feeds both the bot and Google. Two new guides a month for six months: I draft them, the client checks the facts, and each uses original photos. The first six:

1. Sofa prices in Sri Lanka: what you get at each budget (needs real prices)
2. L-shape, U-shape or 3+2+1: which fits your living room
3. The best sofa fabrics for Sri Lanka's humid climate
4. How to clean and care for a velvet sofa
5. How to measure your room before buying a sofa
6. Inside our factory: how a sofa is made (photos and video)

In months 2–3, the top 5 pages get Sinhala versions: drafted by machine, then checked by a native speaker.

**7. Authority: links and mentions**

- **Design galleries:** Awwwards and similar galleries give strong links and attention. The competition entry doubles as link building.
- **Press:** pitch local lifestyle and home sites with the factory story.
- **Partners:** a trade page for interior designers, architects and apartment developers.
- **Video:** factory clips on YouTube, Facebook, Instagram and TikTok, each linking to a product or guide.
- **Never buy links.** Google penalises paid link schemes.

**8. AI search (Google AI Overviews, ChatGPT and others)**

- **Answerable pages:** address, hours, delivery, prices and materials are stated plainly in HTML and in structured data, so AI tools can quote them correctly.
- **Crawlers:** whether to allow reputable AI crawlers in `robots.txt` is the client's call.
- **Consistency:** the business is described the same way everywhere it appears.
- **`llms.txt`:** optional and cheap, but Google hasn't confirmed it has any effect.

**9. Migration without losing rankings**

- **Product URLs stay exactly as they are** (`/product/[slug]/`), so the pages Google already knows keep their history with no redirect at all. Every other old URL gets a permanent 301.
- **A test** checks every URL from the capture: each must return 200, or 301 → 200.
- **Ranking pages keep their content at first.** Search Console shows which pages rank, and those are improved gradually rather than rewritten on day one.
- **Launch day:** no leftover `noindex`, sitemaps submitted, and Search Console coverage checked daily for two weeks.

**10. Measuring it**

- **Search tools:** Google Search Console (a domain property, verified by DNS) and Bing Webmaster Tools from day one.
- **Admin SEO page:** a daily cron job pulls the Search Console API. It shows clicks, impressions and average position for the 20 priority searches, the top pages, and pages with errors.
- **SEO checklist in the product editor:**
  - title and description length
  - at least 4 photos, all with alt text
  - a description of 150 words or more
  - a price set
  - linked to a guide

  Each product shows green, amber or red.
- **Monthly report:** generated in the admin, covering rankings, clicks, new reviews and the next content due.

## Cart and Book a Visit

The cart never takes payment. Its last step books a showroom visit, and the booking lands in the admin with the full cart attached. One colour-matching engine powers the cart's suggestions, the product page's “Complete the look” and the chatbot.

**Cart**

- **Storage:** kept in the browser with Zustand, persisted to `localStorage`. Visitors don't need an account.
- **Each line:** product, colour variant, quantity, plus a snapshot of the name, image and price.
- **Where it shows:** a slide-in drawer from any page and a full `/cart` page. Visitors can change colour or quantity in place.
- **Totals:** shown only when every line has a price. Otherwise the cart says “Prices confirmed at your visit”.

**Colour-matched suggestions, starting from the cart**

1. **Every colour variant is tagged** with a name (“Emerald velvet”), a hex value, a family (green), a tone (light / mid / dark) and a warmth (warm / cool / neutral).
2. **A pairing table sets which colours go together.** The admin can edit it. For example: green pairs with cream, beige, mustard and walnut; grey with mustard, teal and blush; navy with camel, cream and brass. Neutrals pair with everything.
3. **A category table sets which products go together:** sofa → pillows, ottoman, coffee table; bed → pillows, side table; chair → ottoman, side table.
4. **Each candidate gets a score:** category fit + colour harmony (from the pairing table, backed up by hue distance) + featured or in-stock boost. Anything already in the cart is skipped.
5. **The top 3–4 show up in a “Complete the look” row,** each with a one-line reason the code generates, for example “Cream cushions soften emerald velvet”.
6. **On the cart page the chatbot opens with a nudge built from the same results.** It has the cart and colours in its context, so it can follow up with “what about a coffee table?”

**Book a Visit (`/book-visit`), the end of the cart**

1. **Review:** the cart items, which can still be edited.
2. **Details:**
   - full name
   - phone (validated for Sri Lankan numbers, with a “Same number on WhatsApp” toggle)
   - email (optional)
   - city or district
   - preferred date (open days only)
   - time slot (admin-set slots, each with a capacity)
   - notes
   - preferred contact method
   - a consent tick box
3. **Submit:** a server action validates the form with Zod. Cloudflare Turnstile (free) and a rate limit stop spam. The action then saves the booking with each selected product, colour and quantity, creates an admin notification, and can email the owner.
4. **Confirmation:** a booking reference (for example `SFO-B-0042`), an add-to-calendar file, a map link and a WhatsApp button to the showroom. The cart is cleared.

Visitors can also book a visit with an empty cart, for example from the landing page's showroom section.

## Chatbot

The small free model only phrases the answer. Code decides what is true: it finds the products, retrieves the facts, checks confidence and renders the product cards. The model never sees the whole catalogue and cannot invent a product, because cards are drawn from database IDs, not from its text.

&#91;embedded content: Chatbot pipeline · 7 steps, 2 shortcuts\]

Two shortcuts skip the model entirely: FAQ matches are answered from storage, and low-confidence questions get an honest hand-off instead of a guess.

**Months 1–2: built for 50 model calls a day**

- **Most answers never use the model.** FAQ matches, product searches, colour pairings, store info and booking help all reply from templates filled in by code. For example: “Here are 3 green L-shape sofas” plus product cards, or “That pairs well with these cushions” plus cards. The target is 80% of messages answered with no model call.
- **The model is saved for open questions,** such as “which sofa suits a small flat with two kids?”
- **Daily budget counter.** After 45 model calls (5 are kept as a buffer), the bot switches to template-only mode until the limit resets. It keeps finding products and answering FAQs, and offers WhatsApp for anything open-ended.
- **Per visitor:** 3 model answers per session. Further open questions get a WhatsApp hand-off.
- **Search is keyword-only until month 3:** Postgres full-text, fuzzy matching and synonyms. For a catalogue of this size and a starter pack of about 10 files, that is enough. Meaning search (embeddings) switches on in month 3 with one setting and a re-index.
- **Lazy loading:** the chat widget loads only when it is opened, so visitors who never chat pay nothing in page speed.

**What happens to each message**

1. **Normalise.** Lowercase the text, fix common typos, and expand synonyms from an admin-editable dictionary: “couch” → sofa, “corner sofa” → L-shape, “lakhs” → ×100,000. Sinhala and Singlish keywords go in the same dictionary.
2. **Instant answers.** If the question closely matches a stored FAQ (trigram similarity ≥ 0.6), return the stored answer with no model call. Hours, location and delivery questions are answered exactly and use none of the daily quota.
3. **Route the intent.** A rules-and-keywords classifier sorts each message into one of seven intents:
   - find products
   - a question about the product on screen
   - pair with my cart
   - store info
   - booking
   - small talk
   - off topic
4. **Extract details in code.** Category, colour family, material, shape, seats, budget (“under 1.5 lakhs” → ≤ LKR 150,000) and room size.
5. **Retrieve.**
   - **Products:** a SQL filter on the extracted details, ranked by full-text and fuzzy match. Top 4.
   - **Knowledge:** hybrid search. Postgres full-text ranking (headings weighted above body) and `pgvector` similarity are merged with reciprocal rank fusion, then filtered by tags that match the intent. Top 3 chunks of about 350 tokens each.
   - **Pairings:** call the colour engine with the cart.
6. **Confidence gate.** If nothing scores above the threshold, skip the model. Reply honestly with “I'm not sure, but the team can tell you”, add WhatsApp and Book a Visit buttons, and log the question as a knowledge gap.
7. **Build a small, strict prompt.**
   - **Rules:** answer only from FACTS, use at most 80 words, never state a price that isn't listed, and format prices in LKR.
   - **Numbered FACTS:** the retrieved knowledge chunks.
   - **PRODUCTS:** one compact line each, e.g. `[P1] Emerald L-Shape | velvet | green | 5 seats | price on request`.
   - **CART:** what the visitor has added so far.
   - **Recent chat:** the last 4 turns.
   - **Examples:** 2–3 short sample answers written for that intent.
   - **Settings:** temperature 0.2, at most 250 output tokens.
8. **Call the model.** OpenRouter with a fallback list of free models, streamed to the visitor. After a 15-second timeout, send a polite fallback.
9. **Check the answer.** Remove any product name that isn't in PRODUCTS and any price that doesn't match the database. Then attach product cards and quick-reply chips (“Show it in grey”, “Add to cart”, “Book a visit”).
10. **Log everything** so the admin can review it: the question, intent, retrieved IDs and scores, answer, model, response time, and thumbs up or down.

**Keeping relevance high**

- **Golden test set:** 60 real questions taken from the client's WhatsApp and Facebook messages, each with the expected facts or products. `npm run eval:chat` scores retrieval hit@3 (target ≥ 90%) and checks the answers. The admin can re-run it after any knowledge upload.
- **Admin playground:** type a question and see the intent, extracted details, chunks with scores, the exact prompt, and the answer.
- **Knowledge-gap queue:** unanswered and thumbs-down questions land here. The admin writes an answer once and it becomes an instant FAQ.
- **Model choice:** test three instruction-tuned free models from OpenRouter's free list against the golden set and keep the best. The model is set in admin settings, so it can be swapped without a redeploy.

**In the interface**

- **Placement:** a floating button opens a branded panel.
- **Context:** it opens already knowing about the product on screen or the cart.
- **Memory:** each visitor's conversation is remembered for their session.
- **Human handoff:** “Talk to a person” opens WhatsApp with a summary of the chat already filled in, and pings the admin bell.
- **Spam and quota protection:** 20 messages per visitor per 10 minutes. When the day's model budget runs out, the bot keeps answering from templates and FAQs.

## Knowledge files

Knowledge files cover what the catalogue can't: the shop, delivery, warranty, materials, buying advice and FAQs. Products never need a file, because the chatbot reads them live from the database. I write the whole starter pack before launch. After that, admins only upload a file when something changes, such as a new offer or a new delivery rule.

**Starter knowledge pack (written by me)**

| File | What it covers | Built from |
| --- | --- | --- |
| `store-info.md` | Showroom address, hours, phone, WhatsApp, directions, parking | Client's answers to the open questions |
| `delivery-and-warranty.md` | Delivery areas, charges, lead times, warranty, returns, custom orders | Client's answers |
| `materials-and-care.md` | Fabric, leather, velvet, corduroy: feel, durability, cleaning, tips for Sri Lanka's humidity | Written by me |
| `buying-guide.md` | Measuring a room; L-shape vs U-shape vs 3+2+1; seat depth; homes with kids and pets | Written by me |
| `colour-guide.md` | Why the colour pairings work, in plain words | Written by me, matching the pairing table |
| `booking-help.md` | How a showroom visit works, what to bring, rescheduling | Written by me, checked by the client |
| `about.md` | The company story | The captured About page |
| `faqs.json` | About 80 questions, each with 3–5 other ways people ask it | The captured site and the client's real WhatsApp/Facebook messages |
| `synonyms.json` | English, Singlish and common Sinhala and Tamil furniture words | Written by me |

Every file is checked against the golden test set before launch. The hours and delivery terms in the examples below are placeholders until the client confirms the real ones.

**Markdown: one topic per `##` heading**

```markdown
---
title: Delivery
tags: [delivery, store_info]
priority: high
---
## Delivery inside Colombo
Delivery inside Colombo is free for sofa sets. It takes 3–5 working days after the order is confirmed.

## Delivery outside Colombo
We deliver island-wide. Charges depend on the district and are confirmed at the showroom.
```

- **Chunks:** each `##` section becomes one chunk. Sections over about 350 tokens split with a 50-token overlap.
- **Heading path:** every chunk is stored with its heading path (“Delivery › Delivery inside Colombo”), which gives the search more to match on.
- **Tags and priority:** tags steer which chunks each intent can see, and `priority: high` breaks ties.

**JSON: FAQs become instant answers**

```json
[
  {
    "q": "What time is the showroom open?",
    "alt": ["opening hours", "are you open on sunday", "showroom time"],
    "a": "The showroom is open 9 am to 7 pm, Monday to Saturday.",
    "tags": ["store_info"]
  }
]
```

The same uploader takes `synonyms.json`, e.g. `{"l-shape": ["corner sofa", "sectional"]}`. Selling points for a single product go in that product's own field in the editor, never in a file.

**What happens on upload**

1. The format is checked: front matter for Markdown, a schema for JSON. Errors are shown line by line.
2. The original file is stored in Vercel Blob and versioned, so an upload can be rolled back.
3. The file is chunked, and each chunk gets a full-text index and an embedding.
4. A preview shows the chunks exactly as the bot will see them. Each document can be switched on or off.
5. The golden test set is offered for a re-run, to show whether relevance went up or down.

**Writing guide for the client** (shipped as templates in the repo):

- Put the answer in the first sentence.
- One fact per sentence, with real numbers.
- Use the words customers actually type.
- One topic per heading.

## Admin panel

The admin lives at `/admin` behind a login. It is built with shadcn/ui on the same design tokens, and works on a phone so staff can handle bookings from the showroom floor. There are two roles: **owner**, who can do everything, and **staff**, who can't change settings or users or delete records.

| Module | What it does |
| --- | --- |
| Dashboard | Visitors today and over 7 days, bookings, visitor-to-booking conversion, most-viewed products, top chatbot questions, open knowledge gaps |
| Notification bell | Unread badge for new bookings, “talk to a person” requests, knowledge gaps, flagged answers and overdue invoices. Click to jump to the item. Optional sound and browser notifications. Checks every 20 seconds, which suits serverless hosting; email via Resend is optional |
| Products | Create, edit and duplicate products: name, category, description, colour variants (picker with hex, family, tone, warmth), drag-and-drop photos per variant, dimensions, material, shape, seats, tags, price or “on request”, featured, draft / published / hidden, SEO fields. Bulk CSV import |
| Categories and colour rules | Manage categories, the colour pairing table and which categories complement each other |
| Bookings | Its own sidebar section (details below): who is coming and the exact products they picked. Status: New → Contacted → Visited → Purchased / Lost. Calendar view of slots, notes, one-tap WhatsApp or call, and **Convert to invoice** |
| Knowledge base | Upload MD/JSON, versions, on/off switch, chunk preview, re-index, FAQ editor, synonym editor, knowledge-gap queue |
| Chat | Conversation logs, thumbs-down review, the playground, the golden-set test runner, model settings |
| Visitors | Analytics (next section) |
| Invoices | Walk-in and website invoices (section after next) |
| Customers | Created automatically from bookings and invoices and matched by phone number. Shows each customer's full history |
| Settings | Business details and invoice logo, bank details, showroom hours and booking slots, WhatsApp number, staff accounts, invoice numbering and tax |
| SEO | Search Console clicks, impressions and positions for the 20 priority searches; pages with errors; the SEO checklist score for every product; a redirects manager; Google review requests sent and review count; the monthly report |

**The Bookings section**

Bookings has its own sidebar item, with a badge counting new bookings. Each booking shows who is coming and exactly which products, colours and quantities they picked. Clicking a bell notification opens the booking directly.

- **List view**
  - **Columns:** reference, name, phone, visit date and slot, the products (photo thumbnails and a count), status, and how they found the site.
  - **Filters:** status, date range, product.
  - **Search:** by name, phone or reference.
- **Booking detail**
  - **Customer:** name, phone (tap to call), WhatsApp (tap to chat), email, city, preferred contact method, their notes, and their past bookings and invoices.
  - **Products selected:** each product's photo, name, colour swatch and colour name, quantity, price or “on request”, and a link to the product page. A total shows when every item is priced.
  - **Visit:** date and slot, when it was booked, referrer or UTM source, and the chat transcript if they used the bot.
  - **Actions:** change status, add staff notes, reschedule, mark as visited, **Convert to invoice**, and print a one-page booking sheet for showroom staff.
- **Calendar view:** day and week views showing each slot and how full it is.
- **Export:** CSV of any filtered list.

## Visitor analytics

The site runs its own lightweight tracking into Postgres, so the admin sees shop-specific numbers: which sofas get viewed, added and booked, and where visitors come from. No IP addresses or personal data are stored. Vercel Speed Insights is switched on separately to watch Core Web Vitals.

**What is collected**

- **Events,** sent with `navigator.sendBeacon` to `/api/track`:
  - page view, product view, colour picked
  - add to cart, remove from cart
  - chat opened, chat message
  - booking started, booking submitted
  - WhatsApp click
- **Identity:** a random visitor ID in `localStorage` and a session ID in `sessionStorage`. Neither contains personal data.
- **Added on the server:**
  - country, region and city, from Vercel's request headers
  - device and browser, from the user agent
  - referrer and UTM source
- **Bots:** known bots are filtered out.
- **Speed:** a nightly Vercel Cron job rolls raw events into daily totals, so the dashboard stays fast.

**What the Visitors page shows**

- **Traffic:** visitors, sessions and page views over time, plus a live “on the site now” count (last 5 minutes).
- **Sources:** Google, Facebook, WhatsApp, direct and others.
- **The funnel:** visit → product view → add to cart → booking started → booking submitted, with the drop-off at each step.
- **Products:** each product's views, adds to cart and bookings side by side.
- **Audience:** devices, and the top cities in Sri Lanka.
- **Chatbot:** conversations, the share answered instantly from FAQs versus by the model, and open knowledge gaps.

The site needs a short privacy notice. Check the client's obligations under Sri Lanka's Personal Data Protection Act before launch.

## Invoices

Staff can invoice a website customer in one click from their booking, or a walk-in customer from scratch. They pick products and colours straight from the catalogue, then print on A4 or send a PDF. Each invoice records whether the sale came through the website, so the admin can see how much revenue the site drives.

1. **Start.**
   - **Convert to invoice** on a booking: fills in the customer and their cart, colours included.
   - **New invoice** for a walk-in.
2. **Customer.** Search existing customers by phone or name, or add a new one: name, phone, address, optional email.
3. **Line items.**
   - **From the catalogue:** type-ahead search, choose the colour variant, then set quantity, unit price (defaults to the product price, editable) and an optional line discount.
   - **Custom lines:** for extras such as “Delivery to Kandy” or “Extra cushions”.
4. **Totals.**
   - subtotal
   - discount, as an amount or %
   - delivery charge
   - tax: off by default, with a configurable rate if the client is VAT-registered
   - grand total
   - advance paid and balance due

   All amounts are in LKR (Rs. 1,250,000.00).
5. **Number and status.** Numbers run per year, `SFO-2026-0001`, and are issued inside a database transaction so they never repeat. Status runs Draft → Issued → Partially paid → Paid, or Cancelled. Cancelled invoices are kept, never deleted.
6. **Payments.** Record each payment (cash, bank transfer, card at the showroom) and the balance updates itself.
7. **Print or send.**
   - **The invoice page:** logo, business and bank details, the customer, the items table, totals, delivery date, warranty and terms, and signature lines.
   - **Print:** uses an A4 print stylesheet.
   - **Download PDF:** generated with `@react-pdf/renderer`.
   - **WhatsApp:** shares a private PDF link.

**Extras that cost little:** a **Quotation** type on the same template, which converts to an invoice when the customer agrees. Also monthly revenue and outstanding-balance reports with CSV export.

## Data model

Everything lives in one Neon Postgres database: 28 tables, defined in Drizzle and migrated with `drizzle-kit`.

| Area | Table | Key columns |
| --- | --- | --- |
| Catalogue | `categories` | name, slug, parent, image, sort order |
| Catalogue | `products` | slug, name, category, description, material, shape, seats, dimensions, price (nullable), price on request, status, featured, tags, SEO, search index |
| Catalogue | `product_variants` | product, colour name, hex, family, tone, warmth, images, in stock |
| Catalogue | `colour_pairings` / `category_complements` | the two rule tables behind “Complete the look” |
| Bookings | `bookings` | reference, customer, visit date, slot, status, notes, source page, created |
| Bookings | `booking_items` | booking, product, variant (colour), quantity, price at booking — what the Bookings section lists |
| Bookings | `booking_slots` | weekday, start, end, capacity |
| People | `customers` | name, phone (unique), WhatsApp, email, city, address |
| People | `admin_users` | name, email, password hash, role |
| Admin | `notifications` | type, title, link, read at |
| Admin | `settings` | key, value |
| Knowledge | `kb_documents` | title, kind (md/json), file URL, version, enabled, tags |
| Knowledge | `kb_chunks` | document, heading path, text, tags, full-text index, embedding |
| Knowledge | `faqs` / `synonyms` | question, alternatives, answer, hit count / term, variants |
| Chat | `chat_conversations` / `chat_messages` | visitor, context; role, text, intent, retrieved IDs + scores, confidence, model, latency, rating |
| Chat | `knowledge_gaps` | question, times asked, status |
| Analytics | `events` / `daily_stats` | visitor, session, type, path, product, country, city, device, referrer, time / date, metric, value |
| Invoices | `invoices` | number, type (invoice / quotation), customer, booking, source (website / walk-in), status, totals, paid, issued |
| Invoices | `invoice_items` / `payments` / `invoice_counters` | product, variant, description, qty, unit price, discount / amount, method, date / year, last number |
| SEO | `redirects` / `reviews` / `search_console_daily` | old path, new path, hits / product, customer, rating, text, verified visit, approved / date, query, page, clicks, impressions, position |

Indexes: GIN on the full-text columns, trigram indexes on product names and FAQ questions, and HNSW on the chunk embeddings. The embedding column's size is set to match whichever embedding model is chosen.

## Vercel readiness

The app runs on Vercel with no extra servers. Functions run in Singapore (`sin1`) next to a Singapore Neon database, the closest regions to Sri Lanka. Every git branch gets its own preview deployment and its own Neon database branch.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon: pooled connection for the app, direct connection for migrations |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob uploads |
| `AUTH_SECRET` | Admin sessions |
| `OPENROUTER_API_KEY` | Chat and embeddings |
| `OPENROUTER_CHAT_MODELS` / `OPENROUTER_EMBED_MODEL` | Model list in fallback order, and the embedding model (admin settings can override) |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Spam protection on booking and chat |
| `RESEND_API_KEY` / `ADMIN_ALERT_EMAIL` | Optional booking emails |
| `CRON_SECRET` | Protects the scheduled jobs |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, share images |

**Built-in decisions**

- **Chat:** runs on the Node runtime and streams its reply, so long answers don't hit function time limits.
- **Images:** resized once at upload with `sharp`, and `next/image` is set to load those ready-made sizes straight from Blob, so the Hobby limit of 5,000 image transformations a month isn't used.
- **Scheduled jobs:** `vercel.json` cron jobs run the nightly analytics rollup and a morning digest of yesterday's bookings. Hobby only allows jobs that run once a day, which is all these two need.
- **Security:**
  - middleware locks `/admin`
  - server actions for every form, plus rate limits
  - strict security headers that still allow WebGL
  - uploaded Markdown is sanitised before rendering

**Launch checklist**

- [ ] Create the Vercel project on Hobby and connect the GitHub repo (move it to a Pro team in month 3)
- [ ] Add Neon (Singapore) from the Vercel Marketplace and enable `pgvector` and `pg_trgm`
- [ ] Set every environment variable for Production and Preview
- [ ] Run migrations and the seed script (products, categories, starter FAQs)
- [ ] Replace borrowed product photos with the client's own
- [ ] Check every old WooCommerce URL redirects with a 301
- [ ] Add `sofafactoryoutlet.lk` and redirect `www`, then switch DNS
- [ ] Submit the sitemaps in Google Search Console and Bing Webmaster Tools, then check coverage daily for two weeks
- [ ] Keep a full WordPress backup for 90 days

## Build phases

Nine phases, about 33–35 working days for one developer. Each phase ends deployed to a Vercel preview, so the client can review as it goes.

1. **Foundations (2 days)** — repo, Next.js, Tailwind tokens, Drizzle schema, Neon, Vercel previews, the seed import of the captured products, and the keyword map checked against real search volumes.
2. **Landing page (6 days)** — design system, preloader, hero shader, pinned factory story, collections, colour explorer, footer, plus the reduced-motion and mobile versions.
3. **Store and product pages (3 days)** — filters, variants, category hubs, structured data, the redirect map and its test.
4. **Cart, colour engine and Book a Visit (3 days)** — drawer, suggestions, booking form, confirmation.
5. **Admin core (4 days)** — login and roles, product editor with the automated pipeline, the Bookings section, notification bell, settings.
6. **Knowledge base and chatbot (5 days)** — uploader, chunking, keyword search, template answers and the daily model budget, the message pipeline, the widget, the playground, the golden-set test, and writing the starter knowledge pack.
7. **Visitor analytics (2 days)** — tracking, rollups, Visitors page.
8. **Invoices (3 days)** — builder, numbering, payments, print and PDF, quotations.
9. **Polish and launch (3 days)** — performance and accessibility pass, content swap, Search Console and Business Profile setup, the first two guides, DNS cutover, Awwwards submission assets (screenshots, a short screen recording).

**Launch gates:** chatbot retrieval hit@3 at 90% or above on the golden set, mobile Lighthouse at 90 or above, every old URL returning 200 or redirecting, and the Rich Results Test passing for every page type.

**Month 3 switch (about half a day):** move the project to a Vercel Pro team, buy 10 OpenRouter credits, turn on embeddings in admin settings, re-index the knowledge, and re-run the golden test. No code changes.

**After launch, every month:** two new guides, weekly Business Profile posts and photos, review requests after every visit, and a look at the SEO page to pick the next pages to improve.

## Open questions for the client

- [ ] Real prices, or at least “from” prices? Without them Google can't show a price in search results
- [ ] Showroom address(es), opening hours, visit slot length and how many visits per slot
- [ ] Delivery areas, charges and lead times; warranty terms
- [ ] WhatsApp number for chat handoff and alerts
- [ ] Original photos of their own pieces, to replace the 22 flagged images
- [ ] Real customer reviews they are happy to show
- [ ] VAT registration, invoice terms and bank details for invoices
- [ ] How many staff accounts, and who is owner
- [ ] 50–60 real customer questions from WhatsApp and Facebook for the golden test set
- [ ] Vercel and OpenRouter accounts in the client's name, and who pays for Pro and credits from month 3
- [ ] Access to the domain's DNS and to the Google Business Profile (or approval to create one)

## Sources

- [Google Search Central — Product snippet structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google Search Central — Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- [Google Search Central — Product structured data overview](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Google Search Central — FAQ rich results (discontinued)](https://developers.google.com/search/docs/appearance/structured-data/faqpage)
- [OpenRouter — API rate limits](https://openrouter.ai/docs/api-reference/limits)
- [OpenRouter — Embeddings API](https://openrouter.ai/docs/api-reference/embeddings)
- [Vercel — Hobby plan](https://vercel.com/docs/plans/hobby-plan)
- [Vercel — Fair use guidelines (commercial usage)](https://vercel.com/docs/limits/fair-use-guidelines)
- [Vercel — Cron jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel — Pricing](https://vercel.com/pricing)
- Site capture of sofafactoryoutlet.lk, 27 Oct 2026 (README and data files in `D:\Sofa_Factory`)
