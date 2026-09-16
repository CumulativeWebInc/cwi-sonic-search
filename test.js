/* Sonic Search tests — node --test, zero dependencies.
 * Covers: parser cases (incl. the AIMS-style brief), scoring transparency,
 * reason strings citing real values, no-feature honesty labels, schema shape,
 * deep-link round-trip, and data integrity vs the ReccoBeats source file. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const S = require('./engine.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const SOURCE = JSON.parse(fs.readFileSync(process.env.HOME + '/workspace/cwi-company/catalog/audio-features.json', 'utf8'));
const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function topN(q, n, opts) {
  return S.search(q, data, Object.assign({ limit: n || 35 }, opts)).results;
}
function byTitle(title) {
  return data.tracks.find(function (t) { return t.title === title; });
}

// ------------------------------------------------------------- parser
test('parser: AIMS-style brief "dark 140bpm trap for a fight scene"', function () {
  const p = S.parseQuery('dark 140bpm trap for a fight scene');
  assert.deepEqual(p.tempo, { min: 130, max: 150, label: '130–150 band' });
  for (const m of ['dark', 'tension', 'danger', 'high-energy']) assert.ok(p.moods.includes(m), 'mood ' + m);
  assert.ok(p.artists.includes('That Boy Hi Hat'));
});

test('parser: explicit tempo range "140-150 bpm"', function () {
  const p = S.parseQuery('something 140-150 bpm for a chase');
  assert.equal(p.tempo.min, 140);
  assert.equal(p.tempo.max, 150);
  assert.ok(p.moods.includes('tension'));
});

test('parser: "C# minor" gives key 1 + minor mode', function () {
  const p = S.parseQuery('C# minor');
  assert.deepEqual(p.key, { pitchClass: 1, name: 'C#' });
  assert.equal(p.mode, 'minor');
});

test('parser: "high energy" sets the 0.70 bar', function () {
  const p = S.parseQuery('high energy workout track');
  assert.deepEqual(p.energy, { min: 0.7, max: 1.0, label: "'high energy' bar" });
});

test('parser: "slow chill" sets slow tempo + chill energy', function () {
  const p = S.parseQuery('slow chill');
  assert.equal(p.tempo.max, 100);
  assert.ok(p.energy.max <= 0.45);
  assert.ok(p.moods.includes('calm'));
});

test('parser: "danceable" sets the 0.65 bar', function () {
  const p = S.parseQuery('danceable');
  assert.equal(p.danceability.min, 0.65);
});

test('parser: "minor key rap for a heist scene"', function () {
  const p = S.parseQuery('minor key rap for a heist scene');
  assert.equal(p.mode, 'minor');
  for (const m of ['noir', 'tension', 'cinematic']) assert.ok(p.moods.includes(m), 'mood ' + m);
});

test('parser: lane words map to artists', function () {
  assert.ok(S.parseQuery('afrobeats summer').artists.includes('Dre50'));
  assert.ok(S.parseQuery('rap rock adrenaline').artists.includes('183 Wildboi'));
});

// ------------------------------------------------- scoring + transparency
test('scorer: Zooted Zone tempo 163 matches 150–170 band, reason cites real values', function () {
  const r = S.scoreTrack(byTitle('Zooted Zone'), S.parseQuery('150-170 bpm'));
  const tempo = r.breakdown.find(function (c) { return c.criterion === 'tempo'; });
  assert.equal(tempo.score, 1);
  assert.ok(r.reason.includes('163'), 'reason cites measured tempo');
  assert.ok(r.reason.includes('150–170'), 'reason cites requested band');
});

test('scorer: "danceable minor" top result is Roses over Monaco with value-cited reason', function () {
  const rs = topN('danceable minor', 5);
  assert.equal(rs[0].track, 'Roses over Monaco');
  assert.ok(rs[0].reason.includes('0.83'), 'cites danceability 0.83');
  assert.ok(rs[0].reason.includes('0.65'), 'cites the danceable bar');
  assert.ok(rs[0].reason.includes('minor'), 'cites mode match');
});

test('scorer: Phantasm danceability near-miss is cited with "ranked lower for that reason"', function () {
  const r = S.scoreTrack(byTitle('Phantasm'), S.parseQuery('danceable minor'));
  const roses = S.scoreTrack(byTitle('Roses over Monaco'), S.parseQuery('danceable minor'));
  assert.ok(r.score < roses.score, 'near-miss scores below the clean match (' + r.score + ' < ' + roses.score + ')');
  assert.ok(r.reason.includes('0.55'), 'cites actual 0.55');
  assert.ok(r.reason.includes('ranked lower for that reason'));
  assert.ok(r.reason.includes('0.65'), 'cites the danceable bar');
});

test('scorer: energy miss is honest — Zooted Zone vs "high energy"', function () {
  const r = S.scoreTrack(byTitle('Zooted Zone'), S.parseQuery('high energy'));
  assert.ok(r.reason.includes('0.33'), 'cites actual energy 0.33');
  assert.ok(r.reason.includes("below your 'high energy' bar"), 'cites the bar');
  assert.ok(r.reason.includes('ranked lower for that reason'));
});

test('scorer: "low energy" ranks Zooted Zone (0.33) above Misfits and Hooligans (0.53)', function () {
  const rs = topN('low energy', 35);
  const zi = rs.findIndex(function (r) { return r.track === 'Zooted Zone'; });
  const mi = rs.findIndex(function (r) { return r.track === 'Misfits and Hooligans'; });
  assert.ok(zi < mi, 'Zooted Zone ranks above Misfits on low energy');
  assert.ok(rs[zi].reason.includes('matches'), 'Zooted Zone reason shows the match');
});

test('scorer: key+mode — "C# minor" on Zooted Zone (key C#, major)', function () {
  const r = S.scoreTrack(byTitle('Zooted Zone'), S.parseQuery('C# minor'));
  const key = r.breakdown.find(function (c) { return c.criterion === 'key'; });
  const mode = r.breakdown.find(function (c) { return c.criterion === 'mode'; });
  assert.equal(key.score, 1);
  assert.equal(mode.score, 0);
  assert.ok(r.reason.includes('C#'));
});

// ------------------------------------------------- no-feature honesty
test('no-feature track wears the tag-only label and never scores numeric criteria', function () {
  const r = S.scoreTrack(byTitle('Diabolique'), S.parseQuery('dark 140bpm trap'));
  assert.equal(r.match_label, S.TAG_ONLY_LABEL);
  assert.equal(r.audio_features_present, false);
  assert.ok(r.reason.includes(S.TAG_ONLY_LABEL));
  for (const c of r.breakdown) {
    if (['tempo', 'energy', 'danceability', 'valence', 'mode', 'key'].includes(c.criterion)) {
      assert.equal(c.score, null, c.criterion + ' must be null, never estimated');
    }
  }
  assert.ok(r.reason.includes('could not score: tempo (no data)'));
});

test('no-feature track matches on tags: "dark" finds Diabolique via editorial tag', function () {
  const rs = topN('dark', 35);
  const d = rs.find(function (r) { return r.track === 'Diabolique'; });
  assert.ok(d, 'Diabolique ranks on a dark query');
  assert.ok(d.reason.includes('"dark"'), 'reason names the matched tag');
  assert.ok(d.reason.includes(S.TAG_ONLY_LABEL));
});

test('King Akeem tracks (no Spotify IDs) carry honest no-embed state', function () {
  const star = topN('anthem', 35).find(function (r) { return r.track === 'Star'; });
  assert.ok(star, 'Star is searchable by mood tag');
  assert.equal(star.spotify_id, null);
  assert.equal(star.match_label, S.TAG_ONLY_LABEL);
});

// ------------------------------------------------- schema / payload / links
test('payload validates against cwi.sonic-result/1.0 expectations', function () {
  const p = S.search('dark 140bpm trap for a fight scene', data, {});
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.schema.json'), 'utf8'));
  assert.equal(p.schema, 'cwi.sonic-result/1.0');
  assert.equal(p.schema, schema.properties.schema.const);
  assert.equal(p.honest_limits, S.HONEST_LIMITS);
  assert.equal(p.clearance, S.CLEARANCE_LINE);
  assert.deepEqual([p.coverage.with_audio_features, p.coverage.total], [6, 35]);
  assert.equal(p.result_count, 35);
  const r0 = p.results[0];
  for (const k of schema.required) assert.ok(k in p, 'payload key ' + k);
  for (const k of schema.properties.results.items.required) assert.ok(k in r0, 'result key ' + k);
  assert.ok(p.deep_link.startsWith('?q='));
});

test('deep-link round-trip: build -> parse back identical', function () {
  const q = 'dark 140bpm trap for a fight scene';
  const link = S.buildDeepLink('https://cumulativewebinc.github.io/cwi-sonic-search/', q);
  const back = decodeURIComponent(new URL(link).searchParams.get('q'));
  assert.equal(back, q);
});

test('empty query returns the full 35-track catalog with honest labels intact', function () {
  const p = S.search('', data, {});
  assert.equal(p.result_count, 35);
  const labels = new Set(p.results.map(function (r) { return r.match_label; }));
  assert.ok(labels.has(S.TAG_ONLY_LABEL));
  assert.ok(labels.has('audio + tag match'));
});

test('format=json payload is JSON-serializable and self-describing', function () {
  const p = S.search('chill summer afrobeats', data, {});
  const round = JSON.parse(JSON.stringify(p));
  assert.equal(round.schema, 'cwi.sonic-result/1.0');
  assert.ok(typeof round.honest_limits === 'string' && round.honest_limits.length > 50);
});

// ------------------------------------------------- data integrity
test('data.json: 35 tracks, 6 with features, every track has >=1 editorial tag', function () {
  assert.equal(data.tracks.length, 35);
  assert.equal(data.tracks.filter(function (t) { return t.audio_features; }).length, 6);
  for (const t of data.tracks) {
    assert.ok(t.mood_tags.length >= 1, t.title + ' needs a mood tag');
    assert.ok(t.id && t.artist && t.title, t.title + ' needs id/artist/title');
  }
});

test('data.json feature values trace exactly to the ReccoBeats source file (no invention)', function () {
  const srcById = {};
  SOURCE.tracks.filter(function (t) { return t.features; }).forEach(function (t) { srcById[t.spotify_id] = t.features; });
  for (const t of data.tracks) {
    if (!t.audio_features) continue;
    const src = srcById[t.spotify_id];
    assert.ok(src, t.title + ' feature source must exist');
    for (const k of ['danceability', 'energy', 'valence', 'tempo_bpm', 'key', 'acousticness', 'instrumentalness', 'liveness', 'speechiness', 'loudness_db']) {
      assert.equal(t.audio_features[k], src[k], t.title + '.' + k + ' must match source');
    }
    assert.equal(t.audio_features.mode, src.mode);
    assert.equal(t.audio_features.key_pitch_class, src.key_pitch_class);
  }
});

test('index.html ships the honest-limits wording verbatim', function () {
  assert.ok(HTML.includes(S.HONEST_LIMITS), 'verbatim honest-limits panel');
});

test('index.html ships the clearance line, neutral chip text, and i18n hook', function () {
  assert.ok(HTML.includes('Sync licensing: one-stop via'), 'clearance line');
  assert.ok(HTML.includes('clearance on request'), 'neutral chip text');
  assert.ok(!HTML.toLowerCase().includes('unverified'), 'no red UNVERIFIED badge language');
  assert.ok(HTML.includes('data-app="sonic-search"'), 'i18n hook');
  assert.ok(HTML.includes('data-i18n='), 'data-i18n keys present');
  assert.ok(HTML.includes('format=json'), 'JSON endpoint documented');
});

test('Spotify URL coverage: all 24 That Boy Hi Hat tracks have verified embed URLs', function () {
  const tbhh = data.tracks.filter(function (t) { return t.artist === 'That Boy Hi Hat'; });
  assert.equal(tbhh.length, 24);
  for (const t of tbhh) {
    assert.ok(/^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+$/.test(t.spotify_url), t.title);
  }
});
