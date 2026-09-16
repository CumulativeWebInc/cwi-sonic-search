/* Sonic Search UI glue — loads data.json, runs the engine, renders results. */
(function () {
  'use strict';

  var DATA_URL = 'data.json';
  var params = new URLSearchParams(location.search);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function t(key) {
    try { return (window.CWI18n && window.CWI18n.t(key)) || null; } catch (e) { return null; }
  }

  function loadData(cb) {
    fetch(DATA_URL).then(function (r) { return r.json(); }).then(cb).catch(function () {
      document.getElementById('results').innerHTML =
        '<p class="result-count">Could not load the catalog dataset (data.json). Check your connection and reload.</p>';
    });
  }

  function sliderOpts() {
    var tMin = +document.getElementById('tempoMin').value;
    var tMax = +document.getElementById('tempoMax').value;
    var eMin = +document.getElementById('energyMin').value / 100;
    var eMax = +document.getElementById('energyMax').value / 100;
    var mode = document.getElementById('modeSel').value;
    var opts = {};
    if (tMin > 60 || tMax < 180) opts.tempo = { min: Math.min(tMin, tMax), max: Math.max(tMin, tMax), label: 'slider band' };
    if (eMin > 0 || eMax < 1) opts.energy = { min: Math.min(eMin, eMax), max: Math.max(eMin, eMax), label: 'slider band' };
    if (mode) opts.mode = mode;
    return opts;
  }

  function updateSliderLabels() {
    var tMin = +document.getElementById('tempoMin').value, tMax = +document.getElementById('tempoMax').value;
    var eMin = +document.getElementById('energyMin').value, eMax = +document.getElementById('energyMax').value;
    document.getElementById('tempoVal').textContent = (tMin === 60 && tMax === 180) ? 'any' : Math.min(tMin, tMax) + '–' + Math.max(tMin, tMax) + ' BPM';
    document.getElementById('energyVal').textContent = (eMin === 0 && eMax === 100) ? 'any' : (Math.min(eMin, eMax) / 100).toFixed(2) + '–' + (Math.max(eMin, eMax) / 100).toFixed(2);
  }

  function renderParsed(intent) {
    var panel = document.getElementById('parsedPanel');
    var box = document.getElementById('parsedChips');
    var chips = [];
    if (intent.tempo) chips.push('tempo: ' + intent.tempo.label);
    if (intent.energy) chips.push('energy: ' + intent.energy.label);
    if (intent.danceability) chips.push('danceability: ≥ ' + intent.danceability.min);
    if (intent.valence) chips.push('valence: ' + intent.valence.label);
    if (intent.key) chips.push('key: ' + intent.key.name);
    if (intent.mode) chips.push('mode: ' + intent.mode);
    intent.moods.forEach(function (m) { chips.push('mood: ' + m); });
    intent.artists.forEach(function (a) { chips.push('lane: ' + a); });
    if (!chips.length) { panel.hidden = true; return; }
    panel.hidden = false;
    box.innerHTML = chips.map(function (c) { return '<span class="parsed-chip">' + esc(c) + '</span>'; }).join('');
  }

  function renderResults(payload) {
    var box = document.getElementById('results');
    renderParsed(payload.parsed);
    var html = '<p class="result-count">' + payload.result_count + ' tracks ranked for “' + esc(payload.query || 'browse') + '” · audio features on ' +
      payload.coverage.with_audio_features + '/' + payload.coverage.total + ' tracks</p>';
    html += payload.results.map(function (r) {
      var embed = r.spotify_id
        ? '<iframe src="https://open.spotify.com/embed/track/' + esc(r.spotify_id) + '" loading="lazy" allow="encrypted-media" title="Spotify player"></iframe>'
        : '<p class="no-audio">No Spotify embed — no verified Spotify ID on file for this track.</p>';
      return '<article class="card' + (r.rank === 1 ? ' top' : '') + '">' +
        '<div class="card-head"><div><h3 class="card-title">' + esc(r.track) + '</h3>' +
        '<p class="card-artist">' + esc(r.artist) + '</p></div>' +
        '<span class="rank-badge">#' + r.rank + '</span></div>' +
        '<div class="score-bar"><div class="score-fill" style="width:' + r.score + '%"></div></div>' +
        '<span class="score-num">score ' + r.score.toFixed(1) + ' / 100</span>' +
        '<div class="reason">' + esc(r.reason) + '</div>' +
        '<div class="badges">' +
        '<span class="badge ' + (r.audio_features_present ? 'audio' : 'tagonly') + '">' + esc(r.match_label) + '</span>' +
        '<span class="badge clear">clearance on request</span>' +
        r.mood_tags.map(function (tag) { return '<span class="badge">#' + esc(tag) + '</span>'; }).join('') +
        '</div>' +
        embed +
        '<div class="card-actions">' +
        '<button data-share="' + esc(r.track) + '">Copy share link</button>' +
        (r.spotify_url ? '<a href="' + esc(r.spotify_url) + '" target="_blank" rel="noopener">Open in Spotify</a>' : '') +
        '<a href="mailto:hp@cumulativeweb.com?subject=' + encodeURIComponent('Sync license inquiry: ' + r.track + ' — ' + r.artist) + '">License this track</a>' +
        '</div></article>';
    }).join('');
    box.innerHTML = html;
    if (window.CWI18n && window.CWI18n.apply) window.CWI18n.apply();
    box.querySelectorAll('[data-share]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var link = SonicSearch.buildDeepLink(location.origin + location.pathname, document.getElementById('q').value.trim());
        var done = function () { btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy share link'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, done);
        else { prompt('Copy this link:', link); done(); }
      });
    });
  }

  function runSearch(data, q) {
    var payload = SonicSearch.search(q, data, sliderOpts());
    history.replaceState(null, '', '?q=' + encodeURIComponent(q));
    renderResults(payload);
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init(data) {
    // JSON endpoint mode: ?q=...&format=json returns machine-readable payload
    if (params.get('format') === 'json') {
      var payload = SonicSearch.search(params.get('q') || '', data, {});
      document.open();
      document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sonic Search JSON</title></head><body><pre class="json-pre" id="jp"></pre></body></html>');
      document.close();
      document.getElementById('jp').textContent = JSON.stringify(payload, null, 2);
      return;
    }
    ['tempoMin', 'tempoMax', 'energyMin', 'energyMax'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', updateSliderLabels);
    });
    document.getElementById('modeSel').addEventListener('change', function () {
      var q = document.getElementById('q').value.trim();
      if (q) runSearch(data, q);
    });
    updateSliderLabels();

    document.getElementById('searchBtn').addEventListener('click', function () {
      var q = document.getElementById('q').value.trim();
      if (!q) return;
      runSearch(data, q);
    });
    document.getElementById('clearBtn').addEventListener('click', function () {
      document.getElementById('q').value = '';
      document.getElementById('results').innerHTML = '';
      document.getElementById('parsedPanel').hidden = true;
      history.replaceState(null, '', location.pathname);
    });
    document.getElementById('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) document.getElementById('searchBtn').click();
    });
    document.querySelectorAll('.example').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('q').value = btn.getAttribute('data-q');
        runSearch(data, btn.getAttribute('data-q'));
      });
    });

    // deep link: ?q=...
    var q0 = params.get('q');
    if (q0) {
      document.getElementById('q').value = q0;
      var payload = SonicSearch.search(q0, data, {});
      renderResults(payload);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { loadData(init); });
  else loadData(init);
})();
