# Sonic Search — Agent Deck SKU #33

Natural-language search over the 35-track CWI music catalog, powered by **real measured audio features** — the counter-product to Cyanite / AIMS API / SourceAudio / Musiio / Jamahook.

## What it does

- **Brief-first query box** (stolen from AIMS): paste a whole sync brief — *"dark 140bpm trap for a fight scene"* — and get ranked tracks.
- **Queryable numeric chips** (stolen from Cyanite): tempo + energy range sliders and a mode selector alongside the natural-language box.
- **Transparent scoring**: every result shows a score breakdown and a reason string citing *actual measured values*, e.g. `tempo 163 BPM matches 150–170 band · energy 0.33 below your 'high energy' bar — ranked lower for that reason`.
- **Honest coverage**: 6/35 tracks carry measured audio features (ReccoBeats third-party analysis, 2026-09-16). The other 29 match on editorial mood tags only and wear a visible `no audio features on file — tag match only` label. Nothing is estimated, ever.
- **Clearance attached to every result** (stolen from SourceAudio's search-to-license): one-stop via hp@cumulativeweb.com, neutral `clearance on request` chip — never a red UNVERIFIED badge.
- **Agent-native**: `?q=...&format=json` returns a `cwi.sonic-result/1.0` payload; `results.schema.json` documents it; `?q=` deep links are shareable.

## Files

| File | Purpose |
|---|---|
| `index.html` | Mobile-first UI, i18n-ready (`data-i18n`, `data-app="sonic-search"`) |
| `styles.css` | CWI dark/gold theme |
| `engine.js` | Query parser + transparent scorer (UMD: browser + node) |
| `app.js` | Browser glue: deep links, sliders, Spotify embeds, JSON mode |
| `data.json` | 35-track dataset (`cwi.sonic-search-data/1.0`): 24 That Boy Hi Hat + 7 King Akeem + 3 183 Wildboi + 1 Dre50 |
| `results.schema.json` | `cwi.sonic-result/1.0` JSON Schema |
| `test.js` | 24 tests, `node --test`, zero dependencies |

## Run tests

```sh
node --test test.js
```

## Data truth

`LIVE`. Feature values trace field-by-field to `~/workspace/cwi-company/catalog/audio-features.json` (ReccoBeats API v1, fetched 2026-09-16). Mood tags are editorial, title-derived only. Live at https://cumulativewebinc.github.io/cwi-sonic-search/
