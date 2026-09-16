/* Sonic Search engine v1.0 — natural-language query parser + transparent scorer.
 * UMD: window.SonicSearch (browser) or module.exports (node tests).
 * Honesty rules baked in: scores cite actual measured values; tracks without
 * audio features NEVER receive numeric criterion scores — they match on
 * editorial tags only and say so in every reason string.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SonicSearch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HONEST_LIMITS = 'Audio features: 6/35 tracks, via ReccoBeats third-party analysis (2026-09-16) — not Spotify\'s, not ours. Tracks without features match on catalog tags only; nothing is estimated. Coverage grows as tracks enter ReccoBeats\' database.';
  var CLEARANCE_LINE = 'Sync licensing: one-stop via hp@cumulativeweb.com · terms confirmed on request';
  var RESULT_SCHEMA = 'cwi.sonic-result/1.0';
  var TAG_ONLY_LABEL = 'no audio features on file — tag match only';
  var DANCEABLE_BAR = 0.65;

  // ---------------------------------------------------------------- lexicon
  // query word -> editorial mood tags. Multi-word scene tokens handled by word scan.
  var LEXICON = {
    dark: ['dark'], aggressive: ['danger', 'tension', 'braggadocio'], hard: ['danger', 'tension'],
    chill: ['calm', 'dreamy'], mellow: ['calm', 'reflective'], relaxed: ['calm'],
    euphoric: ['triumph', 'anthem', 'hopeful'], uplifting: ['hopeful', 'triumph', 'anthem'],
    epic: ['epic', 'triumph'], melancholic: ['melancholic'], sad: ['melancholic', 'emotional', 'reflective'],
    somber: ['melancholic', 'reflective'], angry: ['danger', 'tension'],
    gritty: ['gritty', 'street'], raw: ['gritty', 'street'],
    party: ['party'], club: ['party', 'night', 'neon'], dance: ['party', 'high-energy'],
    luxury: ['luxury'], rich: ['luxury', 'money'], money: ['money', 'luxury'],
    noir: ['noir'], dreamy: ['dreamy'], night: ['night'], midnight: ['night', 'noir'],
    summer: ['summer'], intense: ['high-energy', 'tension'],
    fight: ['tension', 'danger', 'high-energy'], fighting: ['tension', 'danger', 'high-energy'],
    chase: ['tension', 'high-energy', 'danger'], heist: ['noir', 'tension', 'cinematic'],
    workout: ['high-energy', 'anthem'], gym: ['high-energy', 'anthem'], training: ['high-energy', 'anthem'],
    drive: ['night', 'city'], driving: ['night', 'city', 'high-energy'], car: ['night', 'city'],
    reflective: ['reflective'], hopeful: ['hopeful'], hope: ['hopeful'],
    rebellious: ['rebellious', 'street'], rebel: ['rebellious', 'street'],
    romantic: ['romance', 'seductive'], romance: ['romance'], seductive: ['seductive'],
    cinematic: ['cinematic', 'epic'], film: ['cinematic'], movie: ['cinematic'],
    anthem: ['anthem', 'triumph'], anthemic: ['anthem', 'triumph'],
    street: ['street'], urban: ['street', 'city'], tension: ['tension'], tense: ['tension'],
    danger: ['danger'], dangerous: ['danger'], triumph: ['triumph'], triumphant: ['triumph'],
    victory: ['triumph', 'anthem'], celebrate: ['party', 'triumph'], celebration: ['party', 'triumph'],
    neon: ['neon'], city: ['city'], supernatural: ['supernatural'], ghost: ['supernatural'],
    psychedelic: ['psychedelic'], surreal: ['surreal'], moody: ['moody', 'melancholic'],
    calm: ['calm'], emotional: ['emotional'], pain: ['melancholic', 'emotional', 'gritty'],
    tears: ['melancholic', 'emotional'], scars: ['melancholic', 'emotional'],
    braggadocio: ['braggadocio'], brag: ['braggadocio'], flex: ['braggadocio'],
    sports: ['sports'], basketball: ['sports'], extreme: ['extreme-sports', 'high-energy'],
    adrenaline: ['adrenaline', 'high-energy'], stunt: ['adrenaline', 'extreme-sports'],
    island: ['island'], tropical: ['island', 'summer'],
    war: ['warrior', 'tension'], warrior: ['warrior'],
    shadow: ['dark', 'supernatural'], shadows: ['dark', 'supernatural'],
    angel: ['supernatural', 'triumph'], demon: ['dark', 'danger'], devil: ['dark', 'danger'],
    toxic: ['dark', 'danger'], wicked: ['dark', 'danger'],
    dream: ['dreamy'], dreams: ['dreamy'], monaco: ['luxury', 'cinematic'],
    roses: ['romance', 'luxury'], diamond: ['luxury'], diamonds: ['luxury'],
    gold: ['luxury'], golden: ['luxury'], star: ['celebrity', 'triumph'],
    goat: ['braggadocio'], goated: ['braggadocio', 'triumph'], solid: ['loyalty', 'street'],
    loyalty: ['loyalty'], moon: ['night', 'supernatural'], fast: ['high-energy'],
    flame: ['braggadocio', 'high-energy'], neonlights: ['neon'],
    power: ['power', 'anthem'], mystic: ['mystic', 'supernatural'], element: ['power', 'mystic']
  };

  // artist / lane words -> artist names
  var LANES = {
    trap: 'That Boy Hi Hat', 'alt-rap': 'That Boy Hi Hat', 'alternative rap': 'That Boy Hi Hat',
    'post-trap': 'That Boy Hi Hat', hihat: 'That Boy Hi Hat', 'hi hat': 'That Boy Hi Hat',
    'rap rock': '183 Wildboi', 'rap-rock': '183 Wildboi', rock: '183 Wildboi', wildboi: '183 Wildboi',
    afrobeats: 'Dre50', afrobeat: 'Dre50', jamaican: 'Dre50', jamaica: 'Dre50',
    'king akeem': 'King Akeem', akeem: 'King Akeem', dre50: 'Dre50'
  };

  var STOPWORDS = { a: 1, an: 1, the: 1, and: 1, or: 1, for: 1, of: 1, in: 1, on: 1, with: 1, to: 1, i: 1, want: 1, need: 1, something: 1, like: 1, that: 1, sounds: 1, sound: 1, song: 1, songs: 1, track: 1, tracks: 1, music: 1, scene: 1, please: 1, give: 1, me: 1, find: 1, show: 1 };

  var PITCH = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

  function words(q) {
    return (q || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9#.\-\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function fmtNum(x, digits) {
    var s = Number(x).toFixed(digits === undefined ? 2 : digits);
    return s.replace(/\.?0+$/, '');
  }

  // ------------------------------------------------------------------ parser
  function parseQuery(raw) {
    var intent = {
      raw: raw || '', tempo: null, energy: null, danceability: null, valence: null,
      mode: null, key: null, moods: [], artists: [], numericChips: false
    };
    var q = (raw || '').toLowerCase();
    var w = words(raw);
    var moodSet = {}, artistSet = {};

    // -- tempo: explicit ranges "140-150 bpm", single "140bpm" (+-10), keywords
    var m = q.match(/(\d{2,3})\s*-\s*(\d{2,3})\s*bpm/);
    if (m) {
      intent.tempo = { min: Math.min(+m[1], +m[2]), max: Math.max(+m[1], +m[2]), label: m[1] + '–' + m[2] + ' band' };
    } else {
      m = q.match(/(\d{2,3})\s*bpm/);
      if (m) {
        var n = +m[1];
        intent.tempo = { min: n - 10, max: n + 10, label: (n - 10) + '–' + (n + 10) + ' band' };
      }
    }
    if (!intent.tempo) {
      if (/\bslow\b/.test(q)) intent.tempo = { min: 0, max: 100, label: 'slow (<100 BPM)' };
      else if (/\bmid[\s-]?tempo\b/.test(q)) intent.tempo = { min: 100, max: 130, label: 'mid-tempo (100–130 BPM)' };
      else if (/\b(fast|uptempo|up-tempo|upbeat)\b/.test(q)) intent.tempo = { min: 130, max: 250, label: 'fast (130+ BPM)' };
    }

    // -- energy bands
    if (/\bhigh energy\b/.test(q)) intent.energy = { min: 0.7, max: 1.0, label: "'high energy' bar" };
    else if (/\b(low energy|laid[\s-]?back|mellow)\b/.test(q)) intent.energy = { min: 0.0, max: 0.4, label: "'low energy' bar" };
    else if (/\b(mid|medium) energy\b/.test(q)) intent.energy = { min: 0.4, max: 0.7, label: "'mid energy' band" };
    else if (/\benergetic\b/.test(q)) intent.energy = { min: 0.6, max: 1.0, label: "'energetic' bar" };

    // -- danceability
    if (/\bdanceable\b/.test(q)) intent.danceability = { min: DANCEABLE_BAR, label: "'danceable' bar" };
    else if (/\bgroovy\b/.test(q)) intent.danceability = { min: 0.6, label: "'groovy' bar" };

    // -- valence (mood brightness)
    if (/\b(euphoric|uplifting|happy|joyful|bright)\b/.test(q)) intent.valence = { min: 0.6, max: 1.0, label: "'bright' valence bar" };
    else if (/\b(sad|melancholic|somber|bleak)\b/.test(q)) intent.valence = { min: 0.0, max: 0.35, label: "'melancholic' valence bar" };

    // -- mode
    if (/\bminor\b/.test(q)) intent.mode = 'minor';
    else if (/\bmajor\b/.test(q)) intent.mode = 'major';

    // -- key: "C# minor", "Db", "A# major" — require accidental or mode word
    var km = q.match(/\b([a-g])([#b])?\s*(minor|major|min\b|maj\b)?/);
    if (km && (km[2] || km[3])) {
      var pcName = km[1].toUpperCase() + (km[2] || '');
      if (PITCH[pcName] !== undefined) {
        intent.key = { pitchClass: PITCH[pcName], name: pcName };
        if (!intent.mode) {
          if (km[3] && km[3].indexOf('min') === 0) intent.mode = 'minor';
          else if (km[3] && km[3].indexOf('maj') === 0) intent.mode = 'major';
        }
      }
    }

    // -- mood lexicon + lanes over word scan
    var seenLanePhrases = {};
    Object.keys(LANES).forEach(function (phrase) {
      if (q.indexOf(phrase) !== -1 && !seenLanePhrases[phrase]) {
        seenLanePhrases[phrase] = 1;
        artistSet[LANES[phrase]] = 1;
      }
    });
    w.forEach(function (tok) {
      if (STOPWORDS[tok]) return;
      if (LEXICON[tok]) LEXICON[tok].forEach(function (t) { moodSet[t] = 1; });
      // "chill" also implies low energy
      if (tok === 'chill' && !intent.energy) intent.energy = { min: 0.0, max: 0.45, label: "'chill' energy bar" };
    });
    intent.moods = Object.keys(moodSet);
    intent.artists = Object.keys(artistSet);
    return intent;
  }

  // ------------------------------------------------------------------ scorer
  function scoreTrack(track, intent) {
    var f = track.audio_features || null;
    var comps = [];   // {criterion, weight, score|null, note}
    var clauses = [];

    function numericCriterion(criterion, label, weight, value, band, unit) {
      if (!f) {
        comps.push({ criterion: criterion, weight: weight, score: null, note: 'no ' + criterion + ' data on file — numeric criterion not scored' });
        return;
      }
      var s, note;
      if (value >= band.min && value <= band.max) {
        s = 1;
        note = criterion + ' ' + fmtNum(value, unit === 'BPM' ? 0 : 2) + (unit ? ' ' + unit : '') + ' matches ' + band.label;
      } else {
        var d = value < band.min ? band.min - value : value - band.max;
        var span = unit === 'BPM' ? 40 : 0.5;
        s = Math.max(0, 1 - d / span);
        var dir = value < band.min ? 'below' : 'above';
        note = criterion + ' ' + fmtNum(value, unit === 'BPM' ? 0 : 2) + (unit ? ' ' + unit : '') + ' ' + dir + ' your ' + band.label + ' — ranked lower for that reason';
      }
      comps.push({ criterion: criterion, weight: weight, score: s, note: note });
      clauses.push(note);
    }

    if (intent.tempo) numericCriterion('tempo', 'tempo', 3, f && f.tempo_bpm, intent.tempo, 'BPM');
    if (intent.energy) numericCriterion('energy', 'energy', 3, f && f.energy, intent.energy, null);
    if (intent.danceability) numericCriterion('danceability', 'danceability', 3, f && f.danceability, { min: intent.danceability.min, max: 1.0, label: intent.danceability.label + ' (' + fmtNum(intent.danceability.min) + ')' }, null);
    if (intent.valence) numericCriterion('valence', 'valence', 2, f && f.valence, intent.valence, null);

    if (intent.mode) {
      if (!f) comps.push({ criterion: 'mode', weight: 2, score: null, note: 'no mode data on file — numeric criterion not scored' });
      else {
        var ms = f.mode === intent.mode ? 1 : 0;
        comps.push({ criterion: 'mode', weight: 2, score: ms, note: 'mode ' + f.mode + (ms ? ' matches' : ' does not match your \'' + intent.mode + '\' filter') });
        clauses.push('mode ' + f.mode + (ms ? ' matches' : ' ≠ ' + intent.mode));
      }
    }
    if (intent.key) {
      if (!f) comps.push({ criterion: 'key', weight: 2, score: null, note: 'no key data on file — numeric criterion not scored' });
      else {
        var ks = f.key === intent.key.pitchClass ? 1 : 0;
        comps.push({ criterion: 'key', weight: 2, score: ks, note: 'key ' + f.key_pitch_class + ' ' + f.mode + (ks ? ' matches your ' + intent.key.name + ' request' : ' ≠ your ' + intent.key.name + ' request') });
        clauses.push('key ' + f.key_pitch_class + ' ' + f.mode + (ks ? ' matches' : ' ≠ ' + intent.key.name));
      }
    }

    if (intent.moods.length) {
      var hits = intent.moods.filter(function (t) { return track.mood_tags.indexOf(t) !== -1; });
      var mscore = hits.length / intent.moods.length;
      comps.push({ criterion: 'mood', weight: 2, score: mscore, note: hits.length ? 'tag' + (hits.length > 1 ? 's' : '') + ' matched: ' + hits.map(function (h) { return '"' + h + '"'; }).join(', ') + ' (editorial)' : 'no mood tags matched (editorial)' });
      if (hits.length) clauses.push('tag' + (hits.length > 1 ? 's' : '') + ' ' + hits.map(function (h) { return '"' + h + '"'; }).join(', ') + ' matched (editorial)');
    }

    if (intent.artists.length) {
      var as = intent.artists.indexOf(track.artist) !== -1 ? 1 : 0;
      comps.push({ criterion: 'lane', weight: 1, score: as, note: as ? 'artist lane matches: ' + track.artist : 'artist lane: ' + track.artist + ' (no lane requested for it)' });
      if (as) clauses.push('lane: ' + track.artist);
    }

    var num = 0, den = 0;
    comps.forEach(function (c) { if (c.score !== null) { num += c.weight * c.score; den += c.weight; } });
    var total = den > 0 ? (num / den) * 100 : 0;

    // "also on file" transparency tail for feature tracks
    if (f) {
      clauses.push('also on file: tempo ' + Math.round(f.tempo_bpm) + ' BPM · key ' + f.key_pitch_class + ' ' + f.mode + ' · energy ' + fmtNum(f.energy) + ' · danceability ' + fmtNum(f.danceability) + ' · valence ' + fmtNum(f.valence));
    }

    var reason;
    if (!f) {
      var base = [TAG_ONLY_LABEL];
      var unscored = comps.filter(function (c) { return c.score === null; }).map(function (c) { return c.criterion; });
      if (unscored.length) base.push('could not score: ' + unscored.join(', ') + ' (no data)');
      comps.forEach(function (c) {
        if (c.criterion === 'mood') base.push(c.note);
        else if (c.criterion === 'lane' && c.score === 1) base.push(c.note);
      });
      reason = base.join(' · ');
    } else {
      reason = clauses.length ? clauses.join(' · ') : 'no criteria matched — ranked on catalog presence only';
    }

    return {
      track_id: track.id,
      score: Math.round(total * 10) / 10,
      breakdown: comps,
      reason: reason,
      audio_features_present: !!f,
      match_label: f ? 'audio + tag match' : TAG_ONLY_LABEL
    };
  }

  function search(query, data, opts) {
    opts = opts || {};
    var tracks = data.tracks || [];
    var intent = parseQuery(query);
    if (opts.tempo) { intent.tempo = opts.tempo; intent.numericChips = true; }
    if (opts.energy) { intent.energy = opts.energy; intent.numericChips = true; }
    if (opts.mode) intent.mode = opts.mode;

    var scored = tracks.map(function (t) {
      var s = scoreTrack(t, intent);
      return {
        rank: 0, track: t.title, artist: t.artist, track_id: t.id,
        spotify_id: t.spotify_id || null, spotify_url: t.spotify_url || null,
        score: s.score, audio_features_present: s.audio_features_present,
        match_label: s.match_label, mood_tags: t.mood_tags,
        audio_features: t.audio_features || null,
        breakdown: s.breakdown, reason: s.reason
      };
    });

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.audio_features_present !== a.audio_features_present) return b.audio_features_present - a.audio_features_present;
      return a.track < b.track ? -1 : 1;
    });
    scored.forEach(function (r, i) { r.rank = i + 1; });

    var limit = opts.limit || 10;
    return {
      schema: RESULT_SCHEMA,
      app: 'Sonic Search',
      query: query,
      deep_link: '?q=' + encodeURIComponent(query),
      parsed: intent,
      coverage: { with_audio_features: 6, total: tracks.length, source: "ReccoBeats third-party analysis (2026-09-16)" },
      honest_limits: HONEST_LIMITS,
      clearance: CLEARANCE_LINE,
      results: scored.slice(0, limit),
      result_count: scored.length
    };
  }

  function buildDeepLink(base, query) {
    return base.replace(/\/$/, '') + '/?q=' + encodeURIComponent(query);
  }

  return {
    parseQuery: parseQuery,
    scoreTrack: scoreTrack,
    search: search,
    buildDeepLink: buildDeepLink,
    HONEST_LIMITS: HONEST_LIMITS,
    CLEARANCE_LINE: CLEARANCE_LINE,
    RESULT_SCHEMA: RESULT_SCHEMA,
    TAG_ONLY_LABEL: TAG_ONLY_LABEL,
    DANCEABLE_BAR: DANCEABLE_BAR
  };
});
