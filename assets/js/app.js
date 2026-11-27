/*!
 * MYENG Studio — UI layer (REV 04)
 * All calculations are delegated to MyengEngine (engine.js).
 * No storage, no cookies, no analytics. API keys live in closure memory only.
 */
(function () {
  'use strict';

  var E = window.MyengEngine;
  var doc = document;
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MINUS = '−';

  /* ================================================================
     Sample engineering case study (illustrative figures, editable)
     ================================================================ */
  var SAMPLE = {
    project: { tag: 'P-4101 A/B', service: 'Process water transfer, API 610 OH2', rpm: 2980 },
    duty: { Q: 420, H: 68, hours: 8000, tariff: 0.11, horizon: 10 },
    basis: { rho: 998, minEff: 76, material: 'S-6', minMawp: 40, maxLead: 24, ef: 0.55 },
    hyd: {
      D: 254.5, L: 1200, eps: 0.045, zStatic: 30, mu: 1.0, K: 18,
      Psurf: 101.325, Pvap: 3.17, zs: -3.0, Ds: 303.2, Ls: 12, Ks: 2.5,
      shutoff: 1.18, vfdEff: 97, speed: 92, vendor: 'rec'
    },
    bids: [
      { vendor: 'Bidder A', model: 'OH2-300', capex: 186000, etaBep: 82.5, qBep: 440, etaMotor: 96.0, material: 'S-6', mawp: 40, npshr: 4.2, motorKw: 132, maint: 6800, lead: 18 },
      { vendor: 'Bidder B', model: 'OH2-260', capex: 142000, etaBep: 76.0, qBep: 470, etaMotor: 95.4, material: 'S-1', mawp: 20, npshr: 3.6, motorKw: 110, maint: 5200, lead: 12 },
      { vendor: 'Bidder C', model: 'OH2-220', capex: 158000, etaBep: 80.0, qBep: 400, etaMotor: 95.8, material: 'S-6', mawp: 25, npshr: 5.8, motorKw: 110, maint: 6100, lead: 22 }
    ]
  };

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var SAMPLE2 = {
    project: { tag: 'P-2201 A/B', service: 'Cooling water circulation, ISO 5199', rpm: 1480 },
    duty: { Q: 180, H: 42, hours: 7200, tariff: 0.09, horizon: 10 },
    basis: { rho: 998, minEff: 72, material: 'I-2', minMawp: 16, maxLead: 16, ef: 0.55 },
    hyd: {
      D: 202.7, L: 640, eps: 0.045, zStatic: 22, mu: 0.9, K: 14,
      Psurf: 101.325, Pvap: 4.25, zs: 1.5, Ds: 254.5, Ls: 8, Ks: 1.8,
      shutoff: 1.22, vfdEff: 97, speed: 90, vendor: 'rec'
    },
    bids: [
      { vendor: 'Bidder D', model: 'ES 150-315', capex: 38500, etaBep: 78.5, qBep: 195, etaMotor: 94.6, material: 'I-2', mawp: 16, npshr: 3.1, motorKw: 37, maint: 1900, lead: 10 },
      { vendor: 'Bidder E', model: 'ES 125-250', capex: 31200, etaBep: 74.0, qBep: 150, etaMotor: 93.9, material: 'I-1', mawp: 16, npshr: 4.4, motorKw: 30, maint: 1600, lead: 8 },
      { vendor: 'Bidder F', model: 'ES 150-250', capex: 35800, etaBep: 76.5, qBep: 205, etaMotor: 94.2, material: 'I-2', mawp: 10, npshr: 2.8, motorKw: 37, maint: 1750, lead: 18 }
    ]
  };
  var TEMPLATES = {
    p01: { name: 'Package 01 · API 610 Process Pump (420 m³/h @ 68 m)', state: SAMPLE },
    p02: { name: 'Package 02 · ISO 5199 Cooling Water Pump (180 m³/h @ 42 m)', state: SAMPLE2 }
  };
  var state = clone(SAMPLE);

  /* ================================================================
     Workspace: multiple bid packages, persisted with localStorage only
     ================================================================ */
  var STORE_KEY = 'myeng.workspace.v1';
  var ws = { active: null, projects: [] };
  var storageOk = true;
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fromTemplate(key, name) {
    var t = TEMPLATES[key];
    return { id: uid(), name: name || t.name, template: key, updated: Date.now(), state: clone(t.state) };
  }
  // Fill any missing fields from the template so older saves keep working.
  function normalise(p) {
    var base = TEMPLATES[p.template] ? TEMPLATES[p.template].state : SAMPLE;
    var st = p.state && typeof p.state === 'object' ? p.state : {};
    ['project', 'duty', 'basis', 'hyd'].forEach(function (k) { st[k] = Object.assign({}, base[k], st[k] || {}); });
    if (!Array.isArray(st.bids) || st.bids.length !== 3) st.bids = clone(base.bids);
    st.bids = st.bids.map(function (b, i) { return Object.assign({}, base.bids[i], b); });
    p.state = st;
    if (!p.name) p.name = 'Untitled package';
    return p;
  }
  function storeRead() {
    try { var raw = window.localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { storageOk = false; return null; }
  }
  function storeWrite() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(ws)); storageOk = true; return true; }
    catch (e) { storageOk = false; return false; }
  }
  function seedWorkspace() {
    ws = { active: null, projects: [fromTemplate('p01'), fromTemplate('p02')] };
    ws.active = ws.projects[0].id;
  }
  function initWorkspace() {
    var saved = storeRead();
    if (saved && Array.isArray(saved.projects) && saved.projects.length) {
      ws = { active: saved.active, projects: saved.projects.filter(function (p) { return p && typeof p === 'object'; }).map(normalise) };
      if (!ws.projects.length) seedWorkspace();
      if (!ws.projects.some(function (p) { return p.id === ws.active; })) ws.active = ws.projects[0].id;
    } else seedWorkspace();
    storeWrite();
    state = clone(currentProject().state);
  }
  function currentProject() {
    for (var i = 0; i < ws.projects.length; i++) if (ws.projects[i].id === ws.active) return ws.projects[i];
    return ws.projects[0];
  }
  var saveTimer = 0;
  function saveSoon() {
    clearTimeout(saveTimer);
    var el = $('#savedState');
    saveTimer = setTimeout(function () {
      var p = currentProject();
      if (!p) return;
      p.state = clone(state); p.updated = Date.now();
      var ok = storeWrite();
      if (el) el.textContent = ok ? 'Saved' : 'Not saved (browser storage unavailable)';
    }, 450);
  }
  function switchProject(id, silent) {
    var p = currentProject();
    if (p) { p.state = clone(state); p.updated = Date.now(); }
    ws.active = id;
    storeWrite();
    state = clone(currentProject().state);
    swapIn();
    if (!silent) toast('Opened ' + currentProject().name + '.');
  }
  // Replace the whole working state: no count-up animation, nothing half-way.
  function swapIn() {
    settleRolls(); rollOff = true;
    try { buildMatrix(); recompute(); syncInputs(); renderProjects(); }
    finally { rollOff = false; }
  }
  function openTemplateProject(key) {
    var found = ws.projects.filter(function (p) { return p.template === key && p.name === TEMPLATES[key].name; })[0];
    if (!found) { found = fromTemplate(key); ws.projects.unshift(found); }
    switchProject(found.id, true);
  }
  function fmtDate(t) {
    var d = new Date(t);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function renderProjects() {
    var p = currentProject();
    var parts = p.name.split(' · ');
    // the duty in brackets never breaks, so "m)" can't be orphaned on a narrow screen
    var dutyNw = function (t) { return esc(t).replace(/\(([^()]*)\)/g, '<span class="nw">($1)</span>'); };
    $('#projName').innerHTML = parts.length > 1 ? '<b>' + esc(parts[0]) + '</b> <span>' + dutyNw(parts.slice(1).join(' · ')) + '</span>' : '<b>' + dutyNw(p.name) + '</b>';
    $('#projList').innerHTML = ws.projects.map(function (q) {
      return '<li><button type="button" class="proj__item' + (q.id === ws.active ? ' is-active' : '') + '" data-pid="' + q.id + '">' +
        '<span class="proj__iname">' + esc(q.name) + '</span><span class="proj__meta mono">' + esc(q.state.project.tag) + ' · ' + fmtDate(q.updated) + '</span></button></li>';
    }).join('');
    $('#btnResetTpl').hidden = !(p.template && TEMPLATES[p.template]);
  }
  function setMenu(open) {
    var m = $('#projMenu'), b = $('#projBtn');
    m.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) { $('#projRenameWrap').hidden = true; armed = null; $$('[data-pa]').forEach(function (x) { x.classList.remove('is-armed'); }); restoreLabels(); }
  }
  var armed = null;
  function restoreLabels() {
    var d = $('[data-pa="delete"]'), c = $('[data-pa="clear"]');
    if (d) d.textContent = 'Delete';
    if (c) c.textContent = 'Clear local data';
  }
  function bindProjects() {
    renderProjects();
    $('#projBtn').addEventListener('click', function (e) { e.stopPropagation(); setMenu($('#projMenu').hidden); });
    doc.addEventListener('click', function (e) { if (!$('#projMenu').hidden && !e.target.closest('#proj')) setMenu(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#projMenu').hidden) { setMenu(false); $('#projBtn').focus(); e.stopPropagation(); } }, true);
    $('#projList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pid]'); if (!b) return;
      setMenu(false);
      if (b.getAttribute('data-pid') !== ws.active) switchProject(b.getAttribute('data-pid'));
    });
    $('#projRenameSave').addEventListener('click', doRename);
    $('#projRename').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doRename(); } });
    function doRename() {
      var v = $('#projRename').value.trim();
      if (!v) { $('#projRename').classList.add('is-invalid'); return; }
      currentProject().name = v; currentProject().updated = Date.now();
      storeWrite(); renderProjects(); setMenu(false); toast('Renamed to ' + v + '.');
    }
    $('#projMenu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pa]'); if (!b) return;
      e.stopPropagation();
      var a = b.getAttribute('data-pa'), p = currentProject();
      if (a === 'rename') { $('#projRenameWrap').hidden = false; $('#projRename').value = p.name; $('#projRename').classList.remove('is-invalid'); $('#projRename').focus(); $('#projRename').select(); }
      if (a === 'duplicate') {
        p.state = clone(state);
        var c = { id: uid(), name: p.name.replace(/( \(copy\))*$/, '') + ' (copy)', template: null, updated: Date.now(), state: clone(state) };
        ws.projects.splice(ws.projects.indexOf(p) + 1, 0, c);
        setMenu(false); switchProject(c.id);
      }
      if (a === 'new') { var n = fromTemplate(b.getAttribute('data-t')); ws.projects.push(n); setMenu(false); switchProject(n.id); }
      if (a === 'delete') {
        if (ws.projects.length < 2) { toast('Keep at least one bid package.'); return; }
        if (armed !== 'delete') { armed = 'delete'; b.textContent = 'Confirm delete'; b.classList.add('is-armed'); return; }
        var idx = ws.projects.indexOf(p), gone = p.name;
        ws.projects.splice(idx, 1);
        ws.active = ws.projects[Math.max(0, idx - 1)].id;
        state = clone(currentProject().state);
        storeWrite(); setMenu(false); swapIn();
        toast('Deleted ' + gone + '.');
      }
      if (a === 'clear') {
        if (armed !== 'clear') { armed = 'clear'; b.textContent = 'Click again to clear'; b.classList.add('is-armed'); return; }
        try { window.localStorage.removeItem(STORE_KEY); } catch (err) { /* storage unavailable */ }
        seedWorkspace(); storeWrite(); state = clone(currentProject().state);
        setMenu(false); swapIn();
        toast('Local data cleared. Templates restored.');
      }
    });
    $('#btnResetTpl').addEventListener('click', function () {
      var p = currentProject(); if (!p.template || !TEMPLATES[p.template]) return;
      state = clone(TEMPLATES[p.template].state);
      swapIn();
      toast('Reset ' + p.name + ' to its template values.');
    });
  }
  var result = null, study = null;

  /* ================================================================
     Formatting
     ================================================================ */
  function num(v, d) {
    if (!isFinite(v)) return '—';
    var s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
    return (v < 0 && Number(s.replace(/,/g, '')) !== 0 ? MINUS : '') + s;
  }
  function money(v, signed) {
    if (!isFinite(v)) return '—';
    var r = Math.round(v);
    var s = '$' + Math.abs(r).toLocaleString('en-US');
    if (r < 0) return MINUS + s;
    if (signed && r > 0) return '+' + s;
    return s;
  }
  function moneyShort(v) {
    var a = Math.abs(v), sign = v < 0 ? MINUS : '';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return sign + '$' + (a / 1e3).toFixed(1) + 'k';
    return sign + '$' + Math.round(a).toLocaleString('en-US');
  }
  function sci(v) {
    if (!isFinite(v) || v <= 0) return '—';
    var e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e);
    return m.toFixed(2) + '×10' + String(e).split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; }).join('');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function bidName(i) {
    var b = state.bids[i], v = (b.vendor || '').trim(), m = (b.model || '').trim();
    if (v && m) return v + ' (' + m + ')';
    return v || m || ('Bid ' + 'ABC'[i]);
  }
  function bidNameH(i) {
    var b = state.bids[i], v = (b.vendor || '').trim(), m = (b.model || '').trim();
    if (v && m) return esc(v) + '<span class="nw">&nbsp;(' + esc(m) + ')</span>';
    return esc(bidName(i));
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function dutyLabel() { return num(state.duty.Q) + ' m³/h @ ' + num(state.duty.H) + ' m'; }

  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    var t = ks.reduce(function (a, k) { return a[k]; }, o);
    t[last] = v;
  }

  /* ================================================================
     Toast
     ================================================================ */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ================================================================
     Recompute pipeline
     ================================================================ */
  var rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; recompute(); });
  }
  function hydBidIndex() {
    var v = state.hyd.vendor;
    return v === 'rec' ? result.recommended : Number(v);
  }
  function recompute() {
    result = E.evaluate(state);
    study = E.hydraulicStudy(state, hydBidIndex());
    renderCase();
    updateMatrix();
    renderKpis();
    renderBars();
    renderHyd();
    renderTwin();
    renderStrip();
    syncSelects();
    renderStory();
    saveSoon();
    syncSliderLabels();
  }

  /* ================================================================
     Sliders
     ================================================================ */
  var sliders = [];
  // Recessed full-height slider: label left, editable value right, slim silver thumb.
  function makeSlider(host, cfg) {
    var id = 'sl-' + cfg.key.replace(/\W/g, '-');
    var wrap = doc.createElement('div');
    wrap.className = 'rs';
    wrap.innerHTML =
      '<div class="rs__track">' +
      '<div class="rs__head"><label class="rs__label" for="' + id + '">' + cfg.label + '</label>' +
      '<span class="rs__val"><input type="text" inputmode="decimal" class="rs__num" aria-label="' + cfg.label.replace(/<[^>]+>/g, '') + ' value" spellcheck="false"><span class="rs__unit">' + cfg.unit + '</span></span></div>' +
      '<div class="rs__rail"><span class="rs__fill" aria-hidden="true"></span><span class="rs__thumb" aria-hidden="true"></span>' +
      '<input type="range" id="' + id + '" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.step + '"></div>' +
      '</div>';
    host.appendChild(wrap);
    var input = $('input[type=range]', wrap), numEl = $('.rs__num', wrap), track = $('.rs__track', wrap);
    var s = { cfg: cfg, input: input, out: numEl, last: null };
    s.sync = function () {
      var v = cfg.get();
      if (doc.activeElement !== input || String(v) !== input.value) input.value = v;
      var txt = cfg.fmt(v);
      if (txt !== s.last && doc.activeElement !== numEl) { numEl.value = txt; s.last = txt; }
      numEl.style.width = 'calc(' + Math.max(3, String(numEl.value).length) + 'ch + 12px)';
      var f = (v - cfg.min) / (cfg.max - cfg.min);
      track.style.setProperty('--p', (f * 100).toFixed(2) + '%');
      track.style.setProperty('--pf', f.toFixed(4));
    };
    input.addEventListener('input', function () {
      cfg.set(parseFloat(input.value));
      s.sync();
      cfg.after();
    });
    input.addEventListener('pointerdown', function () { track.classList.add('is-drag'); });
    window.addEventListener('pointerup', function () { track.classList.remove('is-drag'); });
    // typed value: commit on Enter / blur, clamp to the slider range
    function commit() {
      var v = parseFloat(String(numEl.value).replace(/[,\s]/g, ''));
      if (!isFinite(v)) { s.last = null; s.sync(); return; }
      v = Math.min(cfg.max, Math.max(cfg.min, v));
      cfg.set(v); s.last = null; numEl.blur(); s.sync(); cfg.after();
    }
    numEl.addEventListener('focus', function () { numEl.select(); track.classList.add('is-edit'); });
    numEl.addEventListener('blur', function () { track.classList.remove('is-edit'); commit(); });
    numEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { s.last = null; numEl.blur(); }
    });
    sliders.push(s);
    s.sync();
    return s;
  }
  function syncSliderLabels() { sliders.forEach(function (s) { s.sync(); }); }

  function buildSliders() {
    var host = $('#dutySliders');
    var cfgs = [
      { key: 'duty.Q', label: 'Flow rate Q', unit: 'm³/h', min: 100, max: 800, step: 5, fmt: function (v) { return num(v); } },
      { key: 'duty.H', label: 'Total head H', unit: 'm', min: 20, max: 160, step: 1, fmt: function (v) { return num(v); } },
      { key: 'duty.hours', label: 'Operating hours', unit: 'h/yr', min: 1000, max: 8760, step: 20, fmt: function (v) { return num(v); } },
      { key: 'duty.tariff', label: 'Electricity tariff', unit: '$/kWh', min: 0.02, max: 0.30, step: 0.005, fmt: function (v) { return v.toFixed(3); } },
      { key: 'duty.horizon', label: 'Evaluation horizon', unit: 'yrs', min: 5, max: 20, step: 1, fmt: function (v) { return num(v); } }
    ];
    cfgs.forEach(function (c) {
      c.get = function () { return getPath(state, c.key); };
      c.set = function (v) { setPath(state, c.key, v); };
      c.after = schedule;
      makeSlider(host, c);
    });
    makeSlider($('#vfdSlider'), {
      key: 'hyd.speed', label: 'VFD speed N/N<sub>rated</sub>', unit: '%', min: 60, max: 100, step: 1,
      fmt: function (v) { return num(v); },
      get: function () { return state.hyd.speed; }, set: function (v) { state.hyd.speed = v; }, after: schedule
    });
  }

  /* ================================================================
     Generic bound inputs  [data-path]
     ================================================================ */
  function moneyIn(v) { return isFinite(v) ? '$' + Math.round(v).toLocaleString('en-US') : ''; }
  // currency cells show "$186,000" at rest and the raw number while being edited
  doc.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute('data-money')) { var v = getPath(state, el.getAttribute('data-path')); el.value = isFinite(v) ? String(v) : el.value; try { el.select(); } catch (x) { /* noop */ } }
  });
  doc.addEventListener('focusout', function (e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute('data-money') && !el.classList.contains('is-invalid')) el.value = moneyIn(getPath(state, el.getAttribute('data-path')));
  });
  function syncInputs() {
    $$('[data-path]').forEach(function (el) {
      var v = getPath(state, el.getAttribute('data-path'));
      if (doc.activeElement !== el) el.value = el.hasAttribute('data-money') ? moneyIn(v) : v;
      el.classList.remove('is-invalid');
    });
    $('#hydVendor').value = String(state.hyd.vendor);
  }
  function onBoundInput(e) {
    var el = e.target;
    if (!el.matches || !el.matches('[data-path]')) return;
    var path = el.getAttribute('data-path');
    if (el.getAttribute('data-type') === 'text' || el.tagName === 'SELECT') {
      setPath(state, path, el.value);
    } else {
      var isM = el.hasAttribute('data-money');
      var v = parseFloat(isM ? String(el.value).replace(/[$,\s]/g, '') : el.value);
      var lo = isM ? el.getAttribute('data-min') : el.min;
      var bad = !isFinite(v) || (lo !== '' && lo != null && v < parseFloat(lo)) || (!isM && el.max !== '' && v > parseFloat(el.max));
      el.classList.toggle('is-invalid', bad);
      if (bad) return;
      setPath(state, path, v);
      // keep duplicated fields (e.g. density appears twice) in sync
      $$('[data-path="' + path + '"]').forEach(function (o) { if (o !== el) o.value = o.hasAttribute('data-money') ? moneyIn(v) : v; });
    }
    schedule();
  }

  /* ================================================================
     TBE matrix
     ================================================================ */
  var EXEC_ROWS = { capex: 1, etaBep: 1, energyH: 1, tco: 1, savingsVsCheapest: 1, npshMargin: 1 };
  var matrixView = 'exec';
  function setMatrixView(v) {
    matrixView = v;
    $('#matrix').classList.toggle('is-exec', v === 'exec');
    $$('.viewseg [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v ? 'true' : 'false'); });
    var nx = $$('#matrix tbody tr.x').length, nf = $$('#matrix tbody tr:not(.grp)').length;
    $('#viewHint').textContent = v === 'exec' ? nx + ' decisive rows · switch to Full datasheet to edit all ' + nf : 'Every input and calculated value · all ' + nf + ' rows editable';
  }
  var INPUT_ROWS = [
    { g: 'Commercial' },
    { k: 'capex', label: 'CapEx (pump + motor + baseplate)', unit: 'USD', step: 500, min: 0, money: true },
    { k: 'maint', label: 'Annual maintenance', unit: 'USD/yr', step: 100, min: 0, money: true },
    { k: 'lead', label: 'Lead time', unit: 'weeks', step: 1, min: 0 },
    { g: 'Hydraulic performance' },
    { k: 'etaBep', label: 'BEP efficiency η', unit: '%', step: 0.1, min: 1, max: 99.9 },
    { k: 'qBep', label: 'BEP flow', unit: 'm³/h', step: 5, min: 1 },
    { k: 'npshr', label: 'NPSHr (NPSH3) at rated flow', unit: 'm', step: 0.1, min: 0 },
    { g: 'Mechanical & driver' },
    { k: 'material', label: 'Material class (API 610)', unit: '', select: true },
    { k: 'mawp', label: 'Casing MAWP', unit: 'bar(g)', step: 1, min: 0 },
    { k: 'motorKw', label: 'Motor rating', unit: 'kW', step: 1, min: 0.1 },
    { k: 'etaMotor', label: 'Motor efficiency', unit: '%', step: 0.1, min: 50, max: 99.9 }
  ];
  var OUT_ROWS = [
    { g: 'Calculated at rated duty' },
    { k: 'eta', label: 'Pump efficiency at duty', unit: '%', f: function (r) { return num(r.eta * 100, 1); } },
    { k: 'ratio', label: 'Rated flow / BEP flow', unit: '%', f: function (r) { return num(r.ratio * 100, 0); } },
    { k: 'Ph', label: 'Hydraulic power P<sub>h</sub>', unit: 'kW', f: function (r) { return num(r.Ph, 1); } },
    { k: 'Pshaft', label: 'Shaft power P<sub>shaft</sub>', unit: 'kW', f: function (r) { return num(r.Pshaft, 1); } },
    { k: 'Pin', label: 'Electrical input P<sub>in</sub>', unit: 'kW', f: function (r) { return num(r.Pin, 1); } },
    { k: 'motorReq', label: 'API 610 min. driver rating', unit: 'kW', f: function (r) { return num(r.motorReq, 1); } },
    { g: 'Lifecycle cost' },
    { k: 'energyYr', label: 'Annual energy cost', unit: 'USD/yr', f: function (r) { return money(r.energyYr); } },
    { k: 'energyH', label: 'Energy over horizon', unit: 'USD', f: function (r) { return money(r.energyH); } },
    { k: 'maintH', label: 'Maintenance over horizon', unit: 'USD', f: function (r) { return money(r.maintH); } },
    { k: 'tco', label: 'Total cost of ownership', unit: 'USD', strong: true, f: function (r) { return money(r.tco); } },
    { k: 'savingsVsCheapest', label: 'ΔTCO vs lowest-CapEx bid', unit: 'USD', f: function (r) { return deltaTco(r); } },
    { k: 'co2', label: 'Annual CO₂', unit: 't/yr', f: function (r) { return num(r.co2, 1); } },
    { g: 'Suction check' },
    { k: 'npshMargin', label: 'NPSH margin (NPSHa − NPSHr)', unit: 'm', f: function (r) { return (r.npshMargin >= 0 ? '+' : '') + num(r.npshMargin, 2); } }
  ];

  function buildMatrix() {
    var t = $('#matrix');
    var h = '<thead><tr><th scope="col">Bid / parameter</th>';
    state.bids.forEach(function (b, i) {
      h += '<th scope="col" data-col="' + i + '"><div class="vhead">' +
        '<span class="slot">BID ' + 'ABC'[i] + '</span>' +
        '<input type="text" data-type="text" data-path="bids.' + i + '.vendor" aria-label="Bid ' + 'ABC'[i] + ' vendor">' +
        '<input type="text" class="model" data-type="text" data-path="bids.' + i + '.model" aria-label="Bid ' + 'ABC'[i] + ' model">' +
        '<span class="badge" data-pill="' + i + '"></span></div></th>';
    });
    h += '</tr></thead><tbody>';
    INPUT_ROWS.forEach(function (r) {
      if (r.g) { h += '<tr class="grp"><td colspan="4">' + r.g + '</td></tr>'; return; }
      h += '<tr' + (EXEC_ROWS[r.k] ? ' class="x"' : '') + '><td>' + r.label + (r.unit ? '<span class="unit">' + r.unit + '</span>' : '') + '</td>';
      state.bids.forEach(function (b, i) {
        var path = 'bids.' + i + '.' + r.k, aria = ' aria-label="' + esc(r.label) + ' — bid ' + 'ABC'[i] + '"';
        if (r.select) {
          h += '<td data-col="' + i + '"><select data-type="text" data-path="' + path + '"' + aria + '>' +
            E.MATERIAL_CLASSES.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></td>';
        } else if (r.money) {
          h += '<td data-col="' + i + '"><input type="text" class="money" inputmode="decimal" data-money="1" data-min="' + r.min + '" data-path="' + path + '"' + aria + '></td>';
        } else {
          h += '<td data-col="' + i + '"><input type="number" inputmode="decimal" step="' + r.step + '" min="' + r.min + '"' +
            (r.max != null ? ' max="' + r.max + '"' : '') + ' data-path="' + path + '"' + aria + '></td>';
        }
      });
      h += '</tr>';
    });
    OUT_ROWS.forEach(function (r) {
      if (r.g) { h += '<tr class="grp"><td colspan="4">' + r.g + ' · <span data-horizon-label></span></td></tr>'; return; }
      h += '<tr' + (EXEC_ROWS[r.k] ? ' class="x"' : '') + '><td>' + r.label + '<span class="unit">' + r.unit + '</span></td>';
      state.bids.forEach(function (b, i) {
        h += '<td class="out' + (r.strong ? ' out--strong' : '') + '" data-col="' + i + '" data-out="' + r.k + '"></td>';
      });
      h += '</tr>';
    });
    h += '<tr class="x row-status"><td>Compliance status</td>';
    state.bids.forEach(function (b, i) { h += '<td class="out" data-col="' + i + '" data-status="' + i + '"></td>'; });
    h += '</tr>';
    h += '<tr class="grp"><td colspan="4">API 610 &amp; specification deviations</td></tr><tr><td>Detected flags</td>';
    state.bids.forEach(function (b, i) { h += '<td data-col="' + i + '"><ul class="devlist" data-dev="' + i + '"></ul></td>'; });
    h += '</tr></tbody>';
    t.innerHTML = h;
    enhanceSelects(t);
    var rows = $$('#matrix tbody tr:not(.grp)').length;
    $('#fullCount').textContent = '(' + rows + ' rows)';
    setMatrixView(matrixView);
    syncInputs();
  }

  function updateMatrix() {
    var rec = result.recommended;
    $$('[data-horizon-label]').forEach(function (el) { el.textContent = state.duty.horizon + '-year horizon'; });
    $$('#matrix [data-col]').forEach(function (el) { el.classList.toggle('col-rec', Number(el.getAttribute('data-col')) === rec); });
    result.bids.forEach(function (r, i) {
      OUT_ROWS.forEach(function (row) {
        if (!row.k) return;
        var c = $('#matrix [data-col="' + i + '"][data-out="' + row.k + '"]');
        if (c) rollText(c, row.f(r));
      });
      var pill = $('[data-pill="' + i + '"]');
      if (i === rec && result.anyCompliant) { pill.className = 'badge badge--rec'; pill.textContent = 'Recommended'; }
      else if (i === rec) { pill.className = 'badge badge--bad'; pill.textContent = 'Lowest TCO · deviations'; }
      else if (r.compliant) { pill.className = 'badge badge--ok'; pill.textContent = 'Compliant'; }
      else { pill.className = 'badge badge--bad'; pill.textContent = 'Non-compliant'; }
      var maj = r.deviations.filter(function (d) { return d.sev === 'major'; });
      var codes = r.deviations.filter(function (d) { return d.sev !== 'commercial'; }).map(function (d) { return d.code; });
      $('[data-status="' + i + '"]').innerHTML = (i === rec && result.anyCompliant ? '<span class="st st--rec spill spill--rec">Recommended</span>' : r.compliant ? '<span class="st spill spill--ok">Compliant</span>' : '<span class="st st--bad spill spill--bad">Non-compliant</span>') +
        '<span class="st__n">' + (codes.length ? codes.join(' · ') : 'no technical flags') + '</span>';
      var ul = $('[data-dev="' + i + '"]');
      ul.innerHTML = r.deviations.length ? r.deviations.map(function (d) {
        return '<li class="sev-' + d.sev + '"><b>' + (d.sev === 'commercial' ? 'COM' : d.sev === 'major' ? 'MAJ' : 'MIN') + '</b>' + esc(d.text) + '</li>';
      }).join('') : '<li class="none">No deviations detected.</li>';
    });
  }

  function renderKpis() {
    var rec = result.recommended, r = result.bids[rec], ch = result.cheapest, n = state.duty.horizon;
    var co2d = result.bids[ch].co2 - r.co2;
    var html = '' +
      kpi(result.anyCompliant ? 'Recommended award' : 'Lowest TCO · not compliant', bidNameH(rec), result.anyCompliant ? 'Lowest TCO among compliant bids' : 'No bid is fully compliant — see deviations', false, true) +
      kpi(n + '-yr TCO', money(r.tco), 'CapEx ' + moneyShort(state.bids[rec].capex) + ' · energy ' + moneyShort(r.energyH), true) +
      kpi('vs lowest-CapEx bid', savesText(r), rec === ch ? 'Lowest-CapEx bid is also lowest TCO' : 'ΔTCO ' + deltaTco(r) + ' vs ' + bidNameH(ch) + ' over ' + n + ' yrs') +
      kpi('CO₂ vs lowest CapEx', (Math.abs(co2d) < 0.05 ? '' : co2d > 0 ? MINUS : '+') + num(Math.abs(co2d), 1) + ' t/yr', 'at ' + state.basis.ef.toFixed(2) + ' kg CO₂/kWh');
    rollRender($('#tbeKpis'), html);
    $('#tbeNpsha').textContent = num(result.npsha.npsha, 2) + ' m';
  }
  // ΔTCO sign convention used everywhere: negative = cheaper over life than the lowest-CapEx bid.
  function deltaTco(r) { var d = -r.savingsVsCheapest; return Math.round(d) === 0 ? '$0' : money(d, true); }
  function savesText(r) {
    var sv = Math.round(r.savingsVsCheapest);
    return sv > 0 ? 'Saves ' + money(sv) : sv < 0 ? 'Costs ' + money(-sv) + ' more' : '$0';
  }
  // quiet (i) hint: the context line lives in a hover / focus tooltip, never under the value
  function tip(s) {
    if (!s) return '';
    var plain = String(s).replace(/<[^>]+>/g, '');
    return '<span class="tip" tabindex="0" aria-label="' + esc(plain) + '"><i aria-hidden="true">i</i><span class="tip__b" aria-hidden="true">' + s + '</span></span>';
  }
  function kpi(k, v, s, verm, sans) {
    var key = String(k).replace(/<[^>]+>/g, '');
    var vv = sans ? v : (v.indexOf(' <small>') > 0 ? '<span data-roll="' + key + '">' + v.replace(' <small>', '</span> <small>') : '<span data-roll="' + key + '">' + v + '</span>');
    return '<div class="kpi"><span class="kpi__top"><span class="kpi__k">' + k + '</span>' + tip(s) + '</span><span class="kpi__v' + (verm ? ' kpi__v--verm' : '') + (sans ? ' kpi__v--name' : '') + '">' + vv + '</span></div>';
  }

  function renderBars() {
    var max = Math.max.apply(null, result.bids.map(function (r) { return r.tco; }));
    var h = '<div class="tco-bars__head"><span>' + state.duty.horizon + '-yr lifecycle cost composition</span><span class="tco-bars__legend">' +
      '<i class="seg-capex"></i>CapEx<i class="seg-energy"></i>Energy<i class="seg-maint"></i>Maintenance</span></div>';
    result.bids.forEach(function (r, i) {
      var b = state.bids[i], w = function (v) { return (v / max * 100).toFixed(2) + '%'; };
      h += '<div class="bar' + (i === result.recommended ? ' bar--rec' : '') + '"><span class="bar__name">' + bidNameH(i) + '</span>' +
        '<span class="bar__track"><span class="seg-capex" style="width:' + w(b.capex) + '"></span><span class="seg-energy" style="width:' + w(r.energyH) + '"></span><span class="seg-maint" style="width:' + w(r.maintH) + '"></span></span>' +
        '<span class="bar__val">' + money(r.tco) + '</span></div>';
    });
    $('#tcoBars').innerHTML = h;
  }

  function renderCase() {
    var b = $('#projBtn');
    if (b) b.title = state.project.tag + ' · ' + dutyLabel() + ' · ' + state.duty.horizon + '-yr horizon · ' + state.project.service;
  }

  /* ================================================================
     H–Q chart (SVG, tweened)
     ================================================================ */
  function niceStep(x) {
    var p = Math.pow(10, Math.floor(Math.log10(x))), n = x / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  var N_PTS = 72;
  function chartTarget(st) {
    var d = state.duty, h = Object.assign({}, state.hyd, { rho: state.basis.rho });
    var qTop = Math.max(E.pumpMaxFlow(1, st.H0, d.H, d.Q) * 1.04, d.Q * 1.3);
    var qMax = Math.ceil(qTop / niceStep(qTop / 5)) * niceStep(qTop / 5);
    var hTop = st.H0 * 1.22;
    var hMax = Math.ceil(hTop / niceStep(hTop / 5)) * niceStep(hTop / 5);
    var m = { qMax: qMax, hMax: hMax, pump: [], full: [], sys: [], eff: [] };
    var bid = st.bid;
    for (var i = 0; i < N_PTS; i++) {
      var q = qMax * i / (N_PTS - 1);
      m.pump.push(E.pumpHead(q, st.s, st.H0, d.H, d.Q));
      m.full.push(E.pumpHead(q, 1, st.H0, d.H, d.Q));
      m.sys.push(E.systemHead(q, h));
      var rq = q / (bid.qBep * st.s);
      m.eff.push(rq <= 1.95 && m.pump[i] > 0 ? E.efficiencyAtFlow(bid.etaBep / 100, q, bid.qBep * st.s) : NaN);
    }
    m.op = st.op ? { Q: st.op.Q, H: st.op.H } : null;
    var qb = bid.qBep * st.s;
    m.bep = { Q: qb, H: E.pumpHead(qb, st.s, st.H0, d.H, d.Q) };
    return m;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function Chart(svg, opts) {
    this.svg = svg; this.o = opts; this.cur = null; this.tgt = null; this.raf = 0; this.hoverQ = null;
  }
  Chart.prototype.set = function (target) {
    this.tgt = target;
    if (!this.cur || reduceMotion) { this.cur = clone(target); this.draw(); return; }
    if (!this.raf) this.tick();
  };
  Chart.prototype.tick = function () {
    var self = this, c = this.cur, t = this.tgt, k = 0.2, diff = 0;
    ['qMax', 'hMax'].forEach(function (key) { c[key] = lerp(c[key], t[key], k); diff = Math.max(diff, Math.abs(c[key] - t[key]) / t[key]); });
    ['pump', 'full', 'sys', 'eff'].forEach(function (key) {
      for (var i = 0; i < N_PTS; i++) {
        c[key][i] = isFinite(c[key][i]) && isFinite(t[key][i]) ? lerp(c[key][i], t[key][i], k) : t[key][i];
        if (isFinite(c[key][i]) && isFinite(t[key][i])) diff = Math.max(diff, Math.abs(c[key][i] - t[key][i]) / (t.hMax || 1));
      }
    });
    if (t.op && c.op) { c.op.Q = lerp(c.op.Q, t.op.Q, k); c.op.H = lerp(c.op.H, t.op.H, k); diff = Math.max(diff, Math.abs(c.op.Q - t.op.Q) / t.qMax); }
    else c.op = t.op ? clone(t.op) : null;
    c.bep.Q = lerp(c.bep.Q, t.bep.Q, k); c.bep.H = lerp(c.bep.H, t.bep.H, k);
    this.draw();
    if (diff > 0.0008) this.raf = requestAnimationFrame(function () { self.tick(); });
    else { this.cur = clone(t); this.draw(); this.raf = 0; }
  };
  Chart.prototype.geom = function () {
    var o = this.o, W = o.w, H = o.h, p = o.pad;
    var c = this.cur;
    return {
      x: function (q) { return p.l + (q / c.qMax) * (W - p.l - p.r); },
      y: function (h) { return H - p.b - (h / c.hMax) * (H - p.t - p.b); },
      ye: function (e) { return H - p.b - (e / 100) * (H - p.t - p.b); },
      q: function (x) { return (x - p.l) / (W - p.l - p.r) * c.qMax; },
      W: W, H: H, p: p
    };
  };
  Chart.prototype.draw = function () {
    var c = this.cur, o = this.o, g = this.geom(), p = g.p, id = this.svg.id;
    var T = o.themed ? chartPalette() : { grid: '#282B31', axis: '#8E9196', label: '#8E9196', sys: '#F4F3EF', bg: '#111214', ink: '#F4F3EF', soft: 'rgba(244,243,239,.35)', pill: '#111214', pillB: '#282B31', eff: '#8E9196' };
    var out = [];
    var x0 = p.l, x1 = g.W - p.r, y0 = g.H - p.b, y1 = p.t;
    out.push('<defs><clipPath id="' + id + '-clip"><rect x="' + x0 + '" y="' + y1 + '" width="' + (x1 - x0) + '" height="' + (y0 - y1) + '"/></clipPath></defs>');
    // grid
    var qs = niceStep(c.qMax / (o.mini ? 4 : 6)), hs = niceStep(c.hMax / (o.mini ? 4 : 5));
    for (var q = 0; q <= c.qMax + 1e-6; q += qs) {
      var X = g.x(q).toFixed(1);
      out.push('<line x1="' + X + '" x2="' + X + '" y1="' + y1 + '" y2="' + y0 + '" stroke="' + T.grid + '" stroke-width="1"/>');
      out.push('<text x="' + X + '" y="' + (y0 + 16) + '" fill="' + T.label + '" font-size="' + (o.mini ? 10 : 10.5) + '" text-anchor="middle">' + num(q) + '</text>');
    }
    for (var hh = 0; hh <= c.hMax + 1e-6; hh += hs) {
      var Y = g.y(hh).toFixed(1);
      out.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + Y + '" y2="' + Y + '" stroke="' + T.grid + '" stroke-width="1"/>');
      out.push('<text x="' + (x0 - 8) + '" y="' + (+Y + 3.5) + '" fill="' + T.label + '" font-size="' + (o.mini ? 10 : 10.5) + '" text-anchor="end">' + num(hh) + '</text>');
    }
    if (o.eff) {
      [0, 20, 40, 60, 80, 100].forEach(function (e) {
        out.push('<text x="' + (x1 + 8) + '" y="' + (g.ye(e) + 3.5) + '" fill="' + T.label + '" font-size="10.5">' + e + '</text>');
      });
      out.push('<text x="' + (x1 + 8) + '" y="' + (y1 - 8) + '" fill="' + T.label + '" font-size="10.5">η %</text>');
    }
    out.push('<text x="' + x0 + '" y="' + (y1 - 8) + '" fill="' + T.label + '" font-size="10.5" text-anchor="middle">H m</text>');
    out.push('<text x="' + x1 + '" y="' + (o.h - 4) + '" fill="' + T.label + '" font-size="10.5" text-anchor="end">Q m³/h</text>');
    out.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y0 + '" y2="' + y0 + '" stroke="' + T.axis + '" stroke-width="1"/>');
    out.push('<line x1="' + x0 + '" x2="' + x0 + '" y1="' + y1 + '" y2="' + y0 + '" stroke="' + T.axis + '" stroke-width="1"/>');

    var path = function (arr, fy) {
      var s = '', pen = false;
      for (var i = 0; i < N_PTS; i++) {
        if (!isFinite(arr[i])) { pen = false; continue; }
        s += (pen ? 'L' : 'M') + g.x(c.qMax * i / (N_PTS - 1)).toFixed(1) + ' ' + fy(arr[i]).toFixed(1); pen = true;
      }
      return s || 'M0 0';
    };
    out.push('<g clip-path="url(#' + id + '-clip)">');
    if (o.eff) out.push('<path d="' + path(c.eff.map(function (e) { return e * 100; }), g.ye) + '" fill="none" stroke="' + T.eff + '" stroke-width="1.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>');
    if (!o.mini && Math.abs(this.tgt.pump[1] - this.tgt.full[1]) > 0.01) out.push('<path d="' + path(c.full, g.y) + '" fill="none" stroke="#E04619" stroke-opacity=".5" stroke-width="1.4" stroke-dasharray="5 5"/>');
    out.push('<path d="' + path(c.sys, g.y) + '" fill="none" stroke="' + T.sys + '" stroke-width="' + (o.mini ? 1.6 : 1.8) + '"/>');
    out.push('<path d="' + path(c.pump, g.y) + '" fill="none" stroke="#E04619" stroke-width="' + (o.mini ? 2 : 2.4) + '"/>');
    out.push('</g>');

    // BEP marker
    if (c.bep.Q > 0 && c.bep.Q < c.qMax && c.bep.H > 0) {
      var bx = g.x(c.bep.Q), by = g.y(c.bep.H);
      out.push('<path d="M' + bx + ' ' + (by - 6) + 'L' + (bx + 6) + ' ' + by + 'L' + bx + ' ' + (by + 6) + 'L' + (bx - 6) + ' ' + by + 'Z" fill="' + T.bg + '" stroke="' + T.ink + '" stroke-width="1.2"/>');
      if (!o.mini) out.push('<text x="' + (bx + 10) + '" y="' + (by - 9) + '" fill="' + T.label + '" font-size="10.5">BEP</text>');
    }
    // Operating point
    if (c.op) {
      var ox = g.x(c.op.Q), oy = g.y(c.op.H);
      out.push('<line x1="' + ox + '" x2="' + ox + '" y1="' + oy + '" y2="' + y0 + '" stroke="' + T.ink + '" stroke-opacity=".35" stroke-dasharray="2 3"/>');
      out.push('<line x1="' + x0 + '" x2="' + ox + '" y1="' + oy + '" y2="' + oy + '" stroke="' + T.ink + '" stroke-opacity=".35" stroke-dasharray="2 3"/>');
      out.push('<circle cx="' + ox + '" cy="' + oy + '" r="' + (o.mini ? 5 : 6) + '" fill="' + T.bg + '" stroke="' + T.ink + '" stroke-width="1.6"/><circle cx="' + ox + '" cy="' + oy + '" r="2" fill="#E04619"/>');
      var lop = (this.tgt && this.tgt.op) || c.op, lab = 'OP ' + num(lop.Q) + ' m³/h · ' + num(lop.H, 1) + ' m';
      var right = ox < (x0 + x1) / 2;
      var fs = o.mini ? 10.5 : 11.5, tw = lab.length * fs * 0.6 + 18, th = fs + 12;
      var lx = right ? ox + 12 : ox - 12 - tw, ly = oy + (o.mini ? -14 - th : 14);
      lx = Math.max(x0 + 4, Math.min(lx, x1 - tw - 4)); ly = Math.max(y1 + 2, Math.min(ly, y0 - th - 4));
      out.push('<rect x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" width="' + tw.toFixed(1) + '" height="' + th + '" rx="' + (th / 2) + '" fill="' + T.pill + '" fill-opacity=".94" stroke="' + T.pillB + '"/>');
      out.push('<text x="' + (lx + tw / 2).toFixed(1) + '" y="' + (ly + th / 2 + fs * 0.36).toFixed(1) + '" fill="' + T.ink + '" font-size="' + fs + '" text-anchor="middle">' + lab + '</text>');
    } else {
      out.push('<text x="' + ((x0 + x1) / 2) + '" y="' + ((y0 + y1) / 2) + '" fill="#E04619" font-size="12" text-anchor="middle">NO DELIVERY — SHUTOFF HEAD BELOW STATIC HEAD</text>');
    }
    // Hover guide
    if (this.hoverQ != null) {
      var hq = Math.max(0, Math.min(c.qMax, this.hoverQ)), hx = g.x(hq);
      var at = function (arr) { var f = hq / c.qMax * (N_PTS - 1), i0 = Math.floor(f), i1 = Math.min(N_PTS - 1, i0 + 1); return arr[i0] + (arr[i1] - arr[i0]) * (f - i0); };
      var hp = at(c.pump), hs = at(c.sys);
      out.push('<line x1="' + hx + '" x2="' + hx + '" y1="' + y1 + '" y2="' + y0 + '" stroke="' + T.ink + '" stroke-opacity=".28" stroke-width="1"/>');
      if (hp > 0 && hp < c.hMax) {
        out.push('<line x1="' + x0 + '" x2="' + hx + '" y1="' + g.y(hp) + '" y2="' + g.y(hp) + '" stroke="#E04619" stroke-opacity=".35" stroke-dasharray="2 3"/>');
        out.push('<circle cx="' + hx + '" cy="' + g.y(hp) + '" r="4.5" fill="' + T.bg + '" stroke="#E04619" stroke-width="1.6"/>');
      }
      if (hs > 0 && hs < c.hMax) out.push('<circle cx="' + hx + '" cy="' + g.y(hs) + '" r="4.5" fill="' + T.bg + '" stroke="' + T.ink + '" stroke-width="1.6"/>');
    }
    this.svg.innerHTML = out.join('');
  };

  var hqChart;
  function initCharts() {
    hqChart = new Chart($('#hqChart'), { w: 760, h: 440, pad: { l: 52, r: 44, t: 26, b: 42 }, eff: true, themed: true });
    var svg = $('#hqChart'), tip = $('#chartTip'), host = $('.chart-host');
    var targetQ = null, scrub = 0, lastEv = null;
    function scrubLoop() {
      if (targetQ == null) { scrub = 0; return; }
      var hq = hqChart.hoverQ == null ? targetQ : hqChart.hoverQ + (targetQ - hqChart.hoverQ) * (reduceMotion ? 1 : 0.22);
      hqChart.hoverQ = hq;
      if (!hqChart.raf) hqChart.draw();
      updateTip(hq);
      scrub = Math.abs(hq - targetQ) > hqChart.cur.qMax * 0.0005 ? requestAnimationFrame(scrubLoop) : 0;
    }
    function move(ev) {
      if (!hqChart.cur) return;
      var rect = svg.getBoundingClientRect();
      var vx = (ev.clientX - rect.left) / rect.width * 760;
      var g = hqChart.geom();
      if (vx < g.p.l || vx > g.W - g.p.r) { leave(); return; }
      targetQ = g.q(vx); lastEv = ev;
      if (!scrub) scrub = requestAnimationFrame(scrubLoop);
    }
    function updateTip(q) {
      var ev = lastEv, d = state.duty, h = Object.assign({}, state.hyd, { rho: state.basis.rho });
      var s = study.s, bid = study.bid;
      var hp = E.pumpHead(q, s, study.H0, d.H, d.Q), hs = E.systemHead(q, h);
      var eta = E.efficiencyAtFlow(bid.etaBep, q, bid.qBep * s);
      tip.innerHTML = 'Q ' + num(q) + ' m³/h<br>H<sub>pump</sub> ' + (hp > 0 ? num(hp, 1) + ' m' : '—') + '<br>H<sub>sys</sub> ' + num(hs, 1) + ' m<br>η ' + (hp > 0 ? num(eta, 1) + ' %' : '—');
      tip.hidden = false;
      var hr = host.getBoundingClientRect();
      var lx = ev.clientX - hr.left + 14;
      if (lx + 150 > hr.width) lx = ev.clientX - hr.left - 150;
      tip.style.left = lx + 'px';
      tip.style.top = Math.max(8, ev.clientY - hr.top - 40) + 'px';
    }
    function leave() { targetQ = null; hqChart.hoverQ = null; tip.hidden = true; if (!hqChart.raf && hqChart.cur) hqChart.draw(); }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', leave);
  }

  /* ================================================================
     Hydraulics readouts
     ================================================================ */
  function renderHyd() {
    var st = study, d = state.duty, b = state.basis;
    hqChart.set(chartTarget(st));
    var sel = $('#hydVendor');
    sel.options[0].textContent = 'Recommended · ' + bidName(result.recommended);
    state.bids.forEach(function (x, i) { sel.options[i + 1].textContent = bidName(i); });
    var slot = $('#slotSelect');
    if (slot && slot.options.length === 3) state.bids.forEach(function (x, i) { slot.options[i].textContent = 'Slot ' + 'ABC'[i] + ' · ' + bidName(i); });

    var aff = st.affinity, affTxt = 'Affinity at ' + state.hyd.speed + '% speed · Q ×' + aff.Q.toFixed(2) + ' · H ×' + aff.H.toFixed(2) + ' · P ×' + aff.P.toFixed(2);

    if (st.noFlow) {
      rollRender($('#hydReadouts'),
        card('Operating point', 'No delivery', 'Shutoff ' + num(st.s * st.s * st.H0, 1) + ' m is below the ' + num(state.hyd.zStatic, 1) + ' m static head', 'bad', 'No flow') +
        card('VFD power & savings', '—', '') + card('NPSH margin', '—', '') + card('Pipe velocity', '—', ''));
      return;
    }
    var m = st.npshMargin, nState = m >= 1 ? 'Safe' : m >= 0 ? 'Low margin' : 'Cavitation risk';
    var vBad = st.vDis > 3.5, sv = st.saveKw;
    rollRender($('#hydReadouts'),
      card('Operating point', num(st.op.Q) + ' m³/h · ' + num(st.op.H, 1) + ' m',
        num(st.op.Q / d.Q * 100) + '% of rated flow · η ' + num(st.etaOp * 100, 1) + ' % · ' + affTxt) +
      card('VFD power & savings', num(st.Pvfd, 1) + ' kW',
        (sv >= 0 ? 'Saves ' + num(sv, 1) + ' kW vs throttling · ' + money(st.saveUsd) + '/yr · ' + num(st.saveCo2, 1) + ' t CO₂' : 'VFD losses exceed throttling loss here')) +
      card('NPSH margin', (m >= 0 ? '+' : '') + num(m, 2) + ' m',
        'NPSHa ' + num(st.npsha, 2) + ' m vs NPSHr ' + num(st.npshr, 2) + ' m · min 1.0 m', m < 1 ? 'bad' : 'ok', nState) +
      card('Pipe velocity', num(st.vDis, 2) + ' m/s',
        'Discharge · suction ' + num(st.vSuc, 2) + ' m/s · limit 3.5 m/s', vBad ? 'bad' : 'neutral', vBad ? 'Erosion risk' : 'Within limit'));
  }
  // Executive readout card: one value, one line of context, optional state badge.
  function card(k, v, sub, tone, badge) {
    var pill = tone === 'bad' ? 'spill--bad' : tone === 'neutral' ? 'spill--neutral' : 'spill--ok';
    return '<div class="xcard' + (tone === 'bad' ? ' xcard--bad' : '') + '"><div class="xcard__top"><span class="kpi__k">' + k + '</span>' + tip(sub) +
      (badge ? '<span class="spill ' + pill + '">' + badge + '</span>' : '') + '</div>' +
      '<span class="xcard__v" data-roll="' + k + '">' + v + '</span></div>';
  }


  /* ================================================================
     Hero
     ================================================================ */
  /* ================================================================
     Landing · sticky scrollytelling (live from the Package 01 template)
     ================================================================ */
  var storyDone = false, storyCharts = [], storyStudy = null, storyState = null, activeStep = -1;
  function storyFrames(sfx) {
    var st = storyState, res = E.evaluate(st), hs = storyStudy;
    var rec = res.recommended, max = Math.max.apply(null, res.bids.map(function (r) { return r.tco; }));
    var raw = ['Efficiency at BEP: 81.2 %', 'NPSH3 at rated flow: 4.6 m', 'MAWP: 51 bar g @ 38 °C', 'Material class: S-6', 'Driver: 132 kW, IE3', 'Total price: USD 171,500', 'Delivery: 20 weeks ARO'];
    var f0 = '<div class="sv sv--parse"><div class="sv__raw mono">' + raw.map(function (l, i) { var c = l.indexOf(': '); return '<span style="--i:' + i + '">' + l.slice(0, c + 1) + ' <b class="nw">' + l.slice(c + 2) + '</b></span>'; }).join('') + '</div>' +
      '<div class="sv__arrow" aria-hidden="true"><i></i></div>' +
      '<table class="sv__tbl mono"><thead><tr><th>Bidder</th><th>CapEx</th><th><span class="nt">η</span> BEP</th><th>NPSH3</th><th>10-yr TCO</th></tr></thead><tbody>' +
      res.bids.map(function (r, i) {
        var b = st.bids[i];
        var dev = r.deviations.filter(function (d) { return d.sev === 'major'; })[0];
        var tag = !r.compliant && dev ? ' <em class="sv__dev">' + (/npsh/i.test(dev.code + ' ' + dev.text) ? 'NPSH' : esc(dev.code)) + ' dev.</em>' : '';
        return '<tr class="' + (i === rec ? 'is-rec' : '') + '"><td>' + esc(b.vendor) + tag + '</td><td>' + moneyShort(b.capex) + '</td><td>' + num(b.etaBep, 1) + '%</td><td>' + num(b.npshr, 1) + ' m</td><td>' + moneyShort(r.tco) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="sv__bars">' + res.bids.map(function (r, i) {
        return '<div class="sv__bar' + (i === rec ? ' is-rec' : '') + '"><span>' + esc(st.bids[i].vendor) + (i === rec ? ' · recommended' : '') + '</span><i><b style="--w:' + (r.tco / max * 100).toFixed(1) + '%"></b></i></div>';
      }).join('') + '</div></div>';
    var m = hs.npshMargin;
    var f1 = '<div class="sv sv--hyd"><svg id="storyChart' + sfx + '" class="chart" viewBox="0 0 560 300" role="img" aria-label="Pump curve, system curve and operating point for the sample package"></svg>' +
      '<div class="sv__stats"><div><span class="mono">Operating point</span><b class="mono">' + num(hs.op.Q) + ' m³/h · ' + num(hs.op.H, 1) + ' m</b></div>' +
      '<div><span class="mono">NPSH margin</span><b class="mono">+' + num(m, 2) + ' m <em class="spill ' + (m >= 1 ? 'spill--ok' : 'spill--bad') + '">' + (m >= 1 ? 'Safe' : 'Low') + '</em></b></div>' +
      '<div><span class="mono">VFD at ' + st.hyd.speed + '% vs throttle</span><b class="mono">' + money(hs.saveUsd) + ' / yr</b></div></div></div>';
    var rb = st.bids[rec];
    var f2 = '<div class="sv sv--doc"><div class="doc"><span class="doc__mark"></span><span class="doc__title">Award Recommendation</span>' +
      '<span class="doc__meta mono">' + esc(st.project.tag) + ' · ' + num(st.duty.Q) + ' m³/h @ ' + num(st.duty.H) + ' m</span>' +
      '<span class="doc__call">Recommend <b>' + esc(rb.vendor + ' (' + rb.model + ')') + '</b> — lowest 10-yr TCO among compliant bids, ' + money(res.bids[rec].tco) + '.</span>' +
      '<span class="doc__line" style="width:86%"></span><span class="doc__line" style="width:70%"></span><span class="doc__line" style="width:78%"></span>' +
      '<span class="doc__sign"><i>Prepared</i><i>Checked</i><i>Approved</i></span></div>' +
      '<ul class="sv__chips mono"><li>Award report</li><li>Supplier RFIs</li><li>Excel matrix</li><li>Audit trail</li></ul></div>';
    return [f0, f1, f2];
  }
  function renderStory() {
    if (storyDone) return;
    storyDone = true;
    storyState = clone(SAMPLE);
    storyStudy = E.hydraulicStudy(storyState, E.evaluate(storyState).recommended);
    var stage = storyFrames('S');
    $('#stageFrames').innerHTML = stage.map(function (h, i) { return '<div class="sframe' + (i === 0 ? ' is-active' : '') + '" data-frame="' + i + '">' + h + '</div>'; }).join('');
    var inline = storyFrames('M');
    $$('[data-media]').forEach(function (el) { el.innerHTML = inline[+el.getAttribute('data-media')]; });
    ['#storyChartS', '#storyChartM'].forEach(function (sel) {
      var c = new Chart($(sel), { w: 560, h: 300, pad: { l: 42, r: 16, t: 24, b: 40 }, mini: true });
      storyCharts.push(c);
    });
    drawStoryCharts(true);
    initScrolly();
  }
  function drawStoryCharts(instant) {
    var live = state; state = storyState;
    var tgt = chartTarget(storyStudy);
    state = live;
    storyCharts.forEach(function (c) {
      if (!instant && !reduceMotion) {
        // morph in: start from flat curves, then ease to the calculated ones
        var flat = clone(tgt);
        ['pump', 'full', 'sys'].forEach(function (k) { flat[k] = flat[k].map(function () { return 0; }); });
        flat.op = tgt.op ? { Q: 0, H: 0 } : null; flat.bep = { Q: 0, H: 0 };
        c.cur = flat; c.tgt = null; if (c.raf) { cancelAnimationFrame(c.raf); c.raf = 0; }
      } else c.cur = null;
      c.set(tgt);
    });
  }
  function setStep(i) {
    if (i === activeStep) return;
    activeStep = i;
    $$('.sstep').forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    $$('.sframe').forEach(function (f, k) { f.classList.toggle('is-active', k === i); });
    $('#stageIdx').textContent = '0' + (i + 1);
    if (i === 1) drawStoryCharts(false);
  }
  function initScrolly() {
    var steps = $$('.sstep'), wrap = $('.scrolly'), prog = $('#stageProg'), ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight, mid = vh * 0.5, best = 0, bestD = 1e9;
      steps.forEach(function (s, k) {
        var r = s.getBoundingClientRect(), c = r.top + r.height / 2, d = Math.abs(c - mid);
        if (d < bestD) { bestD = d; best = k; }
      });
      setStep(best);
      var wr = wrap.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (mid - wr.top) / Math.max(1, wr.height)));
      prog.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      if (wr.top < vh && wr.bottom > 0) $$('.sv__bar b, .sv__raw span').forEach(function (b) { b.classList.add('is-on'); });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ================================================================
     Vernier scroll rail (01–05) and CAD reticle cursor
     ================================================================ */
  function initRail() {
    var rail = $('#rail'); if (!rail) return;
    var links = $$('a', rail), ind = $('#railInd'), ticking = false;
    var targets = links.map(function (a) { var id = a.getAttribute('data-target'); return id === 'top' ? doc.body : $('#' + id); });
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var y = i === 0 ? 0 : targets[i].getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    function update() {
      ticking = false;
      var y = window.scrollY + window.innerHeight * 0.35;
      var tops = targets.map(function (t, i) { return i === 0 ? 0 : t.getBoundingClientRect().top + window.scrollY; });
      var maxY = doc.documentElement.scrollHeight - window.innerHeight;
      var pos = 0;
      for (var i = 0; i < tops.length; i++) {
        var next = i + 1 < tops.length ? tops[i + 1] : maxY + window.innerHeight * 0.35;
        if (y >= tops[i]) pos = i + Math.min(1, (y - tops[i]) / Math.max(1, next - tops[i]));
      }
      if (window.scrollY >= maxY - 2) pos = tops.length - 1;
      var f = Math.min(1, pos / (tops.length - 1));
      ind.style.transform = 'translateY(' + (f * (rail.clientHeight - 2)).toFixed(1) + 'px)';
      var act = Math.min(tops.length - 1, Math.round(pos - 0.2 < 0 ? 0 : Math.floor(pos + 0.0001)));
      links.forEach(function (a, k) { a.classList.toggle('is-active', k === act); });
      // never dark-on-dark: flip a label to stone when it sits over an obsidian panel
      var fr = $('.foot--dark').getBoundingClientRect(), rr = rail.getBoundingClientRect();
      rail.classList.toggle('is-away', fr.top < rr.bottom + 48);
      var darks = $$('.frame-hero, .stage, .sstep__media, .foot--dark').map(function (d) { return d.getBoundingClientRect(); });
      links.forEach(function (a) {
        var r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        a.classList.toggle('on-dark', darks.some(function (d) { return cx >= d.left && cx <= d.right && cy >= d.top && cy <= d.bottom; }));
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  function initReticle() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var r = $('#reticle'), lab = $('#reticleLab'); if (!r) return;
    var cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, raf = 0, zone = null;
    doc.documentElement.classList.add('has-reticle');
    function loop() {
      cur.x += (tgt.x - cur.x) * 0.35; cur.y += (tgt.y - cur.y) * 0.35;
      r.style.transform = 'translate(' + cur.x.toFixed(1) + 'px,' + cur.y.toFixed(1) + 'px)';
      raf = zone && (Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.2) ? requestAnimationFrame(loop) : 0;
    }
    function readout(z, e) {
      var b = z.getBoundingClientRect();
      if (z.getAttribute('data-reticle') === 'chart') {
        var c = storyCharts[0], svg = $('svg', z);
        if (c && c.cur && svg) {
          var sb = svg.getBoundingClientRect(), g = c.geom();
          var vx = (e.clientX - sb.left) / sb.width * c.o.w, vy = (e.clientY - sb.top) / sb.height * c.o.h;
          var q = g.q(vx), h = (c.o.h - g.p.b - vy) / (c.o.h - g.p.t - g.p.b) * c.cur.hMax;
          if (q >= 0 && q <= c.cur.qMax && h >= 0 && h <= c.cur.hMax) return 'Q ' + num(q) + ' m³/h · H ' + num(h, 1) + ' m';
        }
        return '';
      }
      return 'X ' + ((e.clientX - b.left) / b.width).toFixed(3) + ' · Y ' + ((e.clientY - b.top) / b.height).toFixed(3);
    }
    function enter(e) { zone = e.currentTarget; r.classList.add('is-on'); cur.x = tgt.x = e.clientX; cur.y = tgt.y = e.clientY; move(e); }
    function move(e) {
      tgt.x = e.clientX; tgt.y = e.clientY;
      lab.textContent = readout(e.currentTarget, e);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function leave() { zone = null; r.classList.remove('is-on'); }
    function bindZone(z) { z.addEventListener('pointerenter', enter); z.addEventListener('pointermove', move); z.addEventListener('pointerleave', leave); }
    $$('[data-reticle]').forEach(bindZone);
    var stageChart = $('.sframe[data-frame="1"]');
    if (stageChart) { stageChart.setAttribute('data-reticle', 'chart'); bindZone(stageChart); }
  }

  /* ================================================================
     Equipment twin (hydraulics) + operating strip (TBE)
     Values come from the engine; twin.js only draws them.
     ================================================================ */
  var pumpTwin = null, miniTwin = null, lastAlert = '';
  function initTwins() {
    if (!window.MyengTwin) return;
    pumpTwin = window.MyengTwin.pump($('#twinCanvas'), { reduced: reduceMotion, light: $('#app').getAttribute('data-theme') === 'stone' });
    miniTwin = window.MyengTwin.mini($('#stripImp'), { reduced: reduceMotion });
    doc.addEventListener('visibilitychange', twinSync);
  }
  function twinSync() {
    if (!pumpTwin) return;
    var show = appOpen && !doc.hidden;
    if (show && activeTab === 'hyd') pumpTwin.start(); else pumpTwin.stop();
    if (show && activeTab === 'tbe') miniTwin.start(); else miniTwin.stop();
  }
  function renderTwin() {
    if (!pumpTwin) return;
    var st = study, d = state.duty, h = state.hyd, bid = st.bid;
    var rpmRated = state.project.rpm || 2980, rpm = rpmRated * st.s;
    var alerts = $('#twinAlerts'), cv = $('#twinCanvas');
    if (st.noFlow) {
      pumpTwin.update({ speed: st.s, flow: 0, vSuc: 0.01, vDis: 0.01, D: h.D, Ds: h.Ds, margin: 9, shaftKw: 0, motorKw: bid.motorKw, erosion: false, rpm: rpm, speedPct: h.speed, H: 0 });
      alerts.innerHTML = '<span class="spill spill--bad">No delivery · shutoff below static head</span>'; lastAlert = '';
      cv.setAttribute('aria-label', 'Pump twin: no delivery at ' + h.speed + '% speed.');
      ['#tpFlow', '#tpDis', '#tpNpsh'].forEach(function (id) { $(id).innerHTML = ''; });
      $('#tpSpeed').innerHTML = '<span class="tglass__k">Speed / VFD</span><b>' + num(rpm) + ' rpm · ' + h.speed + '%</b>';
      return;
    }
    var cav = st.npshMargin < 1, ero = st.vDis > 3.5;
    pumpTwin.update({
      speed: st.s, flow: st.op.Q, vSuc: st.vSuc, vDis: st.vDis, D: h.D, Ds: h.Ds, margin: st.npshMargin,
      shaftKw: st.PshaftOp, motorKw: bid.motorKw, erosion: ero, rpm: rpm, speedPct: h.speed, H: st.op.H
    });
    var a = (cav ? '<span class="spill spill--bad">Cavitation onset · eye zone</span>' : '<span class="spill spill--ok">NPSH safe</span>') +
      (ero ? '<span class="spill spill--bad">Erosion risk · &gt;3.5 m/s</span>' : '') +
      '<span class="spill spill--neutral">' + bidNameH(st.bidIndex) + '</span>';
    if (a !== lastAlert) { alerts.innerHTML = a; lastAlert = a; }
    var pill = function (id, k, v, bad) { var el = $(id); el.innerHTML = '<span class="tglass__k">' + k + '</span><b>' + v + '</b>'; el.classList.toggle('is-alert', !!bad); };
    pill('#tpFlow', 'Flow Q', num(st.op.Q) + ' m³/h');
    pill('#tpDis', ero ? 'Erosion risk · v' : 'Discharge v', num(st.vDis, 2) + ' m/s', ero);
    pill('#tpNpsh', cav ? 'Cavitation · NPSH' : 'NPSH margin', (st.npshMargin >= 0 ? '+' : '') + num(st.npshMargin, 2) + ' m', cav);
    pill('#tpSpeed', 'Speed / VFD', num(rpm) + ' rpm · ' + h.speed + '%');
    cv.setAttribute('aria-label', 'Pump twin for ' + bidName(st.bidIndex) + ': ' + num(rpm) + ' rpm at VFD ' + h.speed + ' %, flow ' + num(st.op.Q) +
      ' m³/h, NPSH margin ' + (st.npshMargin >= 0 ? '+' : '') + num(st.npshMargin, 2) + ' m' + (cav ? ' (cavitation onset)' : '') +
      ', discharge velocity ' + num(st.vDis, 2) + ' m/s' + (ero ? ' (erosion risk)' : '') + '.');
  }
  function renderStrip() {
    if (!miniTwin) return;
    var rec = result.recommended, r = result.bids[rec], b = state.bids[rec];
    var tot = b.capex + r.energyH + r.maintH;
    var pc = function (v) { return (v / tot * 100); };
    $('#stripName').innerHTML = bidNameH(rec);
    rollText($('#stripMeta'), 'η ' + num(r.eta * 100, 1) + ' % · ' + num(r.Pin, 1) + ' kW · ' + num(r.kWh / 1000) + ' MWh/yr · electricity ' + num(pc(r.energyH), 0) + '% of ' + state.duty.horizon + '-yr TCO');
    // energy flow speed follows the cost of running: hours × tariff
    var intensity = Math.min(1, (state.duty.hours * state.duty.tariff) / 1500);
    $('#estrip').style.setProperty('--flow', (2.6 - 2 * intensity).toFixed(2) + 's');
    miniTwin.update(0.02 + 0.07 * Math.min(1, state.duty.Q / 600));
  }

  /* ================================================================
     Hero stage telemetry + rated / VFD-trim toggle (Package 01 template)
     ================================================================ */
  var heroFlow = 1;   // flow-field speed factor, follows the selected operating point
  var heroSurge = 0;  // transient boost when the speed trim changes (decays in the flow loop)
  function initHeroStage() {
    var st = clone(SAMPLE), res = E.evaluate(st), rec = res.recommended, r = res.bids[rec];
    $('#heroSave').textContent = money(r.savingsVsCheapest);
    $('#heroNpsh').textContent = (r.npshMargin >= 0 ? '+' : '') + num(r.npshMargin, 1) + ' m';
    var safe = r.npshMargin >= 1;
    $('#heroNpshState').textContent = safe ? 'Safe' : 'Low';
    $('#heroNpshState').className = 'spill ' + (safe ? 'spill--ok' : 'spill--bad');
    function setTrim(pct) {
      var s2 = clone(st); s2.hyd.speed = pct; s2.hyd.vendor = rec;
      var h = E.hydraulicStudy(s2, rec);
      if (!h.op) return;
      // 100 % = full speed straight on the system curve (no drive losses); 92 % = through the VFD
      var kw = pct >= 100 ? h.Pvfd * (s2.hyd.vfdEff / 100) : h.Pvfd;
      $('#heroKw').textContent = num(kw, 1) + ' kW';
      $('#heroQ').textContent = num(h.op.Q) + ' m³/h';
      heroFlow = h.op.Q / st.duty.Q;
      $$('[data-trim]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-trim') === String(pct) ? 'true' : 'false'); });
    }
    var frame = $('#heroFrame'), surgeT = 0;
    $$('[data-trim]').forEach(function (b) {
      b.addEventListener('click', function () {
        var was = b.getAttribute('aria-pressed') === 'true';
        setTrim(+b.getAttribute('data-trim'));
        if (was || reduceMotion) return;
        // a visible response: sheen pulse across the impeller and a short streamline surge
        frame.classList.remove('is-surge'); void frame.offsetWidth; frame.classList.add('is-surge');
        heroSurge = 1; clearTimeout(surgeT); surgeT = setTimeout(function () { frame.classList.remove('is-surge'); }, 1100);
      });
    });
    setTrim(92);
  }

  /* ================================================================
     Footer wordmark spotlight: a lit copy revealed by a radial mask
     that eases toward the pointer (no scaling, no jumps).
     ================================================================ */
  function initSpotlight() {
    var foot = $('.foot--dark'), wm = $('#wordmark');
    if (!foot || !wm) return;
    var cur = { x: 0.5, y: 0.5, o: 0 }, tgt = { x: 0.5, y: 0.5, o: 0 }, raf = 0;
    function loop() {
      var k = reduceMotion ? 1 : 0.12;
      cur.x += (tgt.x - cur.x) * k; cur.y += (tgt.y - cur.y) * k; cur.o += (tgt.o - cur.o) * (reduceMotion ? 1 : 0.08);
      wm.style.setProperty('--mx', (cur.x * 100).toFixed(2) + '%');
      wm.style.setProperty('--my', (cur.y * 100).toFixed(2) + '%');
      wm.style.setProperty('--lit', cur.o.toFixed(3));
      raf = (Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) + Math.abs(tgt.o - cur.o)) > 0.001 ? requestAnimationFrame(loop) : 0;
    }
    foot.addEventListener('pointermove', function (e) {
      var r = wm.getBoundingClientRect();
      tgt.x = (e.clientX - r.left) / r.width; tgt.y = (e.clientY - r.top) / r.height; tgt.o = 1;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    foot.addEventListener('pointerleave', function () { tgt.o = 0; if (!raf) raf = requestAnimationFrame(loop); });
  }

  /* ================================================================
     Custom select: an accessible listbox popover layered over the
     native <select>, which stays in the DOM as the source of truth
     (data binding, forms, keyboard fallbacks and tests keep working).
     ================================================================ */
  var openCsel = null;
  function enhanceSelects(root) {
    $$('select', root || doc).forEach(function (sel) {
      if (sel.closest('.csel')) return;
      var wrap = doc.createElement('span'); wrap.className = 'csel';
      sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
      var btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'csel__btn';
      btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
      var lab = sel.labels && sel.labels[0] ? sel.labels[0].querySelector('span') : null;
      var name = sel.getAttribute('aria-label') || (lab ? lab.textContent : '') || 'Select';
      btn.setAttribute('aria-label', name.trim());
      btn.innerHTML = '<span class="csel__val"></span><svg class="csel__chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      wrap.appendChild(btn);
      sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
      var sync = function () { var o = sel.options[sel.selectedIndex]; btn.querySelector('.csel__val').textContent = o ? o.text : ''; };
      sel._cselSync = sync;
      sel.addEventListener('change', sync);
      new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true });
      btn.addEventListener('click', function (e) { e.stopPropagation(); if (openCsel && openCsel.sel === sel) closeCsel(true); else openList(sel, btn); });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList(sel, btn); }
      });
      sync();
    });
  }
  function syncSelects() { $$('select').forEach(function (s) { if (s._cselSync) s._cselSync(); }); }
  function openList(sel, btn) {
    closeCsel(false);
    var host = btn.closest('dialog') || btn.closest('#app') || doc.body;
    var list = doc.createElement('ul');
    list.className = 'csel__list' + (btn.closest('dialog') || (btn.closest('#app') && $('#app').getAttribute('data-theme') === 'stone') ? ' csel__list--light' : '');
    list.setAttribute('role', 'listbox'); list.id = 'csel-' + Math.random().toString(36).slice(2, 8);
    list.setAttribute('aria-label', btn.getAttribute('aria-label'));
    Array.prototype.forEach.call(sel.options, function (o, i) {
      var li = doc.createElement('li');
      li.setAttribute('role', 'option'); li.id = list.id + '-' + i; li.className = 'csel__opt';
      li.setAttribute('aria-selected', i === sel.selectedIndex ? 'true' : 'false');
      li.innerHTML = '<span>' + esc(o.text) + '</span><svg class="csel__check" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5 5 9l4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { choose(i); });
      li.addEventListener('mousemove', function () { focus(i); });
      list.appendChild(li);
    });
    host.appendChild(list);
    var r = btn.getBoundingClientRect(), hr = host === doc.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
    var w = Math.max(r.width, 180), left = Math.min(r.left, window.innerWidth - w - 8);
    list.style.minWidth = w + 'px';
    list.style.left = (left - hr.left + (host.scrollLeft || 0)) + 'px';
    var below = window.innerHeight - r.bottom, h = Math.min(list.scrollHeight, 300);
    var top = below > h + 12 || below > r.top ? r.bottom + 6 : r.top - h - 6;
    list.style.top = (top - hr.top + (host === doc.body ? window.scrollY : host.scrollTop || 0)) + 'px';
    list.style.position = host === doc.body ? 'absolute' : (host.tagName === 'DIALOG' ? 'fixed' : 'absolute');
    if (host.tagName === 'DIALOG') { list.style.left = left + 'px'; list.style.top = top + 'px'; }
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-controls', list.id);
    var active = Math.max(0, sel.selectedIndex);
    openCsel = { sel: sel, btn: btn, list: list, active: active, t: performance.now() };
    focus(active);
    function focus(i) {
      openCsel.active = i;
      $$('.csel__opt', list).forEach(function (li, k) { li.classList.toggle('is-active', k === i); });
      var li = list.children[i]; if (li) { btn.setAttribute('aria-activedescendant', li.id); if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6; else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6; }
    }
    function choose(i) {
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closeCsel(true);
    }
    openCsel.focus = focus; openCsel.choose = choose;
  }
  function closeCsel(refocus) {
    if (!openCsel) return;
    var o = openCsel; openCsel = null;
    o.list.remove(); o.btn.setAttribute('aria-expanded', 'false'); o.btn.removeAttribute('aria-activedescendant');
    if (refocus) o.btn.focus();
  }
  doc.addEventListener('keydown', function (e) {
    if (!openCsel) return;
    var n = openCsel.sel.options.length;
    var o = openCsel, stop = function () { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') { stop(); o.focus(Math.min(n - 1, o.active + 1)); }
    else if (e.key === 'ArrowUp') { stop(); o.focus(Math.max(0, o.active - 1)); }
    else if (e.key === 'Home') { stop(); o.focus(0); }
    else if (e.key === 'End') { stop(); o.focus(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { stop(); o.choose(o.active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCsel(true); }
    else if (e.key === 'Tab') closeCsel(false);
  }, true);
  doc.addEventListener('mousedown', function (e) { if (openCsel && !e.target.closest('.csel__list') && !e.target.closest('.csel__btn')) closeCsel(false); });
  window.addEventListener('resize', function () { closeCsel(false); });
  // close on scroll — but ignore the scroll that brought the control into view just before opening
  doc.addEventListener('scroll', function (e) { if (openCsel && performance.now() - openCsel.t > 250 && !(e.target.closest && e.target.closest('.csel__list'))) closeCsel(false); }, true);

  /* ================================================================
     Executive Excel workbook (.xlsx) — dependency-free OpenXML writer
     ================================================================ */
  var CRC_T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // Minimal ZIP (stored entries) — valid for OpenXML packages.
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    var u16 = function (v) { return [v & 255, (v >>> 8) & 255]; }, u32 = function (v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; };
    var d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var head = [].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(dt), u16(dd), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(dt), u16(dd), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += head.length + name.length + data.length;
    });
    var csize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new Uint8Array([].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(offset), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xmlEsc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
  function colL(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  // Style ids (cellXfs order below)
  var X = { def: 0, banner: 1, sub: 2, head: 3, headRec: 4, section: 5, label: 6, unit: 7, money: 8, pct: 9, dec2: 10, int: 11, text: 12, moneyRec: 13, pctRec: 14, dec2Rec: 15, intRec: 16, textRec: 17, moneyB: 18, moneyBRec: 19, wrap: 20, wrapRec: 21, dec1: 22, dec1Rec: 23, basisV: 24, basisM: 25, note: 26 };
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="4"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="0.00"/><numFmt numFmtId="167" formatCode="#,##0"/></numFmts>' +
    '<fonts count="6">' +
    '<font><sz val="10"/><color rgb="FF111214"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><sz val="10"/><color rgb="FFE2E1DC"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FF111214"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><sz val="9"/><color rgb="FF6E6D68"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF111214"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F3EF"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE04619"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFBE9E2"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E1DC"/></bottom><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="medium"><color rgb="FF111214"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="27">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                                                       // 0 def
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" indent="1"/></xf>' + // 1 banner
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" indent="1"/></xf>' + // 2 sub
    '<xf numFmtId="0" fontId="3" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>' + // 3 head
    '<xf numFmtId="0" fontId="5" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>' + // 4 headRec
    '<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" indent="1"/></xf>' + // 5 section
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" indent="1"/></xf>' + // 6 label
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>' + // 7 unit
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +   // 8 money
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +   // 9 pct
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +   // 10 dec2
    '<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +   // 11 int
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="right"/></xf>' + // 12 text
    '<xf numFmtId="164" fontId="3" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 13 moneyRec
    '<xf numFmtId="165" fontId="3" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 14 pctRec
    '<xf numFmtId="166" fontId="3" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 15 dec2Rec
    '<xf numFmtId="167" fontId="3" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 16 intRec
    '<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>' + // 17 textRec
    '<xf numFmtId="164" fontId="3" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 18 moneyB (TCO)
    '<xf numFmtId="164" fontId="5" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 19 moneyBRec
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>' + // 20 wrap
    '<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>' + // 21 wrapRec
    '<xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +    // 22 dec1 (0.00 builtin)
    '<xf numFmtId="2" fontId="3" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 23 dec1Rec
    '<xf numFmtId="166" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' + // 24 basisV
    '<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' + // 25 basisM (money)
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment wrapText="1" vertical="top"/></xf>' + // 26 note
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function xlsxWorkbook() {
    var rec = result.recommended, ch = result.cheapest, nb = state.bids.length;
    var rows = [], merges = [], rowH = {};
    var cell = function (c, r, v, s, f) { return { c: c, r: r, v: v, s: s, f: f }; };
    var add = function (cells, h) { var r = rows.length + 1; rows.push(cells.map(function (x) { x.r = r; return x; })); if (h) rowH[r] = h; return r; };
    var BC = function (i) { return colL(2 + i); };                // bidder columns C, D, E
    var rs = function (base, i) { return i === rec ? ({ 8: 13, 9: 14, 10: 15, 11: 16, 12: 17, 18: 19, 20: 21, 22: 23 })[base] || base : base; };
    var last = colL(1 + nb);
    // banner
    var r1 = add([cell('A', 0, 'MYENG · Technical Bid Evaluation', X.banner)].concat(state.bids.map(function (b, i) { return cell(BC(i), 0, '', X.banner); })).concat([cell('B', 0, '', X.banner)]), 30);
    merges.push('A' + r1 + ':' + last + r1);
    var r2 = add([cell('A', 0, state.project.tag + ' · ' + state.project.service + ' · ' + dutyLabel() + ' · ' + state.duty.horizon + '-yr horizon · issued ' + today() + ' · illustrative template data', X.sub)].concat([cell('B', 0, '', X.sub)]).concat(state.bids.map(function (b, i) { return cell(BC(i), 0, '', X.sub); })), 20);
    merges.push('A' + r2 + ':' + last + r2);
    add([]);
    // project basis (referenced by the formulas below)
    add([cell('A', 0, 'Project basis', X.section), cell('B', 0, '', X.section), cell('C', 0, '', X.section)]);
    var B = {};
    [['Q', 'Duty flow Q', 'm³/h', state.duty.Q, X.basisV], ['H', 'Total head H', 'm', state.duty.H, X.basisV], ['hours', 'Operating hours', 'h/yr', state.duty.hours, X.basisV],
      ['tariff', 'Electricity tariff', '$/kWh', state.duty.tariff, X.basisV], ['horizon', 'Evaluation horizon', 'years', state.duty.horizon, X.basisV],
      ['ef', 'Grid emission factor', 'kg CO₂/kWh', state.basis.ef, X.basisV], ['npsha', 'NPSHa at rated flow', 'm', +result.npsha.npsha.toFixed(4), X.basisV]
    ].forEach(function (k) { B[k[0]] = '$C$' + add([cell('A', 0, k[1], X.label), cell('B', 0, k[2], X.unit), cell('C', 0, k[3], k[4])]); });
    add([]);
    // bidder header
    var hr = add([cell('A', 0, 'Parameter', X.head), cell('B', 0, 'Unit', X.head)].concat(state.bids.map(function (b, i) { return cell(BC(i), 0, bidName(i) + (i === rec && result.anyCompliant ? '  ★ Recommended' : ''), i === rec ? X.headRec : X.head); })), 34);
    var R = {};
    var section = function (t) { add([cell('A', 0, t, X.section), cell('B', 0, '', X.section)].concat(state.bids.map(function (b, i) { return cell(BC(i), 0, '', X.section); }))); };
    var line = function (key, label, unit, base, val, fml) {
      R[key] = add([cell('A', 0, label, X.label), cell('B', 0, unit, X.unit)].concat(state.bids.map(function (b, i) {
        var res = result.bids[i];
        return cell(BC(i), 0, val(b, res, i), rs(base, i), fml ? fml(BC(i), i) : null);
      })));
    };
    section('Commercial');
    line('capex', 'CapEx (pump + motor + baseplate)', 'USD', X.money, function (b) { return b.capex; });
    line('maint', 'Annual maintenance', 'USD/yr', X.money, function (b) { return b.maint; });
    line('lead', 'Lead time', 'weeks', X.int, function (b) { return b.lead; });
    section('Hydraulic performance');
    line('etaBep', 'BEP efficiency', '%', X.pct, function (b) { return b.etaBep / 100; });
    line('qBep', 'BEP flow', 'm³/h', X.int, function (b) { return b.qBep; });
    line('npshr', 'NPSHr (NPSH3) at rated flow', 'm', X.dec2, function (b) { return b.npshr; });
    section('Mechanical & driver');
    line('material', 'Material class (API 610)', '', X.text, function (b) { return b.material; });
    line('mawp', 'Casing MAWP', 'bar(g)', X.int, function (b) { return b.mawp; });
    line('motorKw', 'Motor rating', 'kW', X.int, function (b) { return b.motorKw; });
    line('etaMotor', 'Motor efficiency', '%', X.pct, function (b) { return b.etaMotor / 100; });
    section('Calculated at rated duty (MYENG engine)');
    line('eta', 'Pump efficiency at duty', '%', X.pct, function (b, r) { return +r.eta.toFixed(6); });
    line('ratio', 'Rated flow / BEP flow', '%', X.pct, function (b, r) { return +r.ratio.toFixed(6); });
    line('Ph', 'Hydraulic power', 'kW', X.dec2, function (b, r) { return +r.Ph.toFixed(4); });
    line('Pshaft', 'Shaft power', 'kW', X.dec2, function (b, r) { return +r.Pshaft.toFixed(4); });
    line('Pin', 'Electrical input', 'kW', X.dec2, function (b, r) { return +r.Pin.toFixed(4); });
    line('motorReq', 'API 610 minimum driver rating', 'kW', X.dec2, function (b, r) { return +r.motorReq.toFixed(4); });
    section('Lifecycle cost · ' + state.duty.horizon + ' years (Excel formulas)');
    line('energyYr', 'Annual energy cost', 'USD/yr', X.money, function (b, r) { return +r.energyYr.toFixed(2); }, function (c) { return c + R.Pin + '*' + B.hours + '*' + B.tariff; });
    line('energyH', 'Energy over horizon', 'USD', X.money, function (b, r) { return +r.energyH.toFixed(2); }, function (c) { return c + R.energyYr + '*' + B.horizon; });
    line('maintH', 'Maintenance over horizon', 'USD', X.money, function (b, r) { return +r.maintH.toFixed(2); }, function (c) { return c + R.maint + '*' + B.horizon; });
    R.tco = add([cell('A', 0, 'Total lifecycle cost (TCO)', X.section), cell('B', 0, 'USD', X.section)].concat(state.bids.map(function (b, i) {
      var c = BC(i); return cell(c, 0, +result.bids[i].tco.toFixed(2), i === rec ? X.moneyBRec : X.moneyB, 'SUM(' + c + R.capex + ',' + c + R.energyH + ',' + c + R.maintH + ')');
    })), 22);
    line('delta', 'ΔTCO vs lowest-CapEx bid (negative = saves)', 'USD', X.money, function (b, r) { return +(-r.savingsVsCheapest).toFixed(2); }, function (c) { return c + R.tco + '-' + BC(ch) + R.tco; });
    line('co2', 'Annual CO₂', 't/yr', X.dec2, function (b, r) { return +r.co2.toFixed(4); }, function (c) { return c + R.Pin + '*' + B.hours + '*' + B.ef + '/1000'; });
    line('npshm', 'NPSH margin (NPSHa − NPSHr)', 'm', X.dec2, function (b, r) { return +r.npshMargin.toFixed(4); }, function (c) { return B.npsha + '-' + c + R.npshr; });
    section('Compliance');
    line('status', 'Status', '', X.text, function (b, r, i) { return i === rec && result.anyCompliant ? 'RECOMMENDED' : r.compliant ? 'Compliant' : 'Non-compliant'; });
    var devRow = add([cell('A', 0, 'Deviations (API 610 & project spec)', X.label), cell('B', 0, '', X.unit)].concat(state.bids.map(function (b, i) {
      var t = result.bids[i].deviations.map(function (d) { return '[' + d.sev.toUpperCase() + '] ' + d.text; }).join('\n') || 'None';
      return cell(BC(i), 0, t, i === rec ? X.wrapRec : X.wrap);
    })));
    var maxDev = Math.max.apply(null, result.bids.map(function (r) { return Math.max(1, r.deviations.length); }));
    rowH[devRow] = 15 + maxDev * 30;
    add([]);
    var nr = add([cell('A', 0, 'Generated in the browser by MYENG Studio. Figures in templates are illustrative, not vendor-published. Formulas mirror engine.js (undiscounted, constant tariff); confirm against certified vendor curves before award.', X.note)], 30);
    merges.push('A' + nr + ':' + last + nr);

    // sheet XML
    var widths = { A: 44, B: 12 };
    state.bids.forEach(function (b, i) { widths[BC(i)] = Math.max(24, bidName(i).length + 16); });
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="' + hr + '" topLeftCell="A' + (hr + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="18" customHeight="1"/><cols>' +
      Object.keys(widths).map(function (k) { var i = k.charCodeAt(0) - 64; return '<col min="' + i + '" max="' + i + '" width="' + widths[k] + '" customWidth="1"/>'; }).join('') +
      '</cols><sheetData>' +
      rows.map(function (cells, idx) {
        var r = idx + 1, ht = rowH[r] ? ' ht="' + rowH[r] + '" customHeight="1"' : '';
        cells.sort(function (a, b) { return a.c.localeCompare(b.c); });
        return '<row r="' + r + '"' + ht + '>' + cells.map(function (x) {
          var ref = x.c + r, st = ' s="' + x.s + '"';
          if (x.f) return '<c r="' + ref + '"' + st + '><f>' + xmlEsc(x.f) + '</f><v>' + x.v + '</v></c>';
          if (typeof x.v === 'number') return '<c r="' + ref + '"' + st + '><v>' + x.v + '</v></c>';
          if (x.v === '' || x.v == null) return '<c r="' + ref + '"' + st + '/>';
          return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(x.v) + '</t></is></c>';
        }).join('') + '</row>';
      }).join('') +
      '</sheetData><mergeCells count="' + merges.length + '">' + merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>MYENG Technical Bid Evaluation</dc:title><dc:creator>MYENG Studio</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + 'Z</dcterms:created></cp:coreProperties>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="TBE Evaluation" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ];
    return zip(files);
  }
  function exportXlsx() {
    var blob = xlsxWorkbook(), url = URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = 'MYENG_TBE_Evaluation.xlsx'; a.rel = 'noopener';
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('Excel workbook exported — MYENG_TBE_Evaluation.xlsx');
  }

  /* ================================================================
     Studio theme: Obsidian (default) or Stone — a per-viewer preference
     ================================================================ */
  var THEME_KEY = 'myeng.studioTheme';
  function setStudioTheme(t, persist) {
    t = t === 'stone' ? 'stone' : 'obsidian';
    $('#app').setAttribute('data-theme', t);
    $$('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); });
    if (persist) { try { window.localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage unavailable */ } }
    if (hqChart && hqChart.cur) hqChart.draw();
    if (pumpTwin && pumpTwin.setTheme) pumpTwin.setTheme(t === 'stone');
  }
  function initStudioTheme() {
    var t = 'stone';
    try { t = window.localStorage.getItem(THEME_KEY) || 'stone'; } catch (e) { /* storage unavailable */ }
    setStudioTheme(t, false);
    $$('[data-theme-set]').forEach(function (b) { b.addEventListener('click', function () { setStudioTheme(b.getAttribute('data-theme-set'), true); }); });
  }
  function chartPalette() {
    var stone = $('#app') && $('#app').getAttribute('data-theme') === 'stone';
    return stone ? { grid: '#E2E1DC', axis: '#6E6D68', label: '#6E6D68', sys: '#111214', bg: '#FBFAF7', ink: '#111214', soft: 'rgba(17,18,20,.35)', pill: '#FBFAF7', pillB: '#E2E1DC', eff: '#8E8D86' }
                 : { grid: '#282B31', axis: '#8E9196', label: '#8E9196', sys: '#F4F3EF', bg: '#111214', ink: '#F4F3EF', soft: 'rgba(244,243,239,.35)', pill: '#111214', pillB: '#282B31', eff: '#8E9196' };
  }

  /* ================================================================
     Tabs & navigation
     ================================================================ */
  var activeTab = 'tbe';
  var TAB_SLUG = { tbe: 'tbe', hyd: 'hydraulics', ai: 'parser' };
  // One ink bar slides between tabs, so no stale indicator can remain under an inactive tab.
  function moveInk() {
    var on = $('.tabs [aria-selected="true"]'), ink = $('.tabs__ink');
    if (!on || !ink) return;
    // exact: the ink spans the label (tab box minus its own padding)
    var cs = getComputedStyle(on), pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    ink.style.width = Math.max(0, on.offsetWidth - pl - pr) + 'px';
    ink.style.transform = 'translateX(' + (on.offsetLeft + pl) + 'px)';
  }
  // Mobile: the header scrolls away; only the slim tab bar stays sticky, so it lives outside the header there.
  var mqTabs = window.matchMedia('(max-width: 820px)');
  function placeTabs() {
    var tabs = $('.tabs'), bar = $('.app__bar');
    if (!tabs || !bar) return;
    if (mqTabs.matches) { if (tabs.parentNode === bar) bar.parentNode.insertBefore(tabs, bar.nextSibling); }
    else if (tabs.parentNode !== bar) bar.insertBefore(tabs, $('.themeseg', bar));
    moveInk();
  }
  function activateTab(name, focus, keepHash) {
    activeTab = name;
    $$('.tabs [role=tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    $$('.tabpanel').forEach(function (p) { p.hidden = p.id !== 'panel-' + name; });
    if (name === 'hyd' && hqChart) { hqChart.cur = null; hqChart.set(chartTarget(study)); }
    moveInk();
    twinSync();
    if (appOpen && $('#app').scrollTop > 0) $('#app').scrollTo({ top: 0 });
    if (!keepHash && appOpen) history.replaceState(history.state, '', '#studio/' + TAB_SLUG[name]);
  }

  /* ---------- Two-view router:  /  <->  #studio[/tab] ---------- */
  var appOpen = false, returnFocus = null;
  function parseRoute() {
    var h = location.hash;
    if (!/^#studio/.test(h)) return null;
    var slug = h.split('/')[1] || 'tbe';
    for (var k in TAB_SLUG) if (TAB_SLUG[k] === slug) return k;
    return 'tbe';
  }
  function route() {
    var tab = parseRoute();
    if (tab) openApp(tab); else closeApp();
  }
  function openApp(tab) {
    var app = $('#app');
    activateTab(tab, false, true);
    if (appOpen) return;
    appOpen = true;
    returnFocus = doc.activeElement;
    app.removeAttribute('inert'); $('#site').setAttribute('inert', '');
    doc.body.classList.add('app-open');
    app.classList.add('is-open');
    app.scrollTop = 0;
    requestAnimationFrame(function () {
      moveInk();
      app.focus({ preventScroll: true });
    });
    doc.title = 'MYENG Studio — Technical Bid Evaluation';
    twinSync();
  }
  function closeApp() {
    if (!appOpen) return;
    appOpen = false;
    var app = $('#app');
    app.classList.remove('is-open');
    app.setAttribute('inert', ''); $('#site').removeAttribute('inert');
    doc.body.classList.remove('app-open');
    doc.title = 'MYENG — Rotating Equipment Intelligence';
    twinSync();
    if (returnFocus && returnFocus.focus && doc.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  function launch(tab) {
    var target = '#studio/' + TAB_SLUG[tab || 'tbe'];
    if (parseRoute()) { activateTab(tab || 'tbe'); return; }
    history.pushState({ fromSite: true }, '', target);
    route();
  }
  function backToSite() {
    if (history.state && history.state.fromSite) { history.back(); return; }
    history.pushState(null, '', location.pathname + location.search);
    route();
  }

  function bindNav() {
    $$('[data-launch]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); launch(b.getAttribute('data-launch')); });
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);
    $('#btnBack').addEventListener('click', backToSite);
    $$('[data-home]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (appOpen) {
          // close the Studio and land on the very top of the site, no hash left behind
          history.pushState(null, '', location.pathname + location.search);
          route();
          window.scrollTo({ top: 0, behavior: 'auto' });
          return;
        }
        if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && appOpen && !$('#modal').open) backToSite(); });
    window.addEventListener('resize', moveInk);
    if (mqTabs.addEventListener) mqTabs.addEventListener('change', placeTabs); else if (mqTabs.addListener) mqTabs.addListener(placeTabs);
    placeTabs();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(moveInk);
    $$('.tabs [role=tab]').forEach(function (b) {
      b.addEventListener('click', function () { activateTab(b.getAttribute('data-tab')); });
      b.addEventListener('keydown', function (e) {
        var order = ['tbe', 'hyd', 'ai'], i = order.indexOf(activeTab);
        if (e.key === 'ArrowRight') { activateTab(order[(i + 1) % 3], true); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { activateTab(order[(i + 2) % 3], true); e.preventDefault(); }
        if (e.key === 'Home') { activateTab('tbe', true); e.preventDefault(); }
        if (e.key === 'End') { activateTab('ai', true); e.preventDefault(); }
      });
    });
    $$('[data-load-sample]').forEach(function (b) {
      b.addEventListener('click', function () {
        loadSample();
        launch('tbe');
        toast('Sample case study loaded — 3 bids, ' + dutyLabel() + '.');
      });
    });
    $('#hydVendor').addEventListener('change', function () {
      state.hyd.vendor = this.value === 'rec' ? 'rec' : Number(this.value);
      schedule();
    });
  }

  function loadSample() { openTemplateProject('p01'); }

  /* ================================================================
     Modal
     ================================================================ */
  var modal, lastFocus;
  function openModal(title, bodyHtml, actions) {
    modal = modal || $('#modal');
    modal.classList.remove('modal--composer');
    lastFocus = doc.activeElement;
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    var a = $('#modalActions');
    a.innerHTML = '';
    (actions || []).forEach(function (act) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (act.cls || 'btn--line'); b.textContent = act.label;
      b.addEventListener('click', act.run);
      a.appendChild(b);
    });
    $('#modalBody').scrollTop = 0;
    enhanceSelects($('#modalBody'));
    doc.documentElement.classList.add('modal-open');
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
  }
  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close(); else modal.removeAttribute('open');
  }

  /* ================================================================
     Downloads & printing
     ================================================================ */
  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  var REPORT_CSS =
    '@page{size:A4;margin:14mm 16mm}' +
    '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'body{margin:0;background:#E2E1DC;color:#111214;font:10pt/1.5 Inter,Helvetica,Arial,sans-serif}' +
    '.sheet{width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:14mm 16mm;box-shadow:0 20px 60px -30px rgba(17,18,20,.45)}' +
    '@media print{body{background:#fff}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}' +
    '.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}' +
    '.cover{position:relative;background:#F4F3EF;border:1px solid #E2E1DC;padding:9mm 12mm 7mm;break-inside:avoid;overflow:hidden}' +
    '.cover__tabs{position:absolute;right:0;top:10mm;display:grid;gap:5mm}.cover__tabs i{display:block;width:4.5mm;height:13mm;background:#E04619}.cover__tabs i+i{height:7mm}' +
    '.brandrow{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15pt;letter-spacing:-.03em}.brandrow svg{width:27px;height:30px}' +
    '.cover__eyebrow{margin:9mm 0 0;font:500 7.5pt "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#6E6D68}' +
    '.cover h1{margin:2mm 0 0;font-size:25pt;font-weight:800;letter-spacing:-.035em;line-height:1;text-transform:uppercase;max-width:135mm}' +
    '.cover__sub{margin:3mm 0 0;font-size:11.5pt;letter-spacing:-.01em}.cover__sub span{color:#6E6D68}' +
    '.rev{display:flex;flex-wrap:wrap;align-items:center;gap:2mm 5mm;margin-top:6mm;padding-top:3mm;border-top:1px solid #111214;font:500 7.5pt "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#6E6D68}' +
    '.rev b{background:#111214;color:#F4F3EF;padding:1mm 2.5mm;font-weight:600}' +
    '.kpis{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #E2E1DC;margin-top:6mm;break-inside:avoid}' +
    '.kpi{padding:3.5mm 4mm;border-right:1px solid #E2E1DC}.kpi:last-child{border-right:0}' +
    '.kpi span{display:block;font:500 6.8pt "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#6E6D68}' +
    '.kpi b{display:block;margin-top:1.5mm;font:600 12pt "JetBrains Mono",monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em}' +
    '.kpi em{display:block;margin-top:.8mm;font-style:normal;font-size:7.5pt;color:#6E6D68}.kpi--rec{box-shadow:inset 0 2px 0 #E04619}.kpi--rec b{font-family:Inter,sans-serif;font-size:11pt}' +
    '.sec{margin-top:7mm;break-inside:avoid}.flow{margin-top:7mm}' +
    'h2{margin:0 0 3mm;padding-bottom:2mm;border-bottom:1px solid #111214;font:600 7.8pt "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#111214;break-after:avoid}' +
    'h2::before{content:"";display:inline-block;width:2mm;height:2mm;background:#E04619;margin-right:2.5mm;vertical-align:.2mm}' +
    'p{margin:0 0 2mm}.callout{border-left:2px solid #E04619;background:#F4F3EF;padding:3.5mm 4.5mm;font-size:10.5pt}' +
    'table{width:100%;border-collapse:collapse;font-size:8.2pt}thead{display:table-header-group}tr{break-inside:avoid}.sec--table{break-inside:auto}' +
    'th,td{padding:1.45mm 2.5mm;text-align:right;font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums;border-bottom:1px solid #E2E1DC}' +
    'th:first-child,td:first-child{text-align:left;font-family:Inter,sans-serif}' +
    'thead th{font-size:7pt;letter-spacing:.06em;text-transform:uppercase;color:#6E6D68;border-bottom:1px solid #111214;font-weight:500}' +
    'tbody tr:nth-child(odd) td{background:#F4F3EF}td.rec,th.rec{background:rgba(224,70,25,.07)!important;font-weight:600}th.rec{color:#111214;box-shadow:inset 0 2px 0 #E04619}' +
    '.kv td{text-align:left;font-family:Inter,sans-serif}.kv td:first-child{width:34%;color:#6E6D68}.kv td+td{font-family:"JetBrains Mono",monospace}' +
    '.chart{border:1px solid #E2E1DC;padding:3mm 3mm 1mm}.chart svg{width:100%;height:auto;display:block}.legend{display:flex;gap:5mm;font:500 7pt "JetBrains Mono",monospace;color:#6E6D68;text-transform:uppercase;letter-spacing:.06em;margin:2mm 0 0 1mm}' +
    '.legend i{display:inline-block;width:5mm;height:0;border-top:1.6px solid;vertical-align:middle;margin-right:1.5mm}' +
    '.devb{break-inside:avoid;padding:2.5mm 0;border-bottom:1px solid #E2E1DC}.devb h3{margin:0 0 1mm;font-size:9.5pt}.devb ul{margin:0;padding-left:4.5mm;font-size:8.6pt}.devb li{margin:.6mm 0}' +
    '.sev{font:600 6.8pt "JetBrains Mono",monospace;letter-spacing:.06em;padding:.3mm 1.2mm;border:1px solid #111214;margin-right:1.5mm}.sev--major{border-color:#E04619}' +
    '.formulas{columns:2;column-gap:8mm;font-size:8.2pt;padding-left:4mm}.formulas li{break-inside:avoid;margin-bottom:1.2mm}' +
    '.close{break-inside:avoid;margin-top:12mm}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}' +
    '.sign div{border-top:1.2px solid #111214;padding-top:2mm;font:500 7pt "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#6E6D68}' +
    '.sign em{display:block;margin-top:8mm;font-style:normal;letter-spacing:0;text-transform:none;font-size:7.5pt}' +
    '.note{margin-top:6mm;font-size:7.5pt;color:#6E6D68;break-inside:avoid}';
  var MARK_SVG = '<svg width="25" height="28" viewBox="12 7 76 85.5" style="color:#111214" aria-hidden="true"><polygon fill="currentColor" points="12.00,7.00 48.34,55.10 45.01,59.50 12.00,15.80"/><polygon fill="currentColor" points="12.00,20.20 43.35,61.70 40.03,66.10 12.00,29.00"/><polygon fill="currentColor" points="12.00,33.40 38.37,68.30 35.04,72.70 18.20,50.41 18.20,92.50 12.00,92.50"/><polygon fill="currentColor" points="21.40,59.04 27.60,67.25 27.60,92.50 21.40,92.50"/><polygon fill="currentColor" points="88.00,7.00 88.00,15.80 40.03,79.30 36.70,74.90"/><polygon fill="#E04619" points="88.00,20.20 88.00,29.00 45.01,85.90 41.69,81.50"/><polygon fill="currentColor" points="88.00,33.40 46.68,88.10 50.00,92.50 81.80,50.41 81.80,92.50 88.00,92.50"/><polygon fill="currentColor" points="72.40,67.25 78.60,59.04 78.60,92.50 72.40,92.50"/></svg>';
  function standalone(title, inner) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">' +
      '<style>' + REPORT_CSS + '</style></head><body><main class="sheet">' + inner + '</main></body></html>';
  }
  function printDoc(title, inner) {
    var w = window.open('', '_blank');
    if (!w) { download(fileSlug(title) + '.html', standalone(title, inner), 'text/html'); toast('Pop-up blocked — report downloaded as HTML instead.'); return; }
    w.document.open(); w.document.write(standalone(title, inner)); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* user can print manually */ } }, 600);
  }
  function fileSlug(t) { return 'MYENG_' + t.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + today(); }

  /* ---------- CSV ---------- */
  function csv() {
    var rows = [], q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    rows.push(['MYENG Technical Bid Evaluation', 'Sample Case Study · ' + state.project.tag + ' · ' + dutyLabel(), 'Generated ' + new Date().toISOString()]);
    rows.push(['Duty Q (m3/h)', state.duty.Q], ['Total head H (m)', state.duty.H], ['Operating hours (h/yr)', state.duty.hours], ['Tariff ($/kWh)', state.duty.tariff], ['Horizon (yrs)', state.duty.horizon],
      ['Density (kg/m3)', state.basis.rho], ['Min efficiency (%)', state.basis.minEff], ['Required material class', state.basis.material], ['Min MAWP (bar g)', state.basis.minMawp], ['Max lead time (weeks)', state.basis.maxLead], ['Grid EF (kg CO2/kWh)', state.basis.ef], ['NPSHa at rated flow (m)', result.npsha.npsha.toFixed(2)], []);
    rows.push(['Parameter', 'Unit'].concat(state.bids.map(function (b, i) { return 'Bid ' + 'ABC'[i]; })));
    rows.push(['Vendor', ''].concat(state.bids.map(function (b) { return b.vendor; })));
    rows.push(['Model', ''].concat(state.bids.map(function (b) { return b.model; })));
    INPUT_ROWS.forEach(function (r) { if (r.k) rows.push([r.label, r.unit].concat(state.bids.map(function (b) { return b[r.k]; }))); });
    var raw = {
      eta: function (r) { return (r.eta * 100).toFixed(2); }, ratio: function (r) { return (r.ratio * 100).toFixed(1); },
      Ph: function (r) { return r.Ph.toFixed(2); }, Pshaft: function (r) { return r.Pshaft.toFixed(2); }, Pin: function (r) { return r.Pin.toFixed(2); },
      motorReq: function (r) { return r.motorReq.toFixed(2); }, npshMargin: function (r) { return r.npshMargin.toFixed(2); },
      energyYr: function (r) { return r.energyYr.toFixed(0); }, energyH: function (r) { return r.energyH.toFixed(0); }, maintH: function (r) { return r.maintH.toFixed(0); },
      tco: function (r) { return r.tco.toFixed(0); }, savingsVsCheapest: function (r) { return (-r.savingsVsCheapest).toFixed(0); }, co2: function (r) { return r.co2.toFixed(2); }
    };
    OUT_ROWS.forEach(function (r) { if (r.k) rows.push([r.label.replace(/<[^>]+>/g, ''), r.unit].concat(result.bids.map(function (x) { return raw[r.k](x); }))); });
    rows.push(['Status', ''].concat(result.bids.map(function (r, i) { return i === result.recommended && result.anyCompliant ? 'RECOMMENDED' : r.compliant ? 'Compliant' : 'Non-compliant'; })));
    rows.push(['Deviations', ''].concat(result.bids.map(function (r) { return r.deviations.map(function (d) { return '[' + d.sev.toUpperCase() + '] ' + d.text; }).join(' | ') || 'None'; })));
    download(fileSlug('TBE_Matrix') + '.csv', '﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
    toast('CSV exported — ' + rows.length + ' rows.');
  }

  /* ---------- Reports (A4, Swiss editorial) ---------- */
  function repCover(kind) {
    return '<header class="cover"><div class="cover__tabs" aria-hidden="true"><i></i><i></i></div>' +
      '<div class="brandrow">' + MARK_SVG + 'MYENG</div>' +
      '<p class="cover__eyebrow">Rotating Equipment Intelligence</p>' +
      '<h1>Technical Evaluation Report</h1>' +
      '<p class="cover__sub">' + kind + ' <span>· ' + esc(state.project.tag) + ' · ' + esc(state.project.service) + '</span></p>' +
      '<div class="rev"><b>REV 04</b><span>' + dutyLabel() + '</span><span>' + state.duty.horizon + '-yr horizon</span><span>Issued ' + today() + '</span><span>Illustrative template data</span></div></header>';
  }
  function repKpis() {
    var rec = result.recommended, r = result.bids[rec], m = r.npshMargin;
    return '<section class="kpis">' +
      '<div class="kpi kpi--rec"><span>' + (result.anyCompliant ? 'Recommended' : 'Lowest TCO · not compliant') + '</span><b>' + esc(bidName(rec)) + '</b><em>' + (result.anyCompliant ? 'Lowest TCO among compliant bids' : 'Issue RFIs before award') + '</em></div>' +
      '<div class="kpi"><span>' + state.duty.horizon + '-yr TCO</span><b>' + money(r.tco) + '</b><em>CapEx ' + moneyShort(state.bids[rec].capex) + ' · energy ' + moneyShort(r.energyH) + '</em></div>' +
      '<div class="kpi"><span>vs lowest-CapEx bid</span><b>' + savesText(r) + '</b><em>ΔTCO ' + deltaTco(r) + '</em></div>' +
      '<div class="kpi"><span>NPSH margin</span><b>' + (m >= 0 ? '+' : '') + num(m, 2) + ' m</b><em>' + (m >= 1 ? 'Safe · min 1.0 m' : 'Below the 1.0 m minimum') + '</em></div></section>';
  }
  function bidTable() {
    var rec = result.recommended;
    var h = '<table><thead><tr><th>Parameter</th>' + state.bids.map(function (b, i) { return '<th' + (i === rec ? ' class="rec"' : '') + '>' + esc(bidName(i)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var row = function (label, f) { h += '<tr><td>' + label + '</td>' + result.bids.map(function (r, i) { return '<td' + (i === rec ? ' class="rec"' : '') + '>' + f(r, state.bids[i]) + '</td>'; }).join('') + '</tr>'; };
    row('CapEx', function (r, b) { return money(b.capex); });
    row('BEP efficiency / at duty', function (r, b) { return num(b.etaBep, 1) + ' / ' + num(r.eta * 100, 1) + '%'; });
    row('Electrical input', function (r) { return num(r.Pin, 1) + ' kW'; });
    row('Annual energy cost', function (r) { return money(r.energyYr); });
    row(state.duty.horizon + '-yr TCO', function (r) { return money(r.tco); });
    row('ΔTCO vs lowest-CapEx bid', function (r) { return deltaTco(r); });
    row('NPSH margin', function (r) { return num(r.npshMargin, 2) + ' m'; });
    row('Material / MAWP', function (r, b) { return esc(b.material) + ' / ' + num(b.mawp) + ' bar'; });
    row('Motor (min. API 610)', function (r, b) { return num(b.motorKw) + ' (' + num(r.motorReq, 1) + ') kW'; });
    row('Lead time', function (r, b) { return num(b.lead) + ' wk'; });
    row('Status', function (r, b, i) { return r.compliant ? 'Compliant' : 'Non-compliant'; });
    return h + '</tbody></table>';
  }
  function devHtml() {
    return result.bids.map(function (r, i) {
      return '<div class="devb"><h3>' + esc(bidName(i)) + '</h3><ul>' + (r.deviations.length ? r.deviations.map(function (d) {
        return '<li><span class="sev' + (d.sev === 'major' ? ' sev--major' : '') + '">' + d.sev.toUpperCase() + '</span>' + esc(d.text) + '</li>';
      }).join('') : '<li>No deviations detected.</li>') + '</ul></div>';
    }).join('');
  }
  // keeps a section heading on the same page as its first block
  function keepWithFirst(title, blocksHtml) {
    var parts = blocksHtml.split('<div class="devb">');
    var first = parts[1] ? '<div class="devb">' + parts[1] : '';
    return '<section class="flow"><div style="break-inside:avoid"><h2>' + title + '</h2>' + first + '</div>' + parts.slice(2).map(function (p) { return '<div class="devb">' + p; }).join('') + '</section>';
  }
  // Static, print-crisp H–Q chart built from the same study the Studio shows.
  function reportChart() {
    if (!study || study.noFlow) return '<p>No delivery at ' + state.hyd.speed + '% speed — shutoff head below static head.</p>';
    var m = chartTarget(study), W = 680, H = 250, pl = 46, pr = 14, pt = 14, pb = 34, n = m.pump.length;
    var X = function (q) { return pl + q / m.qMax * (W - pl - pr); }, Y = function (h) { return H - pb - h / m.hMax * (H - pt - pb); };
    var path = function (arr) { var s = '', pen = false; for (var i = 0; i < n; i++) { var v = arr[i]; if (!isFinite(v) || v < 0 || v > m.hMax * 1.02) { pen = false; continue; } s += (pen ? 'L' : 'M') + X(m.qMax * i / (n - 1)).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; } return s; };
    var g = '', qs = niceStep(m.qMax / 6), hs = niceStep(m.hMax / 5), q, h;
    for (q = 0; q <= m.qMax + 1e-6; q += qs) g += '<line x1="' + X(q) + '" x2="' + X(q) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#E2E1DC"/><text x="' + X(q) + '" y="' + (H - pb + 14) + '" text-anchor="middle">' + num(q) + '</text>';
    for (h = 0; h <= m.hMax + 1e-6; h += hs) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(h) + '" y2="' + Y(h) + '" stroke="#E2E1DC"/><text x="' + (pl - 6) + '" y="' + (Y(h) + 3) + '" text-anchor="end">' + num(h) + '</text>';
    var op = m.op, ox = X(op.Q), oy = Y(op.H), lab = 'OP ' + num(op.Q) + ' m³/h · ' + num(op.H, 1) + ' m', tw = lab.length * 5.6 + 14;
    var full = Math.abs(m.pump[1] - m.full[1]) > 0.01 ? '<path d="' + path(m.full) + '" fill="none" stroke="#E04619" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="4 4"/>' : '';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" font-family="JetBrains Mono, monospace" font-size="9" fill="#6E6D68" role="img" aria-label="Pump and system curves with operating point">' + g +
      '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + (H - pb) + '" y2="' + (H - pb) + '" stroke="#6E6D68"/><line x1="' + pl + '" x2="' + pl + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#6E6D68"/>' +
      '<text x="' + (W - pr) + '" y="' + (H - 4) + '" text-anchor="end">Q m³/h</text><text x="' + (pl - 6) + '" y="' + (pt - 4) + '" text-anchor="end">H m</text>' + full +
      '<path d="' + path(m.sys) + '" fill="none" stroke="#111214" stroke-width="1.6"/><path d="' + path(m.pump) + '" fill="none" stroke="#E04619" stroke-width="2"/>' +
      '<line x1="' + ox + '" x2="' + ox + '" y1="' + oy + '" y2="' + (H - pb) + '" stroke="#111214" stroke-opacity=".35" stroke-dasharray="2 3"/>' +
      '<circle cx="' + ox + '" cy="' + oy + '" r="4.5" fill="#fff" stroke="#111214" stroke-width="1.4"/><circle cx="' + ox + '" cy="' + oy + '" r="1.6" fill="#E04619"/>' +
      '<rect x="' + (ox + 10) + '" y="' + (oy - 22) + '" width="' + tw + '" height="16" rx="8" fill="#F4F3EF" stroke="#E2E1DC"/><text x="' + (ox + 10 + tw / 2) + '" y="' + (oy - 11) + '" text-anchor="middle" fill="#111214">' + lab + '</text></svg>' +
      '<div class="legend"><span><i style="color:#E04619"></i>Pump at ' + state.hyd.speed + '% speed</span>' + (full ? '<span><i style="color:#E04619;opacity:.45;border-top-style:dashed"></i>Pump 100%</span>' : '') + '<span><i style="color:#111214"></i>System</span><span>' + esc(bidName(study.bidIndex)) + '</span></div>';
  }
  function signBar(note) { return '<div class="close"><div class="sign"><div>Prepared<em>Name · date</em></div><div>Checked<em>Name · date</em></div><div>Approved<em>Name · date</em></div></div><p class="note">' + note + '</p></div>'; }
  function awardInner() {
    var rec = result.recommended, r = result.bids[rec], ch = result.cheapest, n = state.duty.horizon;
    var callout = result.anyCompliant
      ? 'Recommend award to <b>' + esc(bidName(rec)) + '</b>. It has the lowest ' + n + '-year total cost of ownership among technically compliant bids at <b>' + money(r.tco) + '</b>' +
        (rec === ch ? ', and is also the lowest CapEx offer.' : ', ' + money(r.savingsVsCheapest) + ' below the lowest-CapEx offer (' + esc(bidName(ch)) + ') despite a ' + money(state.bids[rec].capex - state.bids[ch].capex) + ' higher purchase price.')
      : 'No bid is fully compliant. <b>' + esc(bidName(rec)) + '</b> has the lowest TCO (' + money(r.tco) + ') but carries major deviations. Issue RFIs before award.';
    return repCover('Award recommendation') + repKpis() +
      '<section class="sec"><h2>Recommendation</h2><div class="callout">' + callout + '</div></section>' +
      '<section class="sec sec--table"><h2>Evaluation summary</h2>' + bidTable() + '</section>' +
      '<section class="sec"><h2>Hydraulic operating point</h2><div class="chart">' + reportChart() + '</div></section>' +
      '<section class="sec"><h2>Basis</h2><p>' + num(state.duty.hours) + ' h/yr at $' + state.duty.tariff.toFixed(3) + '/kWh over ' + n + ' years, undiscounted. Density ' + num(state.basis.rho) + ' kg/m³. Required material class ' + esc(state.basis.material) + ', minimum casing MAWP ' + num(state.basis.minMawp) + ' bar(g), minimum efficiency ' + num(state.basis.minEff, 1) + '%, NPSHa ' + num(result.npsha.npsha, 2) + ' m at rated flow.</p></section>' +
      keepWithFirst('Deviations · API 610 &amp; project specification', devHtml()) +
      signBar('Template figures are illustrative and are not vendor-published data. Confirm against certified performance curves before award. Generated in the browser by MYENG Studio.');
  }
  function auditInner() {
    var d = state.duty, b = state.basis, h = state.hyd, st = study;
    var hy = st.noFlow ? '<p>No delivery at ' + h.speed + '% speed — shutoff head below static head.</p>' :
      '<table class="kv"><tbody>' +
      '<tr><td>Pump curve source</td><td>' + esc(bidName(st.bidIndex)) + ' · H0 = ' + num(h.shutoff, 2) + ' × H<sub>rated</sub> = ' + num(st.H0, 1) + ' m</td></tr>' +
      '<tr><td>Speed</td><td>' + h.speed + '% (Q ×' + st.affinity.Q.toFixed(3) + ', H ×' + st.affinity.H.toFixed(3) + ', P ×' + st.affinity.P.toFixed(3) + ')</td></tr>' +
      '<tr><td>Operating point</td><td>' + num(st.op.Q, 1) + ' m³/h @ ' + num(st.op.H, 2) + ' m</td></tr>' +
      '<tr><td>Discharge line</td><td>ID ' + num(h.D, 1) + ' mm · L ' + num(h.L) + ' m · ε ' + h.eps + ' mm · ΣK ' + h.K + ' · static ' + num(h.zStatic, 1) + ' m</td></tr>' +
      '<tr><td>Velocity · Re · f · h<sub>f</sub></td><td>' + num(st.vDis, 2) + ' m/s · ' + sci(st.Re) + ' · ' + num(st.f, 4) + ' · ' + num(st.hf, 2) + ' m</td></tr>' +
      '<tr><td>Pump η at OP</td><td>' + num(st.etaOp * 100, 1) + ' %</td></tr>' +
      '<tr><td>Input power VFD / throttled</td><td>' + num(st.Pvfd, 1) + ' / ' + num(st.Pthr, 1) + ' kW</td></tr>' +
      '<tr><td>Saving</td><td>' + num(st.saveKw, 1) + ' kW · ' + money(st.saveUsd) + '/yr · ' + num(st.saveCo2, 1) + ' t CO₂/yr</td></tr>' +
      '<tr><td>NPSHa / NPSHr at OP</td><td>' + num(st.npsha, 2) + ' / ' + num(st.npshr, 2) + ' m (margin ' + num(st.npshMargin, 2) + ' m)</td></tr>' +
      '</tbody></table>';
    return repCover('Audit trail') + repKpis() +
      '<section class="sec"><h2>1 · Inputs</h2><table class="kv"><tbody>' +
      '<tr><td>Duty</td><td>Q ' + num(d.Q) + ' m³/h · H ' + num(d.H) + ' m · ρ ' + num(b.rho) + ' kg/m³</td></tr>' +
      '<tr><td>Economics</td><td>' + num(d.hours) + ' h/yr · $' + d.tariff.toFixed(3) + '/kWh · ' + d.horizon + ' yrs · EF ' + b.ef + ' kg/kWh</td></tr>' +
      '<tr><td>Spec limits</td><td>η ≥ ' + b.minEff + '% · class ' + esc(b.material) + ' · MAWP ≥ ' + b.minMawp + ' bar(g) · lead ≤ ' + b.maxLead + ' wk</td></tr>' +
      '<tr><td>Suction</td><td>P ' + h.Psurf + ' kPa abs · P<sub>v</sub> ' + h.Pvap + ' kPa · z<sub>s</sub> ' + h.zs + ' m · ID ' + h.Ds + ' mm · L ' + h.Ls + ' m · ΣK ' + h.Ks + '</td></tr>' +
      '<tr><td>NPSHa at rated flow</td><td>' + num(result.npsha.pressureHead, 2) + ' + (' + num(h.zs, 2) + ') − ' + num(result.npsha.suctionLoss, 2) + ' = ' + num(result.npsha.npsha, 2) + ' m</td></tr>' +
      '</tbody></table></section>' +
      '<section class="sec sec--table"><h2>2 · Bid evaluation</h2>' + bidTable() + '</section>' +
      '<section class="sec"><h2>3 · Hydraulic operating point</h2><div class="chart">' + reportChart() + '</div></section>' +
      '<section class="sec"><h2>4 · Hydraulic study</h2>' + hy + '</section>' +
      keepWithFirst('5 · Deviations · API 610 &amp; project specification', devHtml()) +
      '<section class="sec"><h2>6 · Formulas</h2><ul class="formulas">' +
      '<li>P<sub>h</sub> = ρgQH / 3.6×10⁶ kW, g = 9.81 m/s²</li><li>η(Q) = η<sub>BEP</sub>·r(2−r), r = Q/Q<sub>BEP</sub></li>' +
      '<li>P<sub>in</sub> = P<sub>h</sub> / (η<sub>pump</sub>·η<sub>motor</sub>) [· η<sub>VFD</sub> when speed-controlled]</li>' +
      '<li>TCO = CapEx + n·(P<sub>in</sub>·hours·tariff) + n·maintenance (undiscounted)</li>' +
      '<li>h<sub>f</sub> = (f·L/D + ΣK)·v²/2g; f = 64/Re (laminar), Swamee–Jain (turbulent), linear blend 2300–4000</li>' +
      '<li>Pump curve H<sub>s</sub>(Q) = s²H<sub>0</sub> − (H<sub>0</sub> − H<sub>d</sub>)(Q/Q<sub>d</sub>)²; affinity Q∝N, H∝N², P∝N³</li>' +
      '<li>NPSHa = (P<sub>s</sub> − P<sub>v</sub>)/ρg + z<sub>s</sub> − h<sub>f,s</sub>; NPSHr scaled ∝ Q²; minimum margin 1.0 m</li>' +
      '<li>API 610 driver margin 125% (&lt;22 kW), 115% (22–55 kW), 110% (&gt;55 kW)</li></ul></section>' +
      signBar('Template figures are illustrative and not vendor-published. This report was produced entirely in the browser; no inputs were transmitted to MYENG.');
  }
  // In-app preview shows the exact printable document.
  function previewReport(title, inner, actions) {
    openModal(title, '<iframe class="rep-frame" title="' + esc(title) + ' preview"></iframe>', actions);
    $('#modalBody .rep-frame').srcdoc = standalone(title, inner);
  }

  /* ---------- RFI ---------- */
  var REQUEST = {
    EFF: 'Confirm the guaranteed efficiency at the rated point, or propose an alternative hydraulic selection that meets the project minimum.',
    POR: 'Propose a hydraulic selection with rated flow within 80–110% of BEP flow.',
    BEP: 'Confirm the position of the rated point relative to BEP and the expected vibration and recirculation behaviour.',
    NPSH: 'Provide the NPSH3 curve and propose a selection (larger suction, lower-speed or inducer option) giving at least 1.0 m margin over NPSHa.',
    MAT: 'Re-quote in API 610 material class ' + '{MAT}' + ' or provide a technical justification for the offered class.',
    MAWP: 'Confirm casing MAWP at 38 °C and offer a pressure casing rated to at least {MAWP} bar(g).',
    DRV: 'Upsize the driver to meet the API 610 margin and confirm the revised motor frame and price.',
    LEAD: 'Confirm whether delivery can be reduced to {LEAD} weeks or fewer, and the cost of expediting if any.'
  };
  function rfiText(i) {
    var b = state.bids[i], r = result.bids[i], n = 1;
    var due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    var lines = [];
    lines.push('Subject: Technical clarification request — ' + state.project.tag + ' — ' + bidName(i));
    lines.push('');
    lines.push('Dear ' + (b.vendor || 'Vendor') + ' proposal team,');
    lines.push('');
    lines.push('Thank you for your offer for ' + state.project.tag + ' (' + state.project.service + '), rated duty ' + dutyLabel() + '. During technical bid evaluation against API 610 and the project specification we identified the points below. Please confirm, correct, or provide a revised offer for each item.');
    lines.push('');
    if (!r.deviations.length) {
      lines.push('1. No technical deviations were identified. Please confirm offer validity and provide certified performance curves.');
    } else {
      r.deviations.forEach(function (d) {
        lines.push(n++ + '. [' + d.sev.toUpperCase() + '] ' + d.text);
        lines.push('   Request: ' + REQUEST[d.code].replace('{MAT}', state.basis.material).replace('{MAWP}', state.basis.minMawp).replace('{LEAD}', state.basis.maxLead));
        lines.push('');
      });
    }
    lines.push('In addition, please provide the certified performance curve (head, efficiency, power and NPSH3 versus flow) at rated speed, so the evaluation can be closed against vendor data.');
    lines.push('');
    lines.push('We would appreciate your response by ' + due + '.');
    lines.push('');
    lines.push('Kind regards,');
    lines.push('[Name]');
    lines.push('Rotating Equipment Engineer');
    return lines.join('\n');
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard.'); }, function () { legacyCopy(text); });
    }
    legacyCopy(text);
  }
  function legacyCopy(text) {
    var ta = doc.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    ($('#modal[open]') || doc.body).appendChild(ta); ta.select();
    var ok = false; try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? 'Copied to clipboard.' : 'Copy failed — select the text and copy manually.');
  }
  function rfiParts(i) {
    var lines = rfiText(i).split('\n');
    return { subject: lines[0].replace(/^Subject:\s*/, ''), body: lines.slice(2).join('\n') };
  }
  // Supplier RFI: a composer with To / Vendor / Subject fields and an editable body
  function openRfi(i) {
    if (i == null) {
      i = 0;
      var worst = -1;
      result.bids.forEach(function (r, k) { if (r.deviations.length > worst && k !== result.recommended) { worst = r.deviations.length; i = k; } });
    }
    var opts = state.bids.map(function (b, k) { return '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>Bid ' + 'ABC'[k] + ' · ' + esc(bidName(k)) + ' · ' + result.bids[k].deviations.length + ' flags</option>'; }).join('');
    var p = rfiParts(i);
    openModal('Supplier RFI', '<div class="composer">' +
      '<div class="composer__f"><label for="rfiTo">To</label><input type="email" id="rfiTo" placeholder="proposals@vendor.com" autocomplete="off" spellcheck="false"></div>' +
      '<div class="composer__f"><label for="rfiVendor">Vendor</label><select id="rfiVendor">' + opts + '</select></div>' +
      '<div class="composer__f"><label for="rfiSubject">Subject</label><input type="text" id="rfiSubject" value="' + esc(p.subject) + '" spellcheck="true"></div>' +
      '<textarea class="composer__body" id="rfiText" spellcheck="true" aria-label="Email body">' + esc(p.body) + '</textarea>' +
      '<div class="composer__foot"><span class="composer__hint">Drafted from the detected deviations · edit freely before sending</span>' +
      '<button class="pill pill--line" type="button" id="rfiCopy">Copy email</button>' +
      '<button class="pill pill--ink pill--cta" type="button" id="rfiMail">Open in Mail <span class="pill__badge" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8h8.5M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button></div>' +
      '</div>', []);
    $('#modal').classList.add('modal--composer');
    $('#rfiVendor').addEventListener('change', function () { var q = rfiParts(Number(this.value)); $('#rfiSubject').value = q.subject; $('#rfiText').value = q.body; });
    $('#rfiCopy').addEventListener('click', function () {
      var to = $('#rfiTo').value.trim();
      copyText((to ? 'To: ' + to + '\n' : '') + 'Subject: ' + $('#rfiSubject').value + '\n\n' + $('#rfiText').value);
    });
    $('#rfiMail').addEventListener('click', function () {
      window.location.href = 'mailto:' + encodeURIComponent($('#rfiTo').value.trim()).replace(/%40/g, '@') + '?subject=' + encodeURIComponent($('#rfiSubject').value) + '&body=' + encodeURIComponent($('#rfiText').value);
    });
  }

  function bindDeliverables() {
    $('#btnCsv').addEventListener('click', csv);
    $('#btnXlsx').addEventListener('click', exportXlsx);
    $('#btnRfi').addEventListener('click', function () { openRfi(); });
    $('#btnAward').addEventListener('click', function () {
      previewReport('Award Recommendation Report', awardInner(), [
        { label: 'Print / Save PDF', cls: 'btn--ink', run: function () { printDoc('Award Recommendation ' + state.project.tag, awardInner()); } },
        { label: 'Download HTML', run: function () { download(fileSlug('Award_Recommendation') + '.html', standalone('Award Recommendation', awardInner()), 'text/html'); } }
      ]);
    });
    $('#btnAudit').addEventListener('click', function () {
      previewReport('Audit Report · Technical Evaluation', auditInner(), [
        { label: 'Print / Save PDF', cls: 'btn--ink', run: function () { printDoc('Technical Evaluation Audit ' + state.project.tag, auditInner()); } },
        { label: 'Download HTML', run: function () { download(fileSlug('Audit_Report') + '.html', standalone('Technical Evaluation Audit', auditInner()), 'text/html'); } }
      ]);
    });
  }

  /* ================================================================
     Datasheet parser
     ================================================================ */
  var FIELDS = [
    { k: 'vendor', label: 'Vendor', unit: '', text: true },
    { k: 'model', label: 'Model', unit: '', text: true },
    { k: 'capex', label: 'CapEx', unit: 'USD', lo: 1000, hi: 5e7 },
    { k: 'etaBep', label: 'BEP efficiency', unit: '%', lo: 10, hi: 95 },
    { k: 'qBep', label: 'BEP flow', unit: 'm³/h', lo: 1, hi: 50000 },
    { k: 'npshr', label: 'NPSHr / NPSH3', unit: 'm', lo: 0.1, hi: 60 },
    { k: 'material', label: 'Material class', unit: 'API 610', text: true },
    { k: 'mawp', label: 'Casing MAWP', unit: 'bar(g)', lo: 1, hi: 700 },
    { k: 'motorKw', label: 'Motor rating', unit: 'kW', lo: 0.1, hi: 50000 },
    { k: 'etaMotor', label: 'Motor efficiency', unit: '%', lo: 50, hi: 99.9 },
    { k: 'maint', label: 'Annual maintenance', unit: 'USD/yr', lo: 0, hi: 5e6 },
    { k: 'lead', label: 'Lead time', unit: 'weeks', lo: 1, hi: 200 }
  ];
  var SAMPLE_QUOTE = [
    'NORTHGATE PUMP WORKS — TECHNICAL & COMMERCIAL OFFER',
    '(Fictional vendor — sample text for testing the parser)',
    '',
    'Vendor: Northgate Pump Works',
    'Quotation ref: NPW-Q-26-0447  Rev B  Date: 12 Nov 2026',
    'Item: P-4101 A/B  Process water transfer pump, API 610 12th Ed., OH2',
    'Pump model: NPW OH2-250-400',
    'Rated duty: 420 m3/h @ 68.0 m TDH, SG 1.00, 2980 rpm',
    'Best efficiency point flow: 450 m3/h',
    'Efficiency at BEP: 81.2 %',
    'NPSH3 at rated flow: 4.6 m',
    'Casing design pressure (MAWP): 51 bar g @ 38 °C',
    'Material class: API 610 Annex H, class S-6 (12% Cr impeller, carbon steel casing)',
    'Driver: 132 kW, 4-pole, IE3 TEFC',
    'Motor efficiency: 95.8 %',
    'Total price, ex-works incl. motor & baseplate: USD 171,500',
    'Recommended annual maintenance & spares allowance: USD 6,400 per year',
    'Delivery: 20 weeks ARO',
    'Validity: 60 days'
  ].join('\n');

  function localParse(text) {
    var lines = text.split(/\r?\n/), out = {};
    var find = function (must, not) {
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (must.every(function (m) { return m.test(l); }) && !(not && not.some(function (m) { return m.test(l); }))) return l;
      }
      return null;
    };
    var put = function (k, v, src) { if (v != null && v !== '' && !(typeof v === 'number' && !isFinite(v))) out[k] = { v: v, src: src ? src.trim() : '' }; };
    var numIn = function (s) { return parseFloat(String(s).replace(/,/g, '')); };
    var l, m;

    l = find([/^\s*(vendor|supplier|manufacturer|bidder)\s*[:\-]/i]);
    if (l) put('vendor', l.replace(/^\s*(vendor|supplier|manufacturer|bidder)\s*[:\-]\s*/i, ''), l);
    l = find([/model\s*[:\-]/i]);
    if (l) put('model', l.replace(/^.*?model\s*[:\-]\s*/i, '').replace(/^(northgate pump works|npw)\s+/i, function (x) { return x; }), l);

    l = find([/(price|capex|lump\s*sum|ex-?\s?works|total)/i, /(USD|US\$|\$)\s*[\d,]+/i], [/maint|spares|per\s*year|\/\s*y(ea)?r/i]);
    if (l && (m = l.match(/(?:USD|US\$|\$)\s*([\d,]+(?:\.\d+)?)/i))) put('capex', numIn(m[1]), l);

    l = find([/(efficien|η)/i, /(BEP|best\s+efficiency)/i, /%/], [/motor/i]);
    if (l && (m = l.match(/(\d{2}(?:\.\d+)?)\s*%/))) put('etaBep', numIn(m[1]), l);

    l = find([/(BEP|best\s+efficiency)/i, /m\s*(3|³)\s*\/\s*h/i]);
    if (l && (m = l.match(/([\d,]+(?:\.\d+)?)\s*m\s*(?:3|³)\s*\/\s*h/i))) put('qBep', numIn(m[1]), l);

    l = find([/NPSH\s*(3|r|req)/i]);
    if (l && (m = l.match(/(\d+(?:\.\d+)?)\s*m\b/i))) put('npshr', numIn(m[1]), l);

    l = find([/(material|metallurgy|class)/i, /\b[ISCAD]-\d\b/]);
    if (l && (m = l.match(/\b([ISCAD]-\d)\b/))) put('material', m[1].toUpperCase(), l);

    l = find([/(MAWP|design\s+pressure|pressure\s+rating|max(imum)?\s+allowable)/i]);
    if (l) {
      if ((m = l.match(/(\d+(?:\.\d+)?)\s*bar/i))) put('mawp', numIn(m[1]), l);
      else if ((m = l.match(/(\d+(?:\.\d+)?)\s*psi/i))) put('mawp', Math.round(numIn(m[1]) * 0.0689476 * 10) / 10, l);
    }

    l = find([/(motor|driver)/i, /\d\s*kW/i], [/efficien/i]);
    if (l && (m = l.match(/(\d+(?:\.\d+)?)\s*kW/i))) put('motorKw', numIn(m[1]), l);

    l = find([/(motor|driver)/i, /efficien/i, /%/]);
    if (l && (m = l.match(/(\d{2}(?:\.\d+)?)\s*%/))) put('etaMotor', numIn(m[1]), l);

    l = find([/(maint|spares)/i, /(USD|US\$|\$)\s*[\d,]+/i]);
    if (l && (m = l.match(/(?:USD|US\$|\$)\s*([\d,]+(?:\.\d+)?)/i))) put('maint', numIn(m[1]), l);

    l = find([/(lead\s*time|delivery|shipment)/i, /\d+\s*(weeks?|wks?|months?)/i]);
    if (l && (m = l.match(/(\d+(?:\.\d+)?)\s*(weeks?|wks?|months?)/i))) put('lead', /month/i.test(m[2]) ? Math.round(numIn(m[1]) * 4.33) : numIn(m[1]), l);

    return out;
  }

  var parsed = null;
  var keys = { azure: '', gemini: '' }; // memory only

  var SYS_PROMPT = 'You extract centrifugal pump bid data from vendor quotation text. Return ONLY a JSON object with these keys: ' +
    'vendor (string), model (string), capex_usd (number), eta_bep_pct (number), q_bep_m3h (number), npshr_m (number), material_class (API 610 class string like "S-6"), ' +
    'mawp_barg (number), motor_kw (number), eta_motor_pct (number), maint_usd_per_year (number), lead_weeks (number), notes (string). ' +
    'Use null for any value not explicitly stated. Never estimate or infer. Convert psi to bar(g) (×0.0689476) and months to weeks (×4.33). ' +
    'If the price is not in USD, return null for capex_usd and explain in notes.';
  var MAP = { vendor: 'vendor', model: 'model', capex_usd: 'capex', eta_bep_pct: 'etaBep', q_bep_m3h: 'qBep', npshr_m: 'npshr', material_class: 'material', mawp_barg: 'mawp', motor_kw: 'motorKw', eta_motor_pct: 'etaMotor', maint_usd_per_year: 'maint', lead_weeks: 'lead' };

  function extractJson(s) {
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Model response did not contain JSON.');
    return JSON.parse(s.slice(a, b + 1));
  }
  function fromModel(obj, srcLabel) {
    var out = {};
    Object.keys(MAP).forEach(function (k) {
      var v = obj[k];
      if (v == null || v === '') return;
      var f = MAP[k];
      if (f !== 'vendor' && f !== 'model' && f !== 'material') { v = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')); if (!isFinite(v)) return; }
      if (f === 'material') v = String(v).toUpperCase().replace(/\s/g, '');
      out[f] = { v: v, src: srcLabel };
    });
    if (obj.notes) out._notes = String(obj.notes);
    return out;
  }

  // Azure: AI Foundry model inference, Azure OpenAI deployments, or the Azure OpenAI v1 API.
  var AZ_DEFAULT_VER = { foundry: '2024-05-01-preview', aoai: '2024-10-21', v1: '' };
  function azureUrl(mode, ep, dep, ver) {
    ep = ep.replace(/\?.*$/, '').replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(ep)) {
      // full URL pasted: the v1 route takes no dated api-version
      return { url: /\/openai\/v1\//.test(ep) ? ep : ep + '?api-version=' + encodeURIComponent(ver || AZ_DEFAULT_VER.aoai), model: !/\/openai\/deployments\//.test(ep) };
    }
    ep = ep.replace(/\/api\/projects\/[^/]+$/, '').replace(/\/(models|openai(\/v1)?)$/, '');
    if (mode === 'foundry') return { url: ep + '/models/chat/completions?api-version=' + encodeURIComponent(ver || AZ_DEFAULT_VER.foundry), model: true };
    if (mode === 'v1') return { url: ep + '/openai/v1/chat/completions', model: true };
    return { url: ep + '/openai/deployments/' + encodeURIComponent(dep) + '/chat/completions?api-version=' + encodeURIComponent(ver || AZ_DEFAULT_VER.aoai), model: false };
  }
  function callAzure(text) {
    var mode = $('#azMode').value, ep = $('#azEndpoint').value.trim(), dep = $('#azDeployment').value.trim(), ver = $('#azVersion').value.trim();
    var auth = $('#azAuth').value;
    keys.azure = $('#azKey').value || keys.azure;
    if (!/^https:\/\//i.test(ep)) return Promise.reject(new Error('Enter an https:// endpoint URL.'));
    if (!dep) return Promise.reject(new Error('Enter the deployment or model name.'));
    if (!keys.azure) return Promise.reject(new Error(auth === 'entra' ? 'Paste a Microsoft Entra ID access token.' : 'Enter an API key.'));
    var u = azureUrl(mode, ep, dep, ver);
    var body = { messages: [{ role: 'system', content: SYS_PROMPT }, { role: 'user', content: text }], temperature: 0, response_format: { type: 'json_object' } };
    if (u.model) body.model = dep;
    var headers = { 'Content-Type': 'application/json' };
    if (auth === 'entra') headers.Authorization = 'Bearer ' + keys.azure.replace(/^Bearer\s+/i, '');
    else headers['api-key'] = keys.azure;
    var send = function (b) { return fetch(u.url, { method: 'POST', headers: headers, body: JSON.stringify(b) }); };
    return send(body).then(function (res) {
      if (res.status !== 400) return res;
      // Retry once without optional parameters only when the model rejects them (e.g. reasoning models).
      return res.clone().text().then(function (t) {
        if (/unsupported_(parameter|value)|temperature|response_format/i.test(t)) {
          delete body.temperature; delete body.response_format; return send(body);
        }
        return res;
      });
    }).then(handleHttp).then(function (j) {
      var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!c) throw new Error('Empty response from Azure.');
      return fromModel(extractJson(c), 'Azure · ' + dep);
    });
  }
  function callGemini(text) {
    var model = $('#gmModel').value === 'custom' ? $('#gmCustom').value.trim() : $('#gmModel').value;
    keys.gemini = $('#gmKey').value || keys.gemini;
    if (!model) return Promise.reject(new Error('Enter a Gemini model id.'));
    if (!keys.gemini) return Promise.reject(new Error('Enter an API key.'));
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys.gemini },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: text }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      })
    }).then(handleHttp).then(function (j) {
      var parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
      var c = parts && parts.map(function (p) { return p.text || ''; }).join('');
      if (!c) throw new Error('Empty response from Gemini' + (j.promptFeedback && j.promptFeedback.blockReason ? ' (' + j.promptFeedback.blockReason + ')' : '') + '.');
      return fromModel(extractJson(c), 'Gemini · ' + model);
    });
  }
  function handleHttp(res) {
    return res.text().then(function (t) {
      var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
      if (!res.ok) {
        var msg = j && j.error && (j.error.message || j.error.code) || t.slice(0, 160) || res.statusText;
        throw new Error('HTTP ' + res.status + ' — ' + msg);
      }
      if (!j) throw new Error('Response was not JSON.');
      return j;
    });
  }

  function renderParse(p, cross) {
    var t = $('#parseTable');
    $('#pChips').innerHTML = '<span class="pchips__k mono">' + (p ? 'Extracted' : 'Will extract') + '</span>' + FIELDS.map(function (f) {
      var hit = p && p[f.k] && p[f.k].v != null;
      return '<span class="pchip' + (hit ? ' is-hit' : '') + '">' + f.label + '</span>';
    }).join('');
    $('#parserOut').classList.toggle('is-empty', !p);
    if (!p) { t.innerHTML = ''; return; }
    var h = '<thead><tr><th>Field</th><th>Value</th><th>Unit</th><th>Check</th><th>Source</th></tr></thead><tbody>';
    FIELDS.forEach(function (f) {
      var e = p[f.k], val = e ? e.v : null, chk = '', cls = '';
      if (val == null) { chk = '<span class="miss">Not found — keep current</span>'; }
      else if (!f.text && (val < f.lo || val > f.hi)) { chk = '<span class="miss">Out of range</span>'; cls = 'miss'; }
      else if (f.k === 'material' && E.MATERIAL_CLASSES.indexOf(val) < 0) { chk = '<span class="miss">Unknown class</span>'; }
      else if (cross) {
        var c = cross[f.k];
        if (!c) chk = 'Local: —';
        else if (String(c.v).toLowerCase() === String(val).toLowerCase() || (!f.text && Math.abs(c.v - val) < 1e-6)) chk = 'Local ✓';
        else chk = '<span class="miss">Local ≠ ' + esc(c.v) + '</span>';
      } else chk = 'Matched';
      h += '<tr><td>' + f.label + '</td><td class="v ' + cls + '">' + (val == null ? '—' : esc(f.text ? val : num(val, f.k === 'capex' || f.k === 'maint' ? 0 : (val % 1 ? 1 : 0)))) + '</td><td class="v">' + f.unit + '</td><td class="v">' + chk + '</td><td class="src">' + esc(e ? e.src : '') + '</td></tr>';
    });
    if (p._notes) h += '<tr><td>Model notes</td><td colspan="4" class="src">' + esc(p._notes) + '</td></tr>';
    t.innerHTML = h + '</tbody>';
  }

  function setStatus(msg, err) {
    var s = $('#parseStatus');
    s.textContent = msg; s.classList.toggle('status--err', !!err);
  }

  function showPaste(open) {
    $('#pasteWrap').hidden = !open;
    $('#btnPasteToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('#btnPasteToggle span').textContent = open ? 'Hide raw text' : 'Or paste raw text';
    $('#btnClearQuote').hidden = !$('#quoteText').value;
  }
  function bindParser() {
    renderParse(null);
    var engine = function () { return ($('input[name=engine]:checked') || {}).value || 'local'; };
    function syncEngineInfo() {
      var e = engine();
      $$('.engine-cfg').forEach(function (c) { c.hidden = c.getAttribute('data-engine') !== e; });
      $$('.info li[data-for]').forEach(function (li) { li.hidden = li.getAttribute('data-for').split(' ').indexOf(e) < 0; });
      $('#btnForgetKeys').hidden = e === 'local';
      $('#infoSum').textContent = e === 'local' ? 'What the local parser reads' : 'Privacy & API details';
    }
    syncEngineInfo();
    $$('input[name=engine]').forEach(function (r) {
      r.addEventListener('change', function () {
        syncEngineInfo();
      });
    });
    $('#gmModel').addEventListener('change', function () { $('#gmCustomWrap').hidden = this.value !== 'custom'; });
    var lastAutoVer = $('#azVersion').value;
    $('#azMode').addEventListener('change', function () {
      var v = $('#azVersion');
      if (v.value === lastAutoVer) { v.value = AZ_DEFAULT_VER[this.value]; lastAutoVer = v.value; }  // keep a version the user typed
      $('#azVersionWrap').hidden = this.value === 'v1';
      $('#azEndpoint').placeholder = this.value === 'foundry' ? 'https://your-resource.services.ai.azure.com' : 'https://your-resource.openai.azure.com';
    });
    $('#azAuth').addEventListener('change', function () {
      $('#azKeyLabel').textContent = this.value === 'entra' ? 'Entra ID access token' : 'API key';
      keys.azure = ''; $('#azKey').value = '';
    });
    bindUpload();
    $('#btnSampleQuote').addEventListener('click', function () { $('#quoteText').value = SAMPLE_QUOTE; showPaste(true); setStatus('Sample quotation inserted (fictional vendor). Run the parser.'); });
    $('#btnClearQuote').addEventListener('click', function () { $('#quoteText').value = ''; parsed = null; renderParse(null); $('#btnInsert').disabled = true; showPaste(false); setStatus('Cleared.'); });
    $('#btnPasteToggle').addEventListener('click', function () { var open = $('#pasteWrap').hidden; showPaste(open); if (open) $('#quoteText').focus(); });
    $('#quoteText').addEventListener('input', function () { $('#btnClearQuote').hidden = !this.value; });
    $('#btnForgetKeys').addEventListener('click', function () {
      keys.azure = ''; keys.gemini = ''; $('#azKey').value = ''; $('#gmKey').value = '';
      setStatus('Keys cleared from memory.');
    });
    var slot = $('#slotSelect');
    slot.innerHTML = [0, 1, 2].map(function (i) { return '<option value="' + i + '">Bid ' + 'ABC'[i] + '</option>'; }).join('');

    $('#btnParse').addEventListener('click', function () {
      var text = $('#quoteText').value.trim();
      if (!text) { setStatus('Paste quotation text first, or insert the sample quote.', true); return; }
      var eng = engine(), btn = this;
      var local = localParse(text);
      if (eng === 'local') {
        parsed = local;
        var n = Object.keys(local).length;
        renderParse(local);
        setStatus('Local parser: ' + n + ' of ' + FIELDS.length + ' fields matched. Review before inserting.', n === 0);
        $('#btnInsert').disabled = n === 0;
        return;
      }
      btn.disabled = true;
      setStatus('Sending text to ' + (eng === 'azure' ? 'Azure' : 'Gemini') + ' from your browser…');
      (eng === 'azure' ? callAzure(text) : callGemini(text)).then(function (p) {
        parsed = p;
        renderParse(p, local);
        var n = Object.keys(p).filter(function (k) { return k[0] !== '_'; }).length;
        setStatus((eng === 'azure' ? 'Azure' : 'Gemini') + ': ' + n + ' of ' + FIELDS.length + ' fields returned. Cross-checked against the local parser.');
        $('#btnInsert').disabled = n === 0;
      }).catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = 'Network or CORS error — check the endpoint URL and that the resource allows browser requests.';
        setStatus(msg + ' Showing local parser result instead.', true);
        parsed = local; renderParse(local);
        $('#btnInsert').disabled = Object.keys(local).length === 0;
      }).then(function () { btn.disabled = false; });
    });

    $('#btnInsert').addEventListener('click', function () {
      if (!parsed) return;
      var i = Number(slot.value), b = state.bids[i], n = 0;
      FIELDS.forEach(function (f) {
        var e = parsed[f.k];
        if (!e || e.v == null) return;
        if (!f.text && (e.v < f.lo || e.v > f.hi)) return;
        if (f.k === 'material' && E.MATERIAL_CLASSES.indexOf(e.v) < 0) return;
        b[f.k] = e.v; n++;
      });
      buildMatrix();
      recompute();
      activateTab('tbe');
      $('#app').scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      toast(n + ' fields inserted into slot ' + 'ABC'[i] + ' · ' + bidName(i) + '.');
    });
  }

  /* ================================================================
     Pilot / onboarding request (nothing is sent until the user sends it)
     ================================================================ */
  var PILOT_TO = 'founders@myeng.online';
  function pilotText(f) {
    var tier = f.tier === 'enterprise' ? 'Enterprise / EPC ($349 / month)' : 'Pro Engineer ($79 / month)';
    var lines = [
      'Subject: MYENG pilot request — ' + (f.tier === 'enterprise' ? 'Enterprise / EPC' : 'Pro Engineer') + (f.company ? ' — ' + f.company : ''),
      '',
      'Hello MYENG founders,',
      '',
      'We would like to discuss a pilot of MYENG.',
      '',
      'Plan of interest: ' + tier,
      'Organisation: ' + (f.company || '[company]'),
      'Engineers who would use it: ' + f.team,
      'Pumps evaluated per year: ' + f.volume,
      'Extraction preference: ' + f.cloud,
      'Typical standards: ' + f.std,
      ''
    ];
    if (f.notes) { lines.push('Notes:', f.notes, ''); }
    lines.push('Regards,', f.name || '[name]');
    return lines.join('\n');
  }
  function openPilot(tier) {
    var opt = function (arr, sel) { return arr.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + v + '</option>'; }).join(''); };
    var body =
      '<div class="pilot">' +
      '<p class="pilot__intro">Tell us about your team. This builds an email you send yourself — nothing leaves this page until you do.</p>' +
      '<div class="pilot__seg" role="radiogroup" aria-label="Plan">' +
      '<label><input type="radio" name="ptier" value="pro"' + (tier !== 'enterprise' ? ' checked' : '') + '><span><b>Pro Engineer</b><em>$79 / month</em></span></label>' +
      '<label><input type="radio" name="ptier" value="enterprise"' + (tier === 'enterprise' ? ' checked' : '') + '><span><b>Enterprise / EPC</b><em>$349 / month</em></span></label></div>' +
      '<div class="pilot__grid">' +
      '<label><span>Organisation</span><input type="text" id="pCompany" autocomplete="organization" placeholder="Company name"></label>' +
      '<label><span>Your name</span><input type="text" id="pName" autocomplete="name" placeholder="Name"></label>' +
      '<label><span>Engineers</span><select id="pTeam">' + opt(['1', '2–5', '6–20', '20+'], '2–5') + '</select></label>' +
      '<label><span>Pumps evaluated / year</span><select id="pVolume">' + opt(['Fewer than 10', '10–50', '50–200', '200+'], '10–50') + '</select></label>' +
      '<label class="pilot__wide"><span>Extraction preference</span><select id="pCloud">' +
      opt(['Microsoft Azure AI Foundry — managed by MYENG', 'Microsoft Azure AI Foundry — private, in our tenant', 'Bring our own key (Azure OpenAI or Gemini)', 'Local parser only — no cloud'], tier === 'enterprise' ? 'Microsoft Azure AI Foundry — private, in our tenant' : 'Microsoft Azure AI Foundry — managed by MYENG') + '</select></label>' +
      '<label class="pilot__wide"><span>Standards</span><select id="pStd">' + opt(['API 610', 'ISO 5199', 'API 610 and ISO 5199', 'Company / site specification'], 'API 610 and ISO 5199') + '</select></label>' +
      '<label class="pilot__wide"><span>Notes (optional)</span><textarea id="pNotes" rows="3" placeholder="Projects, timelines, approval workflow…"></textarea></label>' +
      '</div>' +
      '<p class="pilot__h mono">Email preview · to ' + PILOT_TO + '</p>' +
      '<textarea id="pPreview" class="pilot__preview" readonly aria-label="Email preview"></textarea></div>';
    openModal('Request Pilot / Onboarding', body, [
      { label: 'Copy inquiry', run: function () { copyText($('#pPreview').value); } },
      { label: 'Open in email', cls: 'btn--ink', run: function () {
        var t = $('#pPreview').value, sub = t.split('\n')[0].replace(/^Subject:\s*/, ''), bd = t.split('\n').slice(2).join('\n');
        window.location.href = 'mailto:' + PILOT_TO + '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(bd);
      } }
    ]);
    var read = function () {
      return {
        tier: ($('input[name=ptier]:checked') || {}).value, company: $('#pCompany').value.trim(), name: $('#pName').value.trim(),
        team: $('#pTeam').value, volume: $('#pVolume').value, cloud: $('#pCloud').value, std: $('#pStd').value, notes: $('#pNotes').value.trim()
      };
    };
    var upd = function () { var ta = $('#pPreview'); ta.value = pilotText(read()); ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
    $('#modalBody').addEventListener('input', upd);
    $('#modalBody').addEventListener('change', upd);
    upd();
  }

  /* ================================================================
     Parser file input & drag-and-drop (.txt / .csv, read locally)
     ================================================================ */
  function csvToText(txt) {
    return txt.split(/\r?\n/).map(function (row) {
      var cells = [], cur = '', q = false;
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch === '"') { if (q && row[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if ((ch === ',' || ch === ';' || ch === '\t') && !q) { cells.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      cells.push(cur.trim());
      cells = cells.filter(function (c) { return c !== ''; });
      return cells.length > 1 ? cells[0] + ': ' + cells.slice(1).join(' ') : (cells[0] || '');
    }).join('\n');
  }
  function loadQuoteFile(file) {
    if (!file) return;
    var name = file.name || 'file', ext = (name.split('.').pop() || '').toLowerCase();
    if (['txt', 'csv'].indexOf(ext) < 0) { setStatus('Only .txt and .csv files are supported (got .' + esc(ext) + '). Export PDFs to text first.', true); return; }
    if (file.size > 1024 * 1024) { setStatus('File is larger than 1 MB. Paste the relevant section instead.', true); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var t = String(fr.result || '');
      $('#quoteText').value = ext === 'csv' ? csvToText(t) : t;
      showPaste(true);
      setStatus('Loaded ' + name + ' (' + num(file.size / 1024, 1) + ' KB) locally. Run the parser.');
    };
    fr.onerror = function () { setStatus('Could not read ' + name + '.', true); };
    fr.readAsText(file);
  }
  function bindUpload() {
    var dz = $('#dropZone'), fi = $('#fileQuote');
    $('#btnUpload').addEventListener('click', function () { fi.click(); });
    fi.addEventListener('change', function () { loadQuoteFile(fi.files[0]); fi.value = ''; });
    var depth = 0;
    dz.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; dz.classList.add('is-over'); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    dz.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) dz.classList.remove('is-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; dz.classList.remove('is-over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadQuoteFile(f);
    });
  }

  /* ================================================================
     Legal
     ================================================================ */
  var LEGAL = {
    privacy: ['Privacy Policy', '<p class="rep__meta mono">Effective 1 December 2026 · MYENG is operated by its founders from Amman, Jordan and Jubail, Saudi Arabia</p>' +
      '<h3>Summary</h3><p>The MYENG website and Sandbox Studio run in your browser. There is no MYENG server that receives your engineering inputs, vendor quotations, prices or API keys.</p>' +
      '<h3>What stays on your device</h3><ul><li>Calculations, reports and exports are produced in the page and saved only where you choose.</li>' +
      '<li>Bid packages you create are saved in your browser\'s localStorage on this device so you can return to them. They are never uploaded. Use “Clear local data” in the Studio package menu, or clear site data in your browser, to remove them.</li>' +
      '<li>We do not use cookies, analytics, advertising pixels or session recording.</li></ul>' +
      '<h3>Bring-your-own-key extraction</h3><ul><li>API keys and access tokens you enter for Microsoft Azure or Google Gemini are held in JavaScript memory for the current tab only. They are never written to storage and never sent to MYENG.</li>' +
      '<li>If you choose a cloud provider, the quotation text you submit is sent directly from your browser to that provider\'s endpoint under your own account. That provider\'s terms and retention policies apply — for example Azure abuse-monitoring logs, or use of content to improve products on some unpaid Gemini tiers.</li>' +
      '<li>The local parser sends nothing over the network. Files you drop into the parser are read locally.</li></ul>' +
      '<h3>Third-party resources</h3><p>The site is served by GitHub Pages and loads typefaces from Google Fonts. These services receive standard request data such as IP address and user agent under their own policies.</p>' +
      '<h3>Correspondence</h3><p>If you email founders@myeng.online — including a pilot request you compose on this site — we keep the correspondence to reply and do not share it. You may ask us to delete it at any time; we respond within 30 days. We aim to follow the Jordanian Personal Data Protection Law and the Saudi Personal Data Protection Law where they apply.</p>' +
      '<h3>Paid plans</h3><p>Pro and Enterprise features that store data (synced workspaces, managed extraction) are provided under a separate written agreement that sets out processing, retention and deletion terms.</p>' +
      '<h3>Contact &amp; security</h3><p>founders@myeng.online — including reports of security vulnerabilities.</p>'],
    terms: ['Terms of Service', '<p class="rep__meta mono">Effective 1 December 2026 · MYENG, Amman, Jordan and Jubail, Saudi Arabia</p>' +
      '<h3>1. The service</h3><p>MYENG provides engineering calculation and bid-evaluation tools for rotating equipment. The Sandbox is free and is provided without warranty of any kind, including fitness for a particular purpose.</p>' +
      '<h3>2. Engineering responsibility</h3><p>Results are calculated from your inputs using the formulas documented in the Studio and in every audit report. MYENG checks a simplified subset of API 610 criteria and does not verify vendor data, test results or mechanical design. Outputs support, and do not replace, the judgement of a qualified engineer, vendor-certified performance data, witnessed testing and your company\'s specifications.</p>' +
      '<h3>3. Sample data</h3><p>The bid-package templates use anonymised bidders and illustrative figures. They are not vendor-published data and refer to no real manufacturer.</p>' +
      '<h3>4. Your data and keys</h3><p>Browser sessions are not retained by MYENG. When you use your own Azure or Gemini credentials you are responsible for complying with that provider\'s terms and for the content you submit.</p>' +
      '<h3>5. Acceptable use</h3><p>Do not attempt to disrupt the site, misrepresent outputs as vendor-certified, or use the service in breach of law or confidentiality obligations.</p>' +
      '<h3>6. Liability</h3><p>To the extent permitted by law, MYENG is not liable for indirect or consequential loss arising from use of the free Sandbox. Paid plans are governed by their written order form.</p>' +
      '<h3>7. Trademarks</h3><p>API 610 is a standard of the American Petroleum Institute; ISO 5199 of the International Organization for Standardization. Azure is a trademark of Microsoft and Gemini of Google. MYENG is not affiliated with or endorsed by them.</p>' +
      '<h3>8. Governing law</h3><p>These terms are governed by the laws of the Hashemite Kingdom of Jordan, unless a written order form states otherwise.</p>' +
      '<h3>Contact</h3><p>founders@myeng.online</p>']
  };

  /* ================================================================
     Reveal & observers
     ================================================================ */
  function observe() {
    var els = $$('.reveal, .wordmark');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in'); io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    }
    var nav = $('.nav');
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* Magnetic primary pills: drift up to ~6px toward the pointer, damped. */
  function initMagnetic() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('.magnetic').forEach(function (el) {
      var cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, raf = 0;
      function loop() {
        cur.x += (tgt.x - cur.x) * 0.18; cur.y += (tgt.y - cur.y) * 0.18;
        el.style.setProperty('--tx', cur.x.toFixed(2) + 'px'); el.style.setProperty('--ty', cur.y.toFixed(2) + 'px');
        raf = Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.05 ? requestAnimationFrame(loop) : 0;
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tgt.x = ((e.clientX - r.left) / r.width - 0.5) * 12; tgt.y = ((e.clientY - r.top) / r.height - 0.5) * 8;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () { tgt.x = 0; tgt.y = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  }

  /* ================================================================
     Rolling tabular counters
     ================================================================ */
  var NUM_RE = /(\d[\d,]*(?:\.\d+)?)/;
  var tweens = new Map();   // el -> {raf, timer, next}
  var rollOff = false;      // true while a whole package is being swapped in
  function finishTween(el) {
    var tw = tweens.get(el); if (!tw) return;
    cancelAnimationFrame(tw.raf); clearTimeout(tw.timer);
    el.textContent = tw.next; tweens.delete(el);
  }
  // Snap every running counter to its final value (used before package switches).
  function settleRolls() { Array.from(tweens.keys()).forEach(finishTween); }
  function splitNum(t) { return String(t).split(NUM_RE); }
  function rollText(el, next) {
    if (!el) return;
    var prev = el.getAttribute('data-final');
    if (prev == null) prev = el.textContent;
    el.setAttribute('data-final', next);
    if (tweens.has(el)) finishTween(el);
    if (prev === next) { el.textContent = next; return; }
    var a = splitNum(prev), b = splitNum(next);
    var same = !reduceMotion && !rollOff && !doc.hidden && a.length === b.length && a.length > 1 &&
      a.every(function (x, i) { return i % 2 === 1 || x === b[i]; });
    if (!same) { el.textContent = next; return; }
    var t0 = performance.now(), dur = 520;
    var from = a.map(function (x, i) { return i % 2 ? parseFloat(x.replace(/,/g, '')) : x; });
    var meta = b.map(function (x, i) {
      if (!(i % 2)) return null;
      var d = x.indexOf('.') >= 0 ? x.length - x.indexOf('.') - 1 : 0;
      return { to: parseFloat(x.replace(/,/g, '')), d: d, comma: x.indexOf(',') >= 0 || parseFloat(x.replace(/,/g, '')) >= 1000 && /,/.test(prev) };
    });
    var tw = { next: next, raf: 0, timer: 0 };
    tweens.set(el, tw);
    // Guarantee the final value even if animation frames stop (background tab, throttling).
    tw.timer = setTimeout(function () { finishTween(el); }, dur + 120);
    (function step(now) {
      if (tweens.get(el) !== tw) return;
      var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = b.map(function (x, i) {
        if (!(i % 2)) return x;
        var m = meta[i], v = from[i] + (m.to - from[i]) * e;
        return m.comma ? v.toLocaleString('en-US', { minimumFractionDigits: m.d, maximumFractionDigits: m.d }) : v.toFixed(m.d);
      }).join('');
      if (t < 1) tw.raf = requestAnimationFrame(step); else finishTween(el);
    })(t0);
  }
  // Re-render a container but roll [data-roll] numbers from their previous values.
  function rollRender(host, html) {
    var prev = {};
    $$('[data-roll]', host).forEach(function (el) { prev[el.getAttribute('data-roll')] = el.getAttribute('data-final') || el.textContent; finishTween(el); });
    host.innerHTML = html;
    $$('[data-roll]', host).forEach(function (el) {
      var k = el.getAttribute('data-roll'), next = el.textContent;
      if (prev[k] != null && !rollOff) { el.textContent = prev[k]; el.setAttribute('data-final', prev[k]); rollText(el, next); }
      else el.setAttribute('data-final', next);
    });
  }

  /* ================================================================
     Tactile tilt + specular sheen
     ================================================================ */
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('.tilt').forEach(function (el) {
      var cur = { rx: 0, ry: 0, sh: 0 }, tgt = { rx: 0, ry: 0, sh: 0 }, raf = 0, MAX = el.id === 'heroFrame' ? 4.5 : 2.5;
      function loop() {
        var k = 0.1, d = 0;
        ['rx', 'ry', 'sh'].forEach(function (p) { cur[p] += (tgt[p] - cur[p]) * k; d = Math.max(d, Math.abs(tgt[p] - cur[p])); });
        el.style.setProperty('--rx', cur.rx.toFixed(3) + 'deg');
        el.style.setProperty('--ry', cur.ry.toFixed(3) + 'deg');
        el.style.setProperty('--sheen', cur.sh.toFixed(3));
        // parallax: the impeller drifts against the tilt, floating cards drift with it
        el.style.setProperty('--px', (cur.ry / MAX).toFixed(4));
        el.style.setProperty('--py', (-cur.rx / MAX).toFixed(4));
        raf = d > 0.001 ? requestAnimationFrame(loop) : 0;
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        tgt.ry = (x - 0.5) * 2 * MAX; tgt.rx = -(y - 0.5) * 2 * MAX; tgt.sh = 1;
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () { tgt.rx = 0; tgt.ry = 0; tgt.sh = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  }

  /* ================================================================
     CFD-style streamline field (canvas)
     Steady analytic flow: uniform stream + two counter-rotating cells,
     a soft vortex at the pointer, speed scaled by the live flow rate.
     ================================================================ */
  function initFlowField() {
    var cv = $('#flowfield'), host = $('#heroFrame');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, parts = [], TRAIL = 30;
    var mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, on: 0 }, running = false, visible = true, raf = 0, t = 0;
    function resize() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(320, Math.max(90, W * H / 2600)));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(spawn(true, i));
    }
    function spawn(anywhere, i) {
      var p = { x: anywhere ? Math.random() * W : -10 - Math.random() * 60, y: Math.random() * H, h: [], life: 0, max: 220 + Math.random() * 260,
        verm: (i != null ? i : Math.floor(Math.random() * 1000)) % 19 === 0, a: 0.12 + Math.random() * 0.18 };
      return p;
    }
    function field(x, y) {
      var u = 1, v = 0, sx = W || 1, sy = H || 1;
      var k1 = Math.PI * 2 / sx, k2 = Math.PI / sy;
      // stream function ψ = A sin(k1 x + t) sin(k2 y): divergence-free cells
      var A = 0.55;
      u += A * Math.sin(k1 * x * 1.3 + t * 0.15) * Math.cos(k2 * y * 2) * 1.2;
      v += -A * Math.cos(k1 * x * 1.3 + t * 0.15) * Math.sin(k2 * y * 2) * 0.9;
      v += 0.18 * Math.sin(x * 0.006 + y * 0.004 + t * 0.2);
      if (mouse.on > 0.01) {
        var dx = x - mouse.x, dy = y - mouse.y, r2 = dx * dx + dy * dy, R = 120;
        var f = Math.exp(-r2 / (2 * R * R)) * 2.2 * mouse.on;
        u += -dy / R * f + dx / R * f * 0.35; v += dx / R * f + dy / R * f * 0.35;
      }
      return [u, v];
    }
    function step(dt) {
      heroSurge = Math.max(0, heroSurge - 0.018 * dt);
      var speed = (0.7 + 1.0 * heroFlow) * (1 + 1.6 * heroSurge * heroSurge);
      mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], f = field(p.x, p.y);
        p.x += f[0] * speed * dt; p.y += f[1] * speed * dt;
        p.h.push(p.x, p.y);
        if (p.h.length > TRAIL * 2) p.h.splice(0, 2);
        p.life++;
        if (p.x > W + 20 || p.y < -30 || p.y > H + 30 || p.x < -80 || p.life > p.max) parts[i] = spawn(false);
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 0.7; ctx.lineCap = 'round';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], h = p.h;
        if (h.length < 4) continue;
        var fade = Math.min(1, p.life / 40, (p.max - p.life) / 40);
        ctx.strokeStyle = p.verm ? 'rgba(224,70,25,' + (0.55 * fade).toFixed(3) + ')' : 'rgba(226,225,220,' + (p.a * fade).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(h[0], h[1]);
        for (var j = 2; j < h.length; j += 2) ctx.lineTo(h[j], h[j + 1]);
        ctx.stroke();
      }
    }
    var last = 0;
    function frame(now) {
      var dt = last ? Math.min(2.5, (now - last) / 16.67) : 1; last = now;
      t += 0.016 * dt;
      step(dt); draw();
      raf = running ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (running || reduceMotion) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    resize();
    if (reduceMotion) { for (var k = 0; k < 120; k++) step(1); draw(); return; }
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
      if (mouse.on === 0) { mouse.x = mouse.tx; mouse.y = mouse.ty; } mouse.on = 1;
    });
    host.addEventListener('pointerleave', function () { mouse.on = 0; });
    var ro = window.ResizeObserver ? new ResizeObserver(function () { resize(); }) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !doc.hidden) start(); else stop(); }).observe(host);
    } else start();
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else if (visible) start(); });
  }



  /* ================================================================
     Init
     ================================================================ */
  function init() {
    $('#reqMaterial').innerHTML = E.MATERIAL_CLASSES.map(function (m) { return '<option>' + m + '</option>'; }).join('');
    $('#hydVendor').innerHTML = '<option value="rec">Recommended</option>' + [0, 1, 2].map(function (i) { return '<option value="' + i + '">Bid ' + 'ABC'[i] + '</option>'; }).join('');
    $('#year').textContent = new Date().getFullYear();
    initWorkspace();
    initCharts();
    initTwins();
    buildSliders();
    buildMatrix();
    doc.addEventListener('input', onBoundInput);
    doc.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT' && e.target.matches('[data-path]')) onBoundInput(e); });
    bindNav();
    bindDeliverables();
    bindParser();
    bindProjects();
    initStudioTheme();
    enhanceSelects($('#app'));
    $$('.viewseg [data-view]').forEach(function (b) { b.addEventListener('click', function () { setMatrixView(b.getAttribute('data-view')); }); });
    recompute();
    syncInputs();

    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('#modal').addEventListener('close', function () { doc.documentElement.classList.toggle('modal-open', false); if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    $$('[data-legal]').forEach(function (b) {
      b.addEventListener('click', function () { var l = LEGAL[b.getAttribute('data-legal')]; openModal(l[0], '<div class="rep">' + l[1] + '</div>'); });
    });

    observe();
    initTilt();
    initMagnetic();
    initHeroStage();
    initSpotlight();
    initFlowField();
    initRail();
    initReticle();
    $$('[data-pilot]').forEach(function (b) { b.addEventListener('click', function () { openPilot(b.getAttribute('data-pilot')); }); });
    route();
    var intro = $('#intro'), html = doc.documentElement;
    function ready() { html.classList.add('is-ready'); doc.body.classList.add('is-ready'); }
    function endIntro() { if (intro && intro.parentNode) intro.parentNode.removeChild(intro); html.classList.remove('intro-on'); }
    if (html.classList.contains('intro-on') && !appOpen) {
      // the hero starts its own reveal as the curtain lifts
      setTimeout(ready, 760);
      intro.addEventListener('animationend', function (e) { if (e.animationName === 'introLift') endIntro(); });
      setTimeout(endIntro, 1700);
    } else { endIntro(); requestAnimationFrame(ready); }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
