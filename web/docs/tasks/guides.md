# Task: guides (two buying guides) — OpenCode free model

You are a writer. You cannot run commands here: create files only. Read `web/docs/BUILD-GUIDE.md` (sections 4, 5 "Truthfulness", 7), **`web/content/knowledge/_FACTS.md` first (the only source of business facts)**, and `../Plan.md` section "SEO: ranking plan → 6. Content engine" and the keyword map (rows Questions, Sofas, L-shape, Sets, Materials).

## Create exactly two files in `web/content/guides/`
1. `sofa-fabrics-for-sri-lankas-humid-climate.md`
2. `l-shape-u-shape-or-3-2-1-which-fits-your-living-room.md`

## Format
```markdown
---
title: The best sofa fabrics for Sri Lanka's humid climate
description: A 150–160 character summary for search results.
slug: sofa-fabrics-for-sri-lankas-humid-climate
datePublished: 2026-10-27
author: Sofa Factory Outlet team
tags: [fabric, velvet, leather, care]
related: [l-shape-u-shape-or-3-2-1-which-fits-your-living-room]
---
Opening paragraph: the answer in two sentences.

## Quick answer
…
```
- The slug in front matter equals the file name without `.md` and the URL path `/guides/<slug>/`. `related` lists the other guide's slug.
- 1,100–1,500 words each. Real structure: opening answer, `## Quick answer` (3–5 bullets), 4–6 `##` sections with `###` where useful, and a final `## Common questions` with 4–6 questions as `###` headings followed by short plain-text answers (visible content; no FAQ markup). Short paragraphs, plain words, practical, warm, British/Sri Lankan spelling.
- Guide 1: velvet, leather, corduroy, general woven fabrics and suede-feel fabrics in a hot, humid climate: breathability, mildew and damp, sun fading, cleaning, pets and kids, how to choose, how to care. Link naturally to `/sofas/velvet/`, `/sofas/leather/`, `/sofas/fabric/` and to `/book-visit/` ("see the fabrics at the showroom"; fabrics are shown and chosen at the visit).
- Guide 2: how to choose between L-shape, U-shape and 3+2+1 for different rooms and households: measure the room, walkways and clearance, where the TV and doors are, entertaining vs everyday, small flats, kids and pets; a comparison table (shape / suits / watch out for). Typical size ranges are allowed only if they are true industry norms and labelled "typical ranges"; say Sofa Factory Outlet makes to order so sizes are agreed at the visit. Link to `/sofas/l-shape/`, `/sofas/u-shape/`, `/sofas/sets/` and `/book-visit/`.

## Rules
- No invented facts about the business, no statistics, no fabric brand names, no foam density or wood species claims, no prices, no delivery or warranty promises. General furniture knowledge only, presented as general advice.
- No competitor names. No emoji.
- Create only these two files. Do not modify any existing file. Reply in at most 4 lines.
