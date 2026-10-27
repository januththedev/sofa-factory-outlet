# Task: kb-pack (starter knowledge pack: Markdown files) — OpenCode free model

You are a writer. You cannot run commands here: create files only, in `web/content/knowledge/`. Read `web/docs/BUILD-GUIDE.md` (sections 4, 5 "Truthfulness", 7) and **`web/content/knowledge/_FACTS.md` first: it is the only source of business facts**. Also read `../Plan.md` section "Knowledge files" (starter pack table, Markdown format, writing guide).

## Create these seven files (exact names)
`store-info.md`, `delivery-and-warranty.md`, `materials-and-care.md`, `buying-guide.md`, `colour-guide.md`, `booking-help.md`, `about.md`, plus `_PLACEHOLDERS.md` (starts with an underscore: not loaded by the bot).

## Format (the loader parses it, so follow it exactly)
```markdown
---
title: Delivery and warranty
tags: [delivery, warranty]
priority: high
---
## Delivery across Sri Lanka
First sentence answers the question. One fact per sentence…
```
- Front matter has exactly `title`, `tags` (a list from: `store_info, delivery, warranty, materials, care, buying, colour, booking, about, custom, pricing`) and `priority` (`high`, `normal` or `low`).
- Every topic is its own `##` section of roughly 40–180 words. The heading is the question or topic in the words a customer would type ("How long does delivery take?"). A short unheaded intro line before the first `##` is allowed.
- Put the answer in the first sentence; one fact per sentence; plain words; real numbers only when `_FACTS.md` has them.

## Content per file
- `store-info.md` (tags `store_info`): where the showroom is, how to get directions (Google Maps link text only, no invented landmarks), WhatsApp contact, that visits are booked on the website, what happens at a visit. **Opening hours and phone are unknown**: say visits are by appointment and the team confirms a time.
- `delivery-and-warranty.md` (tags `delivery, warranty`, `priority: high`): use the client's published claims with the hedge from `_FACTS.md` (10 to 15 working days across Sri Lanka, free islandwide delivery as stated on the old site, 10-year structural warranty), say charges and exact terms are confirmed at the visit, what to do about repairs and adjustments (contact the team), returns and refunds are **not stated: the team confirms**.
- `materials-and-care.md` (tags `materials, care`): velvet, leather, corduroy and general fabric: how each feels, wears and is cleaned, specific tips for Sri Lanka's humid climate (airflow, avoiding damp walls, sun, mildew), kids and pets. General knowledge only, never stated as a Sofa Factory Outlet specification.
- `buying-guide.md` (tags `buying, custom`): measuring a room, L-shape vs U-shape vs 3+2+1, seat depth, homes with kids and pets, small flats, custom size and colour (as on the old site). Typical ranges are fine if you label them "typical" and say pieces are made to order.
- `colour-guide.md` (tags `colour`): why common pairings work in plain words (green with cream, beige and mustard; grey with mustard, teal and blush; navy with camel, cream and brass; maroon with cream and gold; neutrals go with everything), tone and warmth in a sentence each, how to choose with natural light.
- `booking-help.md` (tags `booking`, `priority: high`): how a visit works (choose pieces, pick a day and a time slot, the team confirms by WhatsApp or phone), the booking reference, calendar file, how to change a booking (message on WhatsApp), what to bring (room measurements, photos, fabric ideas), that no payment is taken online, prices confirmed at the visit.
- `about.md` (tags `about`): the company story using only the About page wording in `../pages/about-us.html` (read it): who we are, mission, vision, why choose us.

## `_PLACEHOLDERS.md`
A plain list for the client: every statement in the pack that depends on an unconfirmed fact (hours, delivery terms, warranty terms, returns, address, WhatsApp), the file and section it appears in, and the question to ask the client.

## Rules
- Do not invent anything absent from `_FACTS.md` and general furniture knowledge. When unsure, hedge or leave it out.
- Do not mention competitors, other brands, or the borrowed catalogue products.
- Write like a warm, practical shop assistant. No hype, no emoji.
- Create only these files. Do not modify any existing file. Reply in at most 4 lines.
