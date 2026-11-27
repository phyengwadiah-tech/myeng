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
    project: { tag: 'P-4101 A/B', service: 'Process water transfer, API 610 OH2' },
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
  var ROI_DEFAULT = { perYear: 12, kw: 90, delta: 3, baseEff: 72, hours: 8000, tariff: 0.11, ef: 0.55, years: 10 };

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var state = clone(SAMPLE);
  var roi = clone(ROI_DEFAULT);
  var result = null, study = null, heroStudy = null;

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
    heroStudy = hydBidIndex() === result.recommended ? study : E.hydraulicStudy(state, result.recommended);
    renderCase();
    updateMatrix();
    renderKpis();
    renderBars();
    renderHyd();
    renderHero();
    syncSliderLabels();
  }

  /* ================================================================
     Sliders
     ================================================================ */
  var sliders = [];
  function makeSlider(host, cfg) {
    var id = 'sl-' + cfg.key.replace(/\W/g, '-');
    var wrap = doc.createElement('div');
    wrap.className = 'slider';
    wrap.innerHTML =
      '<div class="slider__top"><label class="slider__lab" for="' + id + '">' + cfg.label + '</label>' +
      '<span class="slider__val"><span data-v></span><small>' + cfg.unit + '</small></span></div>' +
      '<div class="slider__rail"><div class="slider__channel"><span class="slider__fill"></span></div>' +
      '<input type="range" id="' + id + '" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.step + '">' +
      '<span class="slider__tip" aria-hidden="true"></span></div>' +
      '<div class="slider__scale"><span>' + cfg.fmt(cfg.min) + '</span><span>' + cfg.fmt(cfg.max) + '</span></div>';
    host.appendChild(wrap);
    var input = $('input', wrap), out = $('[data-v]', wrap), rail = $('.slider__rail', wrap), tip = $('.slider__tip', wrap);
    var s = { cfg: cfg, input: input, out: out, last: null };
    s.sync = function () {
      var v = cfg.get();
      if (doc.activeElement !== input || String(v) !== input.value) input.value = v;
      var txt = cfg.fmt(v);
      if (txt !== s.last) { out.textContent = txt; tip.textContent = txt + ' ' + cfg.unit.replace(/<[^>]+>/g, ''); s.last = txt; }
      var f = (v - cfg.min) / (cfg.max - cfg.min);
      rail.style.setProperty('--p', (f * 100).toFixed(2) + '%');
      rail.style.setProperty('--pf', f.toFixed(4));
    };
    input.addEventListener('input', function () {
      cfg.set(parseFloat(input.value));
      s.sync();
      cfg.after();
    });
    input.addEventListener('pointerdown', function () { rail.classList.add('is-drag'); });
    window.addEventListener('pointerup', function () { rail.classList.remove('is-drag'); });
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
      key: 'hyd.speed', label: 'VFD speed trim  N / N<sub>rated</sub>', unit: '% rpm', min: 60, max: 100, step: 1,
      fmt: function (v) { return num(v); },
      get: function () { return state.hyd.speed; }, set: function (v) { state.hyd.speed = v; }, after: schedule
    });
    var rh = $('#roiSliders');
    rh.classList.add('light-range');
    [
      { key: 'perYear', label: 'Pumps procured / year', unit: 'pumps', min: 1, max: 60, step: 1, fmt: function (v) { return num(v); } },
      { key: 'kw', label: 'Average absorbed power', unit: 'kW', min: 5, max: 500, step: 5, fmt: function (v) { return num(v); } },
      { key: 'delta', label: 'Efficiency delta', unit: '% pts', min: 0.5, max: 10, step: 0.5, fmt: function (v) { return v.toFixed(1); } }
    ].forEach(function (c) {
      c.get = function () { return roi[c.key]; };
      c.set = function (v) { roi[c.key] = v; };
      c.after = renderRoi;
      makeSlider(rh, c);
    });
  }

  /* ================================================================
     Generic bound inputs  [data-path]
     ================================================================ */
  function syncInputs() {
    $$('[data-path]').forEach(function (el) {
      var v = getPath(state, el.getAttribute('data-path'));
      if (doc.activeElement !== el) el.value = v;
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
      var v = parseFloat(el.value);
      var bad = !isFinite(v) || (el.min !== '' && v < parseFloat(el.min)) || (el.max !== '' && v > parseFloat(el.max));
      el.classList.toggle('is-invalid', bad);
      if (bad) return;
      setPath(state, path, v);
      // keep duplicated fields (e.g. density appears twice) in sync
      $$('[data-path="' + path + '"]').forEach(function (o) { if (o !== el) o.value = v; });
    }
    schedule();
  }

  /* ================================================================
     TBE matrix
     ================================================================ */
  var INPUT_ROWS = [
    { g: 'Commercial' },
    { k: 'capex', label: 'CapEx (pump + motor + baseplate)', unit: 'USD', step: 500, min: 0 },
    { k: 'maint', label: 'Annual maintenance', unit: 'USD/yr', step: 100, min: 0 },
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
    { k: 'npshMargin', label: 'NPSH margin (NPSHa − NPSHr)', unit: 'm', f: function (r) { return (r.npshMargin >= 0 ? '+' : '') + num(r.npshMargin, 2); } },
    { g: 'Lifecycle cost' },
    { k: 'energyYr', label: 'Annual energy cost', unit: 'USD/yr', f: function (r) { return money(r.energyYr); } },
    { k: 'energyH', label: 'Energy over horizon', unit: 'USD', f: function (r) { return money(r.energyH); } },
    { k: 'maintH', label: 'Maintenance over horizon', unit: 'USD', f: function (r) { return money(r.maintH); } },
    { k: 'tco', label: 'Total cost of ownership', unit: 'USD', strong: true, f: function (r) { return money(r.tco); } },
    { k: 'savingsVsCheapest', label: 'Net vs lowest-CapEx bid', unit: 'USD', f: function (r) { return money(r.savingsVsCheapest, true); } },
    { k: 'co2', label: 'Annual CO₂', unit: 't/yr', f: function (r) { return num(r.co2, 1); } }
  ];

  function buildMatrix() {
    var t = $('#matrix');
    var h = '<thead><tr><th scope="col">Bid / parameter</th>';
    state.bids.forEach(function (b, i) {
      h += '<th scope="col" data-col="' + i + '"><div class="vhead">' +
        '<span class="slot">BID ' + 'ABC'[i] + '</span>' +
        '<input type="text" data-type="text" data-path="bids.' + i + '.vendor" aria-label="Bid ' + 'ABC'[i] + ' vendor">' +
        '<input type="text" class="model" data-type="text" data-path="bids.' + i + '.model" aria-label="Bid ' + 'ABC'[i] + ' model">' +
        '<span class="pill" data-pill="' + i + '"></span></div></th>';
    });
    h += '</tr></thead><tbody>';
    INPUT_ROWS.forEach(function (r) {
      if (r.g) { h += '<tr class="grp"><td colspan="4">' + r.g + '</td></tr>'; return; }
      h += '<tr><td>' + r.label + (r.unit ? '<span class="unit">' + r.unit + '</span>' : '') + '</td>';
      state.bids.forEach(function (b, i) {
        var path = 'bids.' + i + '.' + r.k, aria = ' aria-label="' + esc(r.label) + ' — bid ' + 'ABC'[i] + '"';
        if (r.select) {
          h += '<td data-col="' + i + '"><select data-type="text" data-path="' + path + '"' + aria + '>' +
            E.MATERIAL_CLASSES.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></td>';
        } else {
          h += '<td data-col="' + i + '"><input type="number" inputmode="decimal" step="' + r.step + '" min="' + r.min + '"' +
            (r.max != null ? ' max="' + r.max + '"' : '') + ' data-path="' + path + '"' + aria + '></td>';
        }
      });
      h += '</tr>';
    });
    OUT_ROWS.forEach(function (r) {
      if (r.g) { h += '<tr class="grp"><td colspan="4">' + r.g + ' · <span data-horizon-label></span></td></tr>'; return; }
      h += '<tr><td>' + r.label + '<span class="unit">' + r.unit + '</span></td>';
      state.bids.forEach(function (b, i) {
        h += '<td class="out' + (r.strong ? ' out--strong' : '') + '" data-col="' + i + '" data-out="' + r.k + '"></td>';
      });
      h += '</tr>';
    });
    h += '<tr class="grp"><td colspan="4">API 610 &amp; specification deviations</td></tr><tr><td>Detected flags</td>';
    state.bids.forEach(function (b, i) { h += '<td data-col="' + i + '"><ul class="devlist" data-dev="' + i + '"></ul></td>'; });
    h += '</tr></tbody>';
    t.innerHTML = h;
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
      if (i === rec && result.anyCompliant) { pill.className = 'pill pill--rec'; pill.textContent = 'Recommended'; }
      else if (i === rec) { pill.className = 'pill pill--bad'; pill.textContent = 'Lowest TCO · deviations'; }
      else if (r.compliant) { pill.className = 'pill pill--ok'; pill.textContent = 'Compliant'; }
      else { pill.className = 'pill pill--bad'; pill.textContent = 'Non-compliant'; }
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
      kpi(result.anyCompliant ? 'Recommended award' : 'Lowest TCO · not compliant', esc(bidName(rec)), result.anyCompliant ? 'Lowest TCO among compliant bids' : 'No bid is fully compliant — see deviations', false, true) +
      kpi(n + '-yr TCO', money(r.tco), 'CapEx ' + moneyShort(state.bids[rec].capex) + ' · energy ' + moneyShort(r.energyH), true) +
      kpi('Net vs lowest CapEx', rec === ch ? '$0' : money(r.savingsVsCheapest, true), rec === ch ? 'Lowest-CapEx bid is also lowest TCO' : 'vs ' + esc(bidName(ch)) + ' over ' + n + ' yrs') +
      kpi('CO₂ vs lowest CapEx', (Math.abs(co2d) < 0.05 ? '' : co2d > 0 ? MINUS : '+') + num(Math.abs(co2d), 1) + ' t/yr', 'at ' + state.basis.ef.toFixed(2) + ' kg CO₂/kWh');
    rollRender($('#tbeKpis'), html);
    $('#tbeNpsha').textContent = num(result.npsha.npsha, 2) + ' m';
    $('#tabHorizon').textContent = n;
  }
  function kpi(k, v, s, verm, sans) {
    var key = String(k).replace(/<[^>]+>/g, '');
    var vv = sans ? v : (v.indexOf(' <small>') > 0 ? '<span data-roll="' + key + '">' + v.replace(' <small>', '</span> <small>') : '<span data-roll="' + key + '">' + v + '</span>');
    return '<div class="kpi"><span class="kpi__k">' + k + '</span><span class="kpi__v' + (verm ? ' kpi__v--verm' : '') + '"' +
      (sans ? ' style="font-family:var(--sans);font-size:19px;letter-spacing:-0.02em"' : '') + '>' + vv + '</span>' +
      (s ? '<span class="kpi__s">' + s + '</span>' : '') + '</div>';
  }

  function renderBars() {
    var max = Math.max.apply(null, result.bids.map(function (r) { return r.tco; }));
    var h = '<div class="tco-bars__head"><span>' + state.duty.horizon + '-yr lifecycle cost composition</span><span class="tco-bars__legend">' +
      '<i class="seg-capex"></i>CapEx<i class="seg-energy"></i>Energy<i class="seg-maint"></i>Maintenance</span></div>';
    result.bids.forEach(function (r, i) {
      var b = state.bids[i], w = function (v) { return (v / max * 100).toFixed(2) + '%'; };
      h += '<div class="bar' + (i === result.recommended ? ' bar--rec' : '') + '"><span class="bar__name">' + esc(bidName(i)) + '</span>' +
        '<span class="bar__track"><span class="seg-capex" style="width:' + w(b.capex) + '"></span><span class="seg-energy" style="width:' + w(r.energyH) + '"></span><span class="seg-maint" style="width:' + w(r.maintH) + '"></span></span>' +
        '<span class="bar__val">' + money(r.tco) + '</span></div>';
    });
    $('#tcoBars').innerHTML = h;
  }

  function renderCase() {
    $('#caseTitle').textContent = 'API 610 Process Pump Package — ' + dutyLabel();
    $('#heroCase').textContent = 'Sample case study · ' + state.project.tag + ' · ' + dutyLabel();
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
    var out = [];
    var x0 = p.l, x1 = g.W - p.r, y0 = g.H - p.b, y1 = p.t;
    out.push('<defs><clipPath id="' + id + '-clip"><rect x="' + x0 + '" y="' + y1 + '" width="' + (x1 - x0) + '" height="' + (y0 - y1) + '"/></clipPath></defs>');
    // grid
    var qs = niceStep(c.qMax / (o.mini ? 4 : 6)), hs = niceStep(c.hMax / (o.mini ? 4 : 5));
    for (var q = 0; q <= c.qMax + 1e-6; q += qs) {
      var X = g.x(q).toFixed(1);
      out.push('<line x1="' + X + '" x2="' + X + '" y1="' + y1 + '" y2="' + y0 + '" stroke="#282B31" stroke-width="1"/>');
      out.push('<text x="' + X + '" y="' + (y0 + 16) + '" fill="#8E9196" font-size="' + (o.mini ? 10 : 10.5) + '" text-anchor="middle">' + num(q) + '</text>');
    }
    for (var hh = 0; hh <= c.hMax + 1e-6; hh += hs) {
      var Y = g.y(hh).toFixed(1);
      out.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + Y + '" y2="' + Y + '" stroke="#282B31" stroke-width="1"/>');
      out.push('<text x="' + (x0 - 8) + '" y="' + (+Y + 3.5) + '" fill="#8E9196" font-size="' + (o.mini ? 10 : 10.5) + '" text-anchor="end">' + num(hh) + '</text>');
    }
    if (o.eff) {
      [0, 20, 40, 60, 80, 100].forEach(function (e) {
        out.push('<text x="' + (x1 + 8) + '" y="' + (g.ye(e) + 3.5) + '" fill="#5E6167" font-size="10.5">' + e + '</text>');
      });
      out.push('<text x="' + (x1 + 8) + '" y="' + (y1 - 8) + '" fill="#5E6167" font-size="10.5">η %</text>');
    }
    out.push('<text x="' + x0 + '" y="' + (y1 - 8) + '" fill="#8E9196" font-size="10.5" text-anchor="middle">H m</text>');
    out.push('<text x="' + x1 + '" y="' + (o.h - 4) + '" fill="#8E9196" font-size="10.5" text-anchor="end">Q m³/h</text>');
    out.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y0 + '" y2="' + y0 + '" stroke="#8E9196" stroke-width="1"/>');
    out.push('<line x1="' + x0 + '" x2="' + x0 + '" y1="' + y1 + '" y2="' + y0 + '" stroke="#8E9196" stroke-width="1"/>');

    var path = function (arr, fy) {
      var s = '', pen = false;
      for (var i = 0; i < N_PTS; i++) {
        if (!isFinite(arr[i])) { pen = false; continue; }
        s += (pen ? 'L' : 'M') + g.x(c.qMax * i / (N_PTS - 1)).toFixed(1) + ' ' + fy(arr[i]).toFixed(1); pen = true;
      }
      return s || 'M0 0';
    };
    out.push('<g clip-path="url(#' + id + '-clip)">');
    if (o.eff) out.push('<path d="' + path(c.eff.map(function (e) { return e * 100; }), g.ye) + '" fill="none" stroke="#8E9196" stroke-width="1.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>');
    if (!o.mini && Math.abs(this.tgt.pump[1] - this.tgt.full[1]) > 0.01) out.push('<path d="' + path(c.full, g.y) + '" fill="none" stroke="#E04619" stroke-opacity=".5" stroke-width="1.4" stroke-dasharray="5 5"/>');
    out.push('<path d="' + path(c.sys, g.y) + '" fill="none" stroke="#F4F3EF" stroke-width="' + (o.mini ? 1.6 : 1.8) + '"/>');
    out.push('<path d="' + path(c.pump, g.y) + '" fill="none" stroke="#E04619" stroke-width="' + (o.mini ? 2 : 2.4) + '"/>');
    out.push('</g>');

    // BEP marker
    if (c.bep.Q > 0 && c.bep.Q < c.qMax && c.bep.H > 0) {
      var bx = g.x(c.bep.Q), by = g.y(c.bep.H);
      out.push('<path d="M' + bx + ' ' + (by - 6) + 'L' + (bx + 6) + ' ' + by + 'L' + bx + ' ' + (by + 6) + 'L' + (bx - 6) + ' ' + by + 'Z" fill="#111214" stroke="#F4F3EF" stroke-width="1.2"/>');
      if (!o.mini) out.push('<text x="' + (bx + 10) + '" y="' + (by - 9) + '" fill="#8E9196" font-size="10.5">BEP</text>');
    }
    // Operating point
    if (c.op) {
      var ox = g.x(c.op.Q), oy = g.y(c.op.H);
      out.push('<line x1="' + ox + '" x2="' + ox + '" y1="' + oy + '" y2="' + y0 + '" stroke="#F4F3EF" stroke-opacity=".35" stroke-dasharray="2 3"/>');
      out.push('<line x1="' + x0 + '" x2="' + ox + '" y1="' + oy + '" y2="' + oy + '" stroke="#F4F3EF" stroke-opacity=".35" stroke-dasharray="2 3"/>');
      out.push('<circle cx="' + ox + '" cy="' + oy + '" r="' + (o.mini ? 5 : 6) + '" fill="#111214" stroke="#F4F3EF" stroke-width="1.6"/><circle cx="' + ox + '" cy="' + oy + '" r="2" fill="#E04619"/>');
      var lab = 'OP ' + num(c.op.Q) + ' m³/h · ' + num(c.op.H, 1) + ' m';
      var right = ox < (x0 + x1) / 2;
      out.push('<text x="' + (ox + (right ? 12 : -12)) + '" y="' + (oy + (o.mini ? -12 : 22)) + '" fill="#F4F3EF" font-size="' + (o.mini ? 10.5 : 11.5) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + lab + '</text>');
    } else {
      out.push('<text x="' + ((x0 + x1) / 2) + '" y="' + ((y0 + y1) / 2) + '" fill="#E04619" font-size="12" text-anchor="middle">NO DELIVERY — SHUTOFF HEAD BELOW STATIC HEAD</text>');
    }
    // Hover guide
    if (this.hoverQ != null) {
      var hx = g.x(this.hoverQ);
      out.push('<line x1="' + hx + '" x2="' + hx + '" y1="' + y1 + '" y2="' + y0 + '" stroke="#E04619" stroke-opacity=".6" stroke-width="1"/>');
    }
    this.svg.innerHTML = out.join('');
  };

  var hqChart, heroChart;
  function initCharts() {
    hqChart = new Chart($('#hqChart'), { w: 760, h: 440, pad: { l: 52, r: 44, t: 26, b: 42 }, eff: true });
    heroChart = new Chart($('#heroChart'), { w: 560, h: 250, pad: { l: 42, r: 16, t: 22, b: 40 }, mini: true });
    var svg = $('#hqChart'), tip = $('#chartTip'), host = $('.chart-host');
    function move(ev) {
      if (!hqChart.cur) return;
      var rect = svg.getBoundingClientRect();
      var vx = (ev.clientX - rect.left) / rect.width * 760;
      var g = hqChart.geom();
      if (vx < g.p.l || vx > g.W - g.p.r) { leave(); return; }
      var q = g.q(vx), d = state.duty, h = Object.assign({}, state.hyd, { rho: state.basis.rho });
      var s = study.s, bid = study.bid;
      hqChart.hoverQ = q;
      if (!hqChart.raf) hqChart.draw();
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
    function leave() { hqChart.hoverQ = null; tip.hidden = true; if (!hqChart.raf && hqChart.cur) hqChart.draw(); }
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
    sel.options[0].textContent = 'Recommended — ' + bidName(result.recommended);
    state.bids.forEach(function (x, i) { sel.options[i + 1].textContent = 'Bid ' + 'ABC'[i] + ' — ' + bidName(i); });

    if (st.noFlow) {
      $('#hydReadouts').innerHTML = kpi('Operating point', '—', 'Shutoff head ' + num(st.s * st.s * st.H0, 1) + ' m < static ' + num(state.hyd.zStatic, 1) + ' m') +
        kpi('Head', '—', '') + kpi('Efficiency', '—', '') + kpi('Input power', '—', '') + kpi('Throttled', '—', '') + kpi('Power saved', '—', '') + kpi('Annual saving', '—', '') + kpi('CO₂ avoided', '—', '');
      $('#hydChecks').innerHTML = '<div class="check check--bad"><div class="check__top"><span class="check__k">No delivery</span><span class="state state--bad">Increase speed</span></div><p>At ' + state.hyd.speed + '% speed the pump cannot overcome the static head of the system.</p></div>';
      return;
    }
    var fl = st.op.Q, sv = st.saveKw;
    rollRender($('#hydReadouts'),
      kpi('Operating flow', num(fl, 0) + ' <small>m³/h</small>', num(fl / d.Q * 100, 0) + '% of rated · ' + state.hyd.speed + '% speed') +
      kpi('Operating head', num(st.op.H, 1) + ' <small>m</small>', 'static ' + num(state.hyd.zStatic, 1) + ' + friction ' + num(st.hf, 1) + ' m') +
      kpi('Pump <span class="nt">η</span> at OP', num(st.etaOp * 100, 1) + ' <small>%</small>', 'BEP at ' + num(st.qBepS, 0) + ' m³/h (scaled)') +
      kpi('Input power · VFD', num(st.Pvfd, 1) + ' <small>kW</small>', 'motor ' + num(st.bid.etaMotor, 1) + '% × VFD ' + num(state.hyd.vfdEff, 1) + '%') +
      kpi('Input power · throttled', num(st.Pthr, 1) + ' <small>kW</small>', 'same flow at 100% speed, ' + num(st.Hthr, 1) + ' m') +
      kpi('Power saved', (sv >= 0 ? '' : '') + num(sv, 1) + ' <small>kW</small>', sv < 0 ? 'VFD losses exceed throttling loss here' : 'VFD trim vs throttle valve', sv > 0) +
      kpi('Annual saving', money(st.saveUsd), num(d.hours) + ' h × $' + d.tariff.toFixed(3) + '/kWh') +
      kpi('CO₂ avoided', num(st.saveCo2, 1) + ' <small>t/yr</small>', 'at ' + b.ef.toFixed(2) + ' kg CO₂/kWh'));
    $$('#hydReadouts small').forEach(function (s) { s.style.cssText = 'font-size:11px;color:#8E9196;font-weight:400'; });

    var vLim = 3.5, vBad = st.vDis > vLim;
    var m = st.npshMargin, nState = m >= 1 ? 'SAFE' : m >= 0 ? 'LOW MARGIN' : 'CAVITATION RISK';
    var nBad = m < 1;
    var nRatio = Math.max(0, Math.min(1, st.npshr / Math.max(st.npsha, 0.01)));
    $('#hydChecks').innerHTML =
      '<div class="check' + (vBad ? ' check--bad' : '') + '"><div class="check__top"><span class="check__k">Pipe erosion velocity · discharge</span><span class="state ' + (vBad ? 'state--bad' : 'state--ok') + '">' + (vBad ? 'EROSION RISK' : 'WITHIN LIMIT') + '</span></div>' +
      '<span class="check__v">' + num(st.vDis, 2) + ' m/s</span>' +
      '<div class="check__bar"><span style="width:' + Math.min(100, st.vDis / 5 * 100).toFixed(1) + '%"></span><em style="left:' + (vLim / 5 * 100) + '%"></em></div>' +
      '<p>Limit 3.5 m/s (marker) · suction ' + num(st.vSuc, 2) + ' m/s · Re ' + sci(st.Re) + ' · f ' + num(st.f, 4) + '</p></div>' +
      '<div class="check' + (nBad ? ' check--bad' : '') + '"><div class="check__top"><span class="check__k">NPSHa vs NPSHr · cavitation margin</span><span class="state ' + (nBad ? 'state--bad' : 'state--ok') + '">' + nState + '</span></div>' +
      '<span class="check__v">' + (m >= 0 ? '+' : '') + num(m, 2) + ' m</span>' +
      '<div class="check__bar"><span style="width:' + (nRatio * 100).toFixed(1) + '%"></span></div>' +
      '<p>NPSHa ' + num(st.npsha, 2) + ' m vs NPSHr ' + num(st.npshr, 2) + ' m at operating flow (' + esc(bidName(st.bidIndex)) + ', scaled ∝ Q²). Minimum margin 1.0 m.</p></div>';

    var aff = st.affinity;
    var line = $('#affinityLine');
    if (!line) { line = doc.createElement('p'); line.id = 'affinityLine'; line.className = 'slider__scale mono'; line.style.cssText = 'justify-content:flex-start;gap:18px;flex-wrap:wrap;margin:6px 0 10px;font-size:10.5px'; $('#vfdSlider').appendChild(line); }
    line.innerHTML = '<span>Affinity @ ' + state.hyd.speed + '%:</span><span>Q ×' + aff.Q.toFixed(3) + '</span><span>H ×' + aff.H.toFixed(3) + '</span><span>P ×' + aff.P.toFixed(3) + '</span><span>Shutoff ' + num(st.s * st.s * st.H0, 1) + ' m</span>';
  }

  /* ================================================================
     Hero
     ================================================================ */
  function renderHero() {
    var rec = result.recommended, r = result.bids[rec];
    $('#heroRec').textContent = bidName(rec);
    $('#heroTcoLabel').textContent = state.duty.horizon + '-yr TCO';
    rollText($('#heroTco'), money(r.tco));
    rollText($('#heroSave'), rec === result.cheapest ? '$0' : money(r.savingsVsCheapest, true));
    var m = r.npshMargin;
    rollText($('#heroNpsh'), (m >= 0 ? '+' : '') + num(m, 1) + ' m');
    var st = $('#heroNpshState');
    st.textContent = m >= 1 ? 'SAFE' : m >= 0 ? 'LOW' : 'RISK';
    st.className = 'state ' + (m >= 1 ? 'state--ok' : 'state--bad');
    heroChart.set(chartTarget(heroStudy));
  }

  /* ================================================================
     Tabs & navigation
     ================================================================ */
  var activeTab = 'tbe';
  function activateTab(name, focus) {
    activeTab = name;
    $$('.tabs [role=tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    $$('.tabpanel').forEach(function (p) { p.hidden = p.id !== 'panel-' + name; });
    if (name === 'hyd' && hqChart) { hqChart.cur = null; hqChart.set(chartTarget(study)); }
    updateNavActive();
  }
  function goStudio(tab) {
    activateTab(tab || 'tbe');
    var el = $('#studio');
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    $('.studio__frame').classList.add('is-open');
    closeMenu();
  }
  function closeMenu() {
    $('#navLinks').classList.remove('is-open');
    $('.nav__toggle').setAttribute('aria-expanded', 'false');
  }
  var currentSection = 'platform';
  function updateNavActive() {
    $$('#navLinks a').forEach(function (a) {
      var href = a.getAttribute('href').slice(1), tl = a.getAttribute('data-tab-link');
      var on = currentSection === href && (!tl || tl === activeTab || (activeTab === 'ai' && tl === 'tbe'));
      a.classList.toggle('is-active', on);
    });
  }

  function bindNav() {
    $$('[data-launch]').forEach(function (b) {
      b.addEventListener('click', function () { goStudio(b.getAttribute('data-launch')); });
    });
    $$('[data-tab-link]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); goStudio(a.getAttribute('data-tab-link')); });
    });
    $$('#navLinks a:not([data-tab-link])').forEach(function (a) { a.addEventListener('click', closeMenu); });
    $('.nav__toggle').addEventListener('click', function () {
      var open = !$('#navLinks').classList.contains('is-open');
      $('#navLinks').classList.toggle('is-open', open);
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
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
        goStudio('tbe');
        toast('Sample case study loaded — 3 bids, ' + dutyLabel() + '.');
      });
    });
    $('#hydVendor').addEventListener('change', function () {
      state.hyd.vendor = this.value === 'rec' ? 'rec' : Number(this.value);
      schedule();
    });
  }

  function loadSample() {
    state = clone(SAMPLE);
    buildMatrix();
    recompute();
    syncInputs();
  }

  /* ================================================================
     Modal
     ================================================================ */
  var modal, lastFocus;
  function openModal(title, bodyHtml, actions) {
    modal = modal || $('#modal');
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
  var REPORT_CSS = 'body{font-family:Inter,Helvetica,Arial,sans-serif;color:#111214;background:#F4F3EF;margin:0;padding:40px;line-height:1.55}' +
    '.rep{max-width:880px;margin:auto}h1{font-size:30px;font-weight:800;letter-spacing:-.035em;line-height:1.05;text-transform:uppercase;margin:0}' +
    'h3{font-size:15px;margin:24px 0 8px}p,li{font-size:13.5px}.rep__meta{font-family:"JetBrains Mono",monospace;font-size:11px;color:#6E6D68;margin:10px 0 22px;padding-bottom:14px;border-bottom:1px solid #E2E1DC}' +
    'table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0 12px}th,td{text-align:right;padding:5px 8px;border-bottom:1px solid #E2E1DC;font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
    'th:first-child,td:first-child{text-align:left;font-family:Inter,Helvetica,Arial,sans-serif}thead th{font-size:10px;text-transform:uppercase;color:#6E6D68;border-bottom:1px solid #111214}' +
    '.callout{border-left:3px solid #E04619;padding:10px 14px;background:#FBFAF7;margin:12px 0}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:28px}' +
    '.sign div{border-top:1px solid #111214;padding-top:6px;font-family:"JetBrains Mono",monospace;font-size:10.5px;color:#6E6D68;text-transform:uppercase}.mark{display:flex;align-items:center;gap:10px;margin-bottom:22px;font-weight:800;font-size:18px;letter-spacing:-.03em}' +
    '.bar{height:6px;width:56px;background:#E04619;margin-bottom:18px}@media print{body{background:#fff;padding:0}.callout{background:#fff}}';
  var MARK_SVG = '<svg width="28" height="28" viewBox="0 0 48 48"><g fill="none" stroke="#111214" stroke-width="4" stroke-linejoin="bevel"><path d="M6 42V6l18 29L42 6v36"/><path d="M14 42V6l10 16.1L34 6v36"/></g><path d="M24 22.1 34 6" stroke="#E04619" stroke-width="4"/></svg>';
  function standalone(title, inner) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">' +
      '<style>' + REPORT_CSS + '</style></head><body><div class="rep"><div class="mark">' + MARK_SVG + 'MYENG</div><div class="bar"></div>' + inner + '</div></body></html>';
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
      tco: function (r) { return r.tco.toFixed(0); }, savingsVsCheapest: function (r) { return r.savingsVsCheapest.toFixed(0); }, co2: function (r) { return r.co2.toFixed(2); }
    };
    OUT_ROWS.forEach(function (r) { if (r.k) rows.push([r.label.replace(/<[^>]+>/g, ''), r.unit].concat(result.bids.map(function (x) { return raw[r.k](x); }))); });
    rows.push(['Status', ''].concat(result.bids.map(function (r, i) { return i === result.recommended && result.anyCompliant ? 'RECOMMENDED' : r.compliant ? 'Compliant' : 'Non-compliant'; })));
    rows.push(['Deviations', ''].concat(result.bids.map(function (r) { return r.deviations.map(function (d) { return '[' + d.sev.toUpperCase() + '] ' + d.text; }).join(' | ') || 'None'; })));
    download(fileSlug('TBE_Matrix') + '.csv', '﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
    toast('CSV exported — ' + rows.length + ' rows.');
  }

  /* ---------- Reports ---------- */
  function bidTable() {
    var h = '<div class="tblwrap"><table><thead><tr><th>Parameter</th>' + state.bids.map(function (b, i) { return '<th>' + esc(bidName(i)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var row = function (label, f) { h += '<tr><td>' + label + '</td>' + result.bids.map(function (r, i) { return '<td>' + f(r, state.bids[i]) + '</td>'; }).join('') + '</tr>'; };
    row('CapEx', function (r, b) { return money(b.capex); });
    row('BEP efficiency / at duty', function (r, b) { return num(b.etaBep, 1) + ' / ' + num(r.eta * 100, 1) + '%'; });
    row('Electrical input', function (r) { return num(r.Pin, 1) + ' kW'; });
    row('Annual energy cost', function (r) { return money(r.energyYr); });
    row(state.duty.horizon + '-yr TCO', function (r) { return '<b>' + money(r.tco) + '</b>'; });
    row('Net vs lowest CapEx', function (r) { return money(r.savingsVsCheapest, true); });
    row('NPSH margin', function (r) { return num(r.npshMargin, 2) + ' m'; });
    row('Material / MAWP', function (r, b) { return esc(b.material) + ' / ' + num(b.mawp) + ' bar'; });
    row('Motor (min. API 610)', function (r, b) { return num(b.motorKw) + ' (' + num(r.motorReq, 1) + ') kW'; });
    row('Lead time', function (r, b) { return num(b.lead) + ' wk'; });
    row('Status', function (r, b) { return r.compliant ? 'Compliant' : 'Non-compliant'; });
    return h + '</tbody></table></div>';
  }
  function devHtml() {
    return result.bids.map(function (r, i) {
      return '<p><b>' + esc(bidName(i)) + '</b></p><ul>' + (r.deviations.length ? r.deviations.map(function (d) { return '<li>[' + d.sev.toUpperCase() + '] ' + esc(d.text) + '</li>'; }).join('') : '<li>No deviations detected.</li>') + '</ul>';
    }).join('');
  }
  function awardInner() {
    var rec = result.recommended, r = result.bids[rec], ch = result.cheapest, n = state.duty.horizon;
    var callout = result.anyCompliant
      ? 'Recommend award to <b>' + esc(bidName(rec)) + '</b>. It has the lowest ' + n + '-year total cost of ownership among technically compliant bids at <b>' + money(r.tco) + '</b>' +
        (rec === ch ? ', and is also the lowest CapEx offer.' : ', ' + money(r.savingsVsCheapest) + ' below the lowest-CapEx offer (' + esc(bidName(ch)) + ') despite a ' + money(state.bids[rec].capex - state.bids[ch].capex) + ' higher purchase price.')
      : 'No bid is fully compliant. <b>' + esc(bidName(rec)) + '</b> has the lowest TCO (' + money(r.tco) + ') but carries major deviations. Issue RFIs before award.';
    return '<h1>Award Recommendation</h1>' +
      '<p class="rep__meta">SAMPLE CASE STUDY · ' + esc(state.project.tag) + ' · ' + esc(state.project.service) + ' · ' + dutyLabel() + ' · ' + today() + '</p>' +
      '<div class="callout">' + callout + '</div>' +
      '<h3>Evaluation summary</h3>' + bidTable() +
      '<h3>Basis</h3><p>' + num(state.duty.hours) + ' h/yr at $' + state.duty.tariff.toFixed(3) + '/kWh over ' + n + ' years, undiscounted. Density ' + num(state.basis.rho) + ' kg/m³. Required material class ' + esc(state.basis.material) + ', minimum casing MAWP ' + num(state.basis.minMawp) + ' bar(g), minimum efficiency ' + num(state.basis.minEff, 1) + '%, NPSHa ' + num(result.npsha.npsha, 2) + ' m at rated flow.</p>' +
      '<h3>Deviations</h3>' + devHtml() +
      '<p style="color:#6E6D68;font-size:12px">Figures in this sample are illustrative and are not vendor-published data. Confirm against certified performance curves before award.</p>' +
      '<div class="sign"><div>Prepared</div><div>Checked</div><div>Approved</div></div>';
  }
  function auditInner() {
    var d = state.duty, b = state.basis, h = state.hyd, st = study;
    var hy = st.noFlow ? '<p>No delivery at ' + h.speed + '% speed — shutoff head below static head.</p>' :
      '<table><tbody>' +
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
    return '<h1>Technical Evaluation Report · Audit Trail</h1>' +
      '<p class="rep__meta">REV 04 · SAMPLE CASE STUDY · ' + esc(state.project.tag) + ' · ' + dutyLabel() + ' · GENERATED ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC · CLIENT-SIDE</p>' +
      '<h3>1. Inputs</h3><table><tbody>' +
      '<tr><td>Duty</td><td>Q ' + num(d.Q) + ' m³/h · H ' + num(d.H) + ' m · ρ ' + num(b.rho) + ' kg/m³</td></tr>' +
      '<tr><td>Economics</td><td>' + num(d.hours) + ' h/yr · $' + d.tariff.toFixed(3) + '/kWh · ' + d.horizon + ' yrs · EF ' + b.ef + ' kg/kWh</td></tr>' +
      '<tr><td>Spec limits</td><td>η ≥ ' + b.minEff + '% · class ' + esc(b.material) + ' · MAWP ≥ ' + b.minMawp + ' bar(g) · lead ≤ ' + b.maxLead + ' wk</td></tr>' +
      '<tr><td>Suction</td><td>P ' + h.Psurf + ' kPa abs · P<sub>v</sub> ' + h.Pvap + ' kPa · z<sub>s</sub> ' + h.zs + ' m · ID ' + h.Ds + ' mm · L ' + h.Ls + ' m · ΣK ' + h.Ks + '</td></tr>' +
      '<tr><td>NPSHa at rated flow</td><td>' + num(result.npsha.pressureHead, 2) + ' + (' + num(h.zs, 2) + ') − ' + num(result.npsha.suctionLoss, 2) + ' = ' + num(result.npsha.npsha, 2) + ' m</td></tr>' +
      '</tbody></table>' +
      '<h3>2. Bid evaluation</h3>' + bidTable() +
      '<h3>3. Deviations (API 610 &amp; project specification)</h3>' + devHtml() +
      '<h3>4. Hydraulic study</h3>' + hy +
      '<h3>5. Formulas</h3><ul>' +
      '<li>P<sub>h</sub> = ρgQH / 3.6×10⁶ kW, g = 9.81 m/s²</li><li>η(Q) = η<sub>BEP</sub>·r(2−r), r = Q/Q<sub>BEP</sub></li>' +
      '<li>P<sub>in</sub> = P<sub>h</sub> / (η<sub>pump</sub>·η<sub>motor</sub>) [· η<sub>VFD</sub> when speed-controlled]</li>' +
      '<li>TCO = CapEx + n·(P<sub>in</sub>·hours·tariff) + n·maintenance (undiscounted)</li>' +
      '<li>h<sub>f</sub> = (f·L/D + ΣK)·v²/2g; f = 64/Re (laminar), Swamee–Jain (turbulent), linear blend 2300–4000</li>' +
      '<li>Pump curve H<sub>s</sub>(Q) = s²H<sub>0</sub> − (H<sub>0</sub> − H<sub>d</sub>)(Q/Q<sub>d</sub>)²; affinity Q∝N, H∝N², P∝N³</li>' +
      '<li>NPSHa = (P<sub>s</sub> − P<sub>v</sub>)/ρg + z<sub>s</sub> − h<sub>f,s</sub>; NPSHr scaled ∝ Q²; minimum margin 1.0 m</li>' +
      '<li>API 610 driver margin 125% (&lt;22 kW), 115% (22–55 kW), 110% (&gt;55 kW)</li></ul>' +
      '<p style="color:#6E6D68;font-size:12px">Sample data is illustrative and not vendor-published. This report was produced entirely in the browser; no inputs were transmitted to MYENG.</p>' +
      '<div class="sign"><div>Prepared</div><div>Checked</div><div>Approved</div></div>';
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
  function openRfi(i) {
    if (i == null) {
      i = 0;
      var worst = -1;
      result.bids.forEach(function (r, k) { if (r.deviations.length > worst && k !== result.recommended) { worst = r.deviations.length; i = k; } });
    }
    var opts = state.bids.map(function (b, k) { return '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>Bid ' + 'ABC'[k] + ' — ' + esc(bidName(k)) + ' (' + result.bids[k].deviations.length + ' flags)</option>'; }).join('');
    openModal('Supplier RFI Email Draft', '<label class="mono dim" for="rfiVendor" style="font-size:11px;display:block;margin-bottom:6px">VENDOR</label><select id="rfiVendor">' + opts + '</select><textarea id="rfiText" spellcheck="true" aria-label="RFI email draft">' + esc(rfiText(i)) + '</textarea>', [
      { label: 'Copy', cls: 'btn--ink', run: function () { copyText($('#rfiText').value); } },
      { label: 'Open in mail client', run: function () {
        var t = $('#rfiText').value, sub = t.split('\n')[0].replace(/^Subject:\s*/, ''), body = t.split('\n').slice(2).join('\n');
        window.location.href = 'mailto:?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(body);
      } }
    ]);
    $('#rfiVendor').addEventListener('change', function () { $('#rfiText').value = rfiText(Number(this.value)); });
  }

  function bindDeliverables() {
    $('#btnCsv').addEventListener('click', csv);
    $('#btnRfi').addEventListener('click', function () { openRfi(); });
    $('#btnAward').addEventListener('click', function () {
      openModal('Award Recommendation Report', '<div class="rep">' + awardInner() + '</div>', [
        { label: 'Print / Save PDF', cls: 'btn--ink', run: function () { printDoc('Award Recommendation ' + state.project.tag, awardInner()); } },
        { label: 'Download HTML', run: function () { download(fileSlug('Award_Recommendation') + '.html', standalone('Award Recommendation', awardInner()), 'text/html'); } }
      ]);
    });
    $('#btnAudit').addEventListener('click', function () {
      openModal('Audit Report · Technical Evaluation', '<div class="rep">' + auditInner() + '</div>', [
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

  function callAzure(text) {
    var mode = $('#azMode').value, ep = $('#azEndpoint').value.trim().replace(/\/+$/, ''), dep = $('#azDeployment').value.trim(), ver = $('#azVersion').value.trim() || '2024-10-21';
    keys.azure = $('#azKey').value || keys.azure;
    if (!/^https:\/\//i.test(ep)) return Promise.reject(new Error('Enter an https:// endpoint URL.'));
    if (!dep) return Promise.reject(new Error('Enter the deployment or model name.'));
    if (!keys.azure) return Promise.reject(new Error('Enter an API key.'));
    var url;
    if (/\/chat\/completions/.test(ep)) url = ep + (ep.indexOf('?') < 0 ? '?api-version=' + encodeURIComponent(ver) : '');
    else if (mode === 'foundry') url = ep + '/models/chat/completions?api-version=' + encodeURIComponent(ver);
    else url = ep + '/openai/deployments/' + encodeURIComponent(dep) + '/chat/completions?api-version=' + encodeURIComponent(ver);
    var body = { messages: [{ role: 'system', content: SYS_PROMPT }, { role: 'user', content: text }], temperature: 0, response_format: { type: 'json_object' } };
    if (mode === 'foundry') body.model = dep;
    var send = function (b) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': keys.azure }, body: JSON.stringify(b) });
    };
    return send(body).then(function (res) {
      if (res.status === 400) { delete body.temperature; delete body.response_format; return send(body); }
      return res;
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
    if (!p) { t.innerHTML = '<tbody><tr><td class="empty">Paste a quotation and run the parser. Extracted fields appear here for review before insertion.</td></tr></tbody>'; return; }
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

  function bindParser() {
    renderParse(null);
    var engine = function () { return ($('input[name=engine]:checked') || {}).value || 'local'; };
    $$('input[name=engine]').forEach(function (r) {
      r.addEventListener('change', function () {
        $$('.engine-cfg').forEach(function (c) { c.hidden = c.getAttribute('data-engine') !== engine(); });
      });
    });
    $('#gmModel').addEventListener('change', function () { $('#gmCustomWrap').hidden = this.value !== 'custom'; });
    $('#azMode').addEventListener('change', function () {
      $('#azVersion').value = this.value === 'foundry' ? '2024-05-01-preview' : '2024-10-21';
      $('#azEndpoint').placeholder = this.value === 'foundry' ? 'https://your-resource.services.ai.azure.com' : 'https://your-resource.openai.azure.com';
    });
    $('#btnSampleQuote').addEventListener('click', function () { $('#quoteText').value = SAMPLE_QUOTE; setStatus('Sample quotation inserted (fictional vendor). Run the parser.'); });
    $('#btnClearQuote').addEventListener('click', function () { $('#quoteText').value = ''; parsed = null; renderParse(null); $('#btnInsert').disabled = true; setStatus('Cleared.'); });
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
      $('#studio').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      toast(n + ' fields inserted into Bid ' + 'ABC'[i] + ' — ' + bidName(i) + '.');
    });
  }

  /* ================================================================
     ROI
     ================================================================ */
  function renderRoi() {
    var r = E.fleetSavings(roi);
    rollRender($('#roiOut'),
      '<div class="kpi kpi--lead"><span class="kpi__k">10-year energy cost avoided</span><span class="kpi__v" data-roll="10-year energy cost avoided">' + money(r.usd) + '</span><span class="kpi__s">at $' + roi.tariff.toFixed(3) + '/kWh, constant tariff, undiscounted</span></div>' +
      '<div class="kpi"><span class="kpi__k">Energy avoided</span><span class="kpi__v" data-roll="Energy avoided">' + num(r.kWh / 1000, 0) + ' MWh</span></div>' +
      '<div class="kpi"><span class="kpi__k">CO₂ avoided</span><span class="kpi__v" data-roll="CO₂ avoided">' + num(r.co2, 0) + ' t</span></div>' +
      '<div class="kpi"><span class="kpi__k">Saving per pump</span><span class="kpi__v" data-roll="Saving per pump">' + num(r.kwPerPump, 2) + ' kW</span></div>' +
      '<div class="kpi"><span class="kpi__k">Installed pump-years</span><span class="kpi__v" data-roll="Installed pump-years">' + num(r.pumpYears) + '</span></div>');
    $('#roiFormula').innerHTML = 'ΔP = P × (1 − η₀ / (η₀ + Δη)) = ' + num(roi.kw) + ' × (1 − ' + roi.baseEff + ' / ' + (roi.baseEff + roi.delta).toFixed(1) + ') = ' + num(r.kwPerPump, 2) + ' kW · pump-years = ' + num(roi.perYear) + ' × (1 + 2 + … + 10) = ' + num(r.pumpYears) + ' · savings = ΔP × ' + num(roi.hours) + ' h × pump-years × tariff';
  }
  function bindRoi() {
    $$('[data-roi]').forEach(function (el) {
      el.value = roi[el.getAttribute('data-roi')];
      el.addEventListener('input', function () {
        var v = parseFloat(el.value), bad = !isFinite(v) || v < parseFloat(el.min) || (el.max && v > parseFloat(el.max));
        el.classList.toggle('is-invalid', bad);
        if (bad) return;
        roi[el.getAttribute('data-roi')] = v; renderRoi();
      });
    });
    renderRoi();
  }

  /* ================================================================
     Legal
     ================================================================ */
  var LEGAL = {
    privacy: ['Privacy Policy', '<p class="rep__meta mono">Effective 1 November 2026 · MYENG, Amman, Jordan and Jubail, Saudi Arabia</p>' +
      '<h3>Summary</h3><p>The MYENG website and Sandbox Studio run entirely in your browser. We do not operate a server that receives your engineering inputs, vendor quotations, prices or API keys.</p>' +
      '<h3>What stays in your browser</h3><ul><li>All Studio inputs, calculations, reports and exports are processed in page memory and discarded when you close or reload the tab.</li>' +
      '<li>We do not use cookies, localStorage, analytics, advertising pixels or session recording.</li>' +
      '<li>CSV and report files are generated locally and saved only where you choose.</li></ul>' +
      '<h3>Bring-your-own-key (BYOK) extraction</h3><ul><li>API keys you enter for Microsoft Azure or Google Gemini are held in JavaScript memory for the current tab only. They are never written to storage and never sent to MYENG.</li>' +
      '<li>If you choose a cloud provider, the quotation text you submit is sent directly from your browser to that provider\'s endpoint under your own account. That provider\'s terms and data-retention policies apply — including, for some unpaid tiers, use of content to improve their products.</li>' +
      '<li>The local parser sends nothing over the network.</li></ul>' +
      '<h3>Third-party resources</h3><p>The site is served by GitHub Pages and loads typefaces from Google Fonts. These services receive standard request data such as your IP address and user agent under their own privacy policies.</p>' +
      '<h3>Email</h3><p>If you write to founders@myeng.online we keep the correspondence to respond to you and do not share it.</p>' +
      '<h3>Paid plans</h3><p>Pro and Enterprise features that store data (saved workspaces, managed extraction) are provided under a separate written agreement that sets out processing, retention and deletion terms.</p>' +
      '<h3>Contact</h3><p>founders@myeng.online</p>'],
    terms: ['Terms of Service', '<p class="rep__meta mono">Effective 1 November 2026 · MYENG, Amman, Jordan and Jubail, Saudi Arabia</p>' +
      '<h3>1. The service</h3><p>MYENG provides engineering calculation and bid-evaluation tools for rotating equipment. The Sandbox is provided free of charge, as is, for evaluation and professional use.</p>' +
      '<h3>2. Engineering responsibility</h3><p>Results are calculated from the inputs you provide using the formulas documented in the Studio and in every audit report. They support, and do not replace, the judgement of a qualified engineer, vendor-certified performance data, witnessed testing, or your company\'s specifications. You remain responsible for decisions made using the outputs.</p>' +
      '<h3>3. Sample data</h3><p>The preloaded case study uses anonymised bidders and illustrative figures. They are not vendor-published data and refer to no real manufacturer.</p>' +
      '<h3>4. Your data and keys</h3><p>Browser sessions are not retained by MYENG. When you use your own Azure or Gemini key, you are responsible for complying with that provider\'s terms and for the content you submit.</p>' +
      '<h3>5. Acceptable use</h3><p>Do not attempt to disrupt the site, misrepresent outputs as vendor-certified, or use the service in breach of applicable law or confidentiality obligations.</p>' +
      '<h3>6. Liability</h3><p>To the extent permitted by law, MYENG is not liable for indirect or consequential loss arising from use of the free Sandbox. Paid plans are governed by their order form.</p>' +
      '<h3>7. Changes</h3><p>We may update these terms; the effective date above will change accordingly.</p>' +
      '<h3>Contact</h3><p>founders@myeng.online</p>']
  };

  /* ================================================================
     Reveal & observers
     ================================================================ */
  function observe() {
    if (!('IntersectionObserver' in window) || reduceMotion) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      $('.studio__frame').classList.add('is-open');
    } else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      $$('.reveal').forEach(function (el) { io.observe(el); });
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-open'); so.unobserve(e.target); } });
      }, { threshold: 0.04 });
      so.observe($('.studio__frame'));
    }
    if ('IntersectionObserver' in window) {
      var no = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { currentSection = e.target.id; updateNavActive(); } });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['platform', 'studio', 'architecture', 'pricing'].forEach(function (id) { no.observe($('#' + id)); });
    }
  }


  /* ================================================================
     Rolling tabular counters
     ================================================================ */
  var NUM_RE = /(\d[\d,]*(?:\.\d+)?)/;
  var tweens = new WeakMap();
  function splitNum(t) { return String(t).split(NUM_RE); }
  function rollText(el, next) {
    if (!el) return;
    var prev = el.getAttribute('data-final');
    if (prev == null) prev = el.textContent;
    el.setAttribute('data-final', next);
    if (prev === next) { if (!tweens.has(el)) el.textContent = next; return; }
    var a = splitNum(prev), b = splitNum(next);
    var same = !reduceMotion && a.length === b.length && a.length > 1 &&
      a.every(function (x, i) { return i % 2 === 1 || x === b[i]; });
    var old = tweens.get(el); if (old) cancelAnimationFrame(old.raf);
    if (!same) { tweens.delete(el); el.textContent = next; return; }
    var t0 = performance.now(), dur = 520;
    var from = a.map(function (x, i) { return i % 2 ? parseFloat(x.replace(/,/g, '')) : x; });
    var meta = b.map(function (x, i) {
      if (!(i % 2)) return null;
      var d = x.indexOf('.') >= 0 ? x.length - x.indexOf('.') - 1 : 0;
      return { to: parseFloat(x.replace(/,/g, '')), d: d, comma: x.indexOf(',') >= 0 || parseFloat(x.replace(/,/g, '')) >= 1000 && /,/.test(prev) };
    });
    var tw = {};
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = b.map(function (x, i) {
        if (!(i % 2)) return x;
        var m = meta[i], v = from[i] + (m.to - from[i]) * e;
        return m.comma ? v.toLocaleString('en-US', { minimumFractionDigits: m.d, maximumFractionDigits: m.d }) : v.toFixed(m.d);
      }).join('');
      if (t < 1) tw.raf = requestAnimationFrame(step); else { el.textContent = next; tweens.delete(el); }
    })(t0);
    tweens.set(el, tw);
  }
  // Re-render a container but roll [data-roll] numbers from their previous values.
  function rollRender(host, html) {
    var prev = {};
    $$('[data-roll]', host).forEach(function (el) { prev[el.getAttribute('data-roll')] = el.getAttribute('data-final') || el.textContent; });
    host.innerHTML = html;
    $$('[data-roll]', host).forEach(function (el) {
      var k = el.getAttribute('data-roll'), next = el.textContent;
      if (prev[k] != null) { el.textContent = prev[k]; el.setAttribute('data-final', prev[k]); rollText(el, next); }
      else el.setAttribute('data-final', next);
    });
  }

  /* ================================================================
     Tactile tilt + specular sheen
     ================================================================ */
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('.tilt').forEach(function (el) {
      var cur = { rx: 0, ry: 0, sh: 0 }, tgt = { rx: 0, ry: 0, sh: 0 }, raf = 0, MAX = 2.5;
      function loop() {
        var k = 0.12, d = 0;
        ['rx', 'ry', 'sh'].forEach(function (p) { cur[p] += (tgt[p] - cur[p]) * k; d = Math.max(d, Math.abs(tgt[p] - cur[p])); });
        el.style.setProperty('--rx', cur.rx.toFixed(3) + 'deg');
        el.style.setProperty('--ry', cur.ry.toFixed(3) + 'deg');
        el.style.setProperty('--sheen', cur.sh.toFixed(3));
        raf = d > 0.002 ? requestAnimationFrame(loop) : 0;
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
    var cv = $('#flowfield'), host = $('#showcase');
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
      var speed = 0.7 + 1.0 * (state.duty.Q / 420);
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

  function initStagger() {
    $$('[data-stagger]').forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c, i) { c.classList.add('reveal'); c.style.setProperty('--d', (i * 0.09).toFixed(2) + 's'); });
    });
    $$('.sec-head').forEach(function (g) { $$('.reveal', g).forEach(function (c, i) { c.style.setProperty('--d', (i * 0.12).toFixed(2) + 's'); }); });
  }

  /* ================================================================
     Init
     ================================================================ */
  function init() {
    $('#reqMaterial').innerHTML = E.MATERIAL_CLASSES.map(function (m) { return '<option>' + m + '</option>'; }).join('');
    $('#hydVendor').innerHTML = '<option value="rec">Recommended</option>' + [0, 1, 2].map(function (i) { return '<option value="' + i + '">Bid ' + 'ABC'[i] + '</option>'; }).join('');
    $('#year').textContent = new Date().getFullYear();
    initCharts();
    buildSliders();
    buildMatrix();
    doc.addEventListener('input', onBoundInput);
    doc.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT' && e.target.matches('[data-path]')) onBoundInput(e); });
    bindNav();
    bindDeliverables();
    bindParser();
    bindRoi();
    recompute();
    syncInputs();

    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('#modal').addEventListener('close', function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    $$('[data-legal]').forEach(function (b) {
      b.addEventListener('click', function () { var l = LEGAL[b.getAttribute('data-legal')]; openModal(l[0], '<div class="rep">' + l[1] + '</div>'); });
    });

    initStagger();
    observe();
    initTilt();
    initFlowField();
    requestAnimationFrame(function () { doc.documentElement.classList.add('is-ready'); doc.body.classList.add('is-ready'); });
    if (location.hash === '#studio') $('.studio__frame').classList.add('is-open');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
