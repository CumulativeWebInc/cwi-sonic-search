# OS Retrofit — Sonic Search (slot 18)

Date: 2026-09-23 · OPERATION RETROFIT Wave 2 · Constitution: AGENT-OPERATING-FRAMEWORK-2026-09-23

## What changed (this retrofit)
- Brand: official CWI logo (`brand/logo.jpg`) in the page header; Cumulative Web Inc header/footer identity on every page.
- CTA + try-link: visible "Try it live" strip with a working deep link, plus a business/support secondary CTA.
- Metadata: `llms.txt`, `.well-known/agent-card.json`, `content.json`, JSON-LD `WebApplication` schema.org block, canonical + Open Graph + Twitter tags.
- Marketing: value proposition above the fold; honest-limits copy retained verbatim (truth labels NEVER upgraded).
- Business: $0 free tool; commercial/support route via hp@cumulativeweb.com; attribution via the app's own machine-readable receipts and deep links (no third-party trackers).
- OS fit: nervous-system project state `os-retrofit-18-sonic-search` with evidence-graded claims; 21-gate theorem verdict recorded.

## Red-team pass (2026-09-23)
- ?q= is reflected only through esc() before innerHTML — no XSS. JSON mode (?q=&format=json) writes via textContent.
- 29/35 tracks are tag-only with the visible 'no audio features on file — tag match only' label; nothing is estimated, ever.
- Spotify embeds use verified catalog IDs only; tracks without a verified ID show a labeled placeholder, never a guessed embed.

## Secret scan (2026-09-23)
Pattern scan over the full repo (api keys, secrets, tokens, private keys): **0 hits**.


## Tests
node --test test.js — 26/26

## Truth-label discipline
No label changed in this retrofit. UNVERIFIED stays UNVERIFIED; honest-limits copy untouched.
