/*!
 * MYENG equipment twin renderer — REV 09
 * Studio-lit brushed-steel cross-section of an end-suction pump train
 * (suction → impeller → volute → discharge, shaft → motor → VFD).
 * It performs no engineering math: every value it reacts to is computed by
 * engine.js and passed in through update(). Readouts are HTML, not canvas text.
 */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var VERM = '#E04619';
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function setupCanvas(cv, W, H) {
    var ctx = cv.getContext('2d');
    var o = { cv: cv, ctx: ctx, W: W, H: H, scale: 1, ox: 0, oy: 0, dpr: 1, cssW: 0 };
    o.resize = function () {
      var r = cv.getBoundingClientRect();
      if (!r.width) return false;
      o.dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * o.dpr); cv.height = Math.round(r.height * o.dpr);
      o.cssW = r.width;
      o.scale = Math.min(r.width / W, r.height / H);
      o.ox = (r.width - W * o.scale) / 2; o.oy = (r.height - H * o.scale) / 2;
      o.apply(ctx);
      return true;
    };
    o.apply = function (c) { c.setTransform(o.dpr * o.scale, 0, 0, o.dpr * o.scale, o.dpr * o.ox, o.dpr * o.oy); };
    o.clear = function () { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); };
    return o;
  }

  function loop(tick) {
    var raf = 0, on = false, last = 0;
    function f(now) {
      var dt = last ? Math.min(3, (now - last) / 16.67) : 1; last = now;
      tick(dt);
      raf = on ? requestAnimationFrame(f) : 0;
    }
    return {
      start: function () { if (on) return; on = true; last = 0; raf = requestAnimationFrame(f); },
      stop: function () { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
      running: function () { return on; }
    };
  }

  /* ---------- material helpers (brushed steel under a top-left key light) ---------- */
  function steelV(c, y0, y1) {   // horizontal cylinder / pipe shell
    var g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#24272D'); g.addColorStop(0.16, '#6E747E'); g.addColorStop(0.3, '#B4B9C0');
    g.addColorStop(0.42, '#7A8089'); g.addColorStop(0.7, '#3A3E45'); g.addColorStop(1, '#16181C');
    return g;
  }
  function steelR(c, x, y, r) {  // disc / casing, specular offset toward the light
    var g = c.createRadialGradient(x - r * 0.42, y - r * 0.5, r * 0.05, x, y, r * 1.08);
    g.addColorStop(0, '#C3C7CD'); g.addColorStop(0.22, '#8A9099'); g.addColorStop(0.55, '#4A4F57'); g.addColorStop(0.85, '#262A30'); g.addColorStop(1, '#17191D');
    return g;
  }
  function cavity(c, x, y, r) {  // wetted interior
    var g = c.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, '#14171B'); g.addColorStop(1, '#08090B');
    return g;
  }
  function shadowOn(c, blur, oy) { c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = blur; c.shadowOffsetX = 0; c.shadowOffsetY = oy; }
  function shadowOff(c) { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function brushed(c, x0, y0, w, h, vertical) {   // faint machining lines
    c.save(); c.globalAlpha = 0.06; c.strokeStyle = '#FFFFFF'; c.lineWidth = 0.6;
    for (var i = 0; i < (vertical ? w : h); i += 3) {
      c.beginPath();
      if (vertical) { c.moveTo(x0 + i, y0); c.lineTo(x0 + i, y0 + h); } else { c.moveTo(x0, y0 + i); c.lineTo(x0 + w, y0 + i); }
      c.stroke();
    }
    c.restore();
  }

  /* ------------------------------------------------------------------
     Full pump-train twin (hydraulics tab)
     ------------------------------------------------------------------ */
  function pump(cv, opts) {
    var W = 1000, H = 460, cvs = setupCanvas(cv, W, H), ctx = cvs.ctx;
    var reduced = !!(opts && opts.reduced);
    var P = { x: 420, y: 250 };
    var R2 = 82, EYE = 26, VIN = 92, VOUT0 = 104, VOUT1 = 134, RIM = 14;
    var D_Y = P.y - (VIN + VOUT1) / 2, THROAT = (VOUT1 - VIN) / 2;
    var SX1 = P.x - VOUT1 - RIM - 6;            // suction flange x
    var tgt = null, cur = null, phi = 0, t = 0, parts = [], rings = [];
    var layer = document.createElement('canvas'), lctx = layer.getContext('2d'), layerKey = '';

    function vout(a) { return VOUT0 + (VOUT1 - VOUT0) * (a / TAU); }
    function vols(r0) {   // spiral path from the cutwater (top) clockwise, radius offset r0
      var pts = [];
      for (var a = 0; a <= TAU + 1e-6; a += 0.04) { var rr = vout(a) + r0, aa = a - Math.PI / 2; pts.push([P.x + rr * Math.cos(aa), P.y + rr * Math.sin(aa)]); }
      return pts;
    }

    /* static metal, cached per geometry */
    function drawStatic(c, hs, hd) {
      c.clearRect(-10, -10, W + 20, H + 20);
      // studio backdrop
      var bg = c.createRadialGradient(300, 70, 20, 420, 230, 720);
      bg.addColorStop(0, '#1A1D22'); bg.addColorStop(0.45, '#121418'); bg.addColorStop(1, '#0C0D10');
      c.fillStyle = bg; c.fillRect(0, 0, W, H);
      var floor = c.createLinearGradient(0, H * 0.72, 0, H); floor.addColorStop(0, 'rgba(255,255,255,0)'); floor.addColorStop(1, 'rgba(255,255,255,.025)');
      c.fillStyle = floor; c.fillRect(0, H * 0.72, W, H * 0.28);
      // contact shadows
      c.save(); c.filter = 'blur(14px)'; c.fillStyle = 'rgba(0,0,0,.55)';
      c.beginPath(); c.ellipse(P.x, P.y + VOUT1 + RIM + 18, 170, 16, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(765, P.y + 78, 150, 12, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(930, P.y + 82, 60, 10, 0, 0, TAU); c.fill();
      c.restore();

      // suction pipe (cutaway)
      var t = 8;
      shadowOn(c, 18, 8); c.fillStyle = steelV(c, P.y - hs - t, P.y + hs + t); c.fillRect(30, P.y - hs - t, SX1 - 30, (hs + t) * 2); shadowOff(c);
      c.fillStyle = cavity(c, (30 + SX1) / 2, P.y, hs * 3); c.fillRect(30, P.y - hs, SX1 - 30, hs * 2);
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(30, P.y - hs + 0.5); c.lineTo(SX1, P.y - hs + 0.5); c.moveTo(30, P.y + hs - 0.5); c.lineTo(SX1, P.y + hs - 0.5); c.stroke();
      c.fillStyle = steelV(c, P.y - hs - t - 10, P.y + hs + t + 10); rrect(c, 26, P.y - hs - t - 10, 8, (hs + t + 10) * 2, 2); c.fill();
      c.fillStyle = steelV(c, P.y - hs - t - 12, P.y + hs + t + 12); rrect(c, SX1 - 4, P.y - hs - t - 12, 10, (hs + t + 12) * 2, 2); c.fill();

      // drive train behind the casing: shaft, bearing frame, coupling, motor, fan cowl, VFD
      c.fillStyle = steelV(c, P.y - 9, P.y + 9); c.fillRect(P.x, P.y - 9, 270, 18);
      shadowOn(c, 20, 10);
      c.fillStyle = steelV(c, P.y - 34, P.y + 34); rrect(c, 548, P.y - 34, 92, 68, 8); c.fill();
      c.fillStyle = steelV(c, P.y - 22, P.y + 22); rrect(c, 650, P.y - 22, 18, 44, 3); c.fill();
      c.fillStyle = steelV(c, P.y - 60, P.y + 60); rrect(c, 676, P.y - 60, 176, 120, 14); c.fill();
      shadowOff(c);
      for (var fx = 690; fx < 840; fx += 9) {   // cooling fins
        c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(fx, P.y - 54, 3, 108);
        c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(fx + 3, P.y - 54, 1, 108);
      }
      c.fillStyle = steelV(c, P.y - 50, P.y + 50);
      c.beginPath(); c.moveTo(852, P.y - 50); c.lineTo(876, P.y - 38); c.lineTo(876, P.y + 38); c.lineTo(852, P.y + 50); c.closePath(); c.fill();
      // VFD cabinet: graphite with glass display (load bar is dynamic)
      shadowOn(c, 22, 10);
      var cab = c.createLinearGradient(892, 0, 972, 0); cab.addColorStop(0, '#24272D'); cab.addColorStop(0.5, '#2E3238'); cab.addColorStop(1, '#1B1D22');
      c.fillStyle = cab; rrect(c, 892, P.y - 66, 80, 132, 10); c.fill(); shadowOff(c);
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; rrect(c, 892.5, P.y - 65.5, 79, 131, 10); c.stroke();
      c.fillStyle = '#0B0C0E'; rrect(c, 902, P.y - 54, 60, 34, 5); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.1)'; rrect(c, 902.5, P.y - 53.5, 59, 33, 5); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.05)'; for (var vl = 0; vl < 5; vl++) c.fillRect(904, P.y + 8 + vl * 8, 56, 2);
      c.strokeStyle = 'rgba(155,156,163,.35)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(876, P.y); c.lineTo(892, P.y); c.stroke(); c.setLineDash([]);

      // discharge pipe shell
      var dx0 = P.x, taper = P.x + 72;
      shadowOn(c, 18, 8);
      c.fillStyle = steelV(c, D_Y - THROAT - t, D_Y + THROAT + t);
      c.beginPath(); c.moveTo(dx0, D_Y - THROAT - t); c.lineTo(taper, D_Y - hd - t); c.lineTo(W - 30, D_Y - hd - t); c.lineTo(W - 30, D_Y + hd + t); c.lineTo(taper, D_Y + hd + t); c.lineTo(dx0, D_Y + THROAT + t); c.closePath(); c.fill();
      shadowOff(c);
      c.fillStyle = steelV(c, D_Y - hd - t - 12, D_Y + hd + t + 12); rrect(c, taper - 2, D_Y - hd - t - 12, 10, (hd + t + 12) * 2, 2); c.fill();
      c.fillStyle = steelV(c, D_Y - hd - t - 10, D_Y + hd + t + 10); rrect(c, W - 34, D_Y - hd - t - 10, 8, (hd + t + 10) * 2, 2); c.fill();

      // volute: machined rim + wetted channel
      var outer = vols(RIM), inner = vols(0);
      shadowOn(c, 26, 12);
      c.beginPath(); outer.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
      c.lineTo(P.x + 6, D_Y - THROAT - t); c.lineTo(P.x - 20, P.y - VOUT0 - RIM); c.closePath();
      c.fillStyle = steelR(c, P.x, P.y, VOUT1 + RIM); c.fill(); shadowOff(c);
      c.save(); c.clip(); c.globalAlpha = 0.05; c.strokeStyle = '#fff'; c.lineWidth = 0.6;
      for (var br = VIN; br < VOUT1 + RIM; br += 3) { c.beginPath(); c.arc(P.x, P.y, br, 0, TAU); c.stroke(); }
      c.restore();
      c.beginPath(); inner.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
      c.lineTo(P.x + 4, D_Y - THROAT); c.lineTo(P.x - 18, P.y - VOUT0); c.closePath();
      c.fillStyle = cavity(c, P.x, P.y, VOUT1); c.fill();
      c.beginPath(); inner.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
      c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1; c.stroke();
      // discharge wetted channel (drawn after the volute so the throat is continuous)
      c.fillStyle = cavity(c, (dx0 + W) / 2, D_Y, 300);
      c.beginPath(); c.moveTo(dx0 - 4, D_Y - THROAT); c.lineTo(taper, D_Y - hd); c.lineTo(W - 30, D_Y - hd); c.lineTo(W - 30, D_Y + hd); c.lineTo(taper, D_Y + hd); c.lineTo(dx0 - 4, D_Y + THROAT); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.14)';
      c.beginPath(); c.moveTo(dx0, D_Y - THROAT + 0.5); c.lineTo(taper, D_Y - hd + 0.5); c.lineTo(W - 30, D_Y - hd + 0.5);
      c.moveTo(dx0, D_Y + THROAT - 0.5); c.lineTo(taper, D_Y + hd - 0.5); c.lineTo(W - 30, D_Y + hd - 0.5); c.stroke();
      // back plate seat around the impeller
      c.beginPath(); c.arc(P.x, P.y, VIN, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.08)'; c.stroke();
    }
    function ensureLayer() {
      var key = cvs.cv.width + 'x' + cvs.cv.height + ':' + Math.round(cur.hs) + ':' + Math.round(cur.hd);
      if (key === layerKey) return;
      layer.width = cvs.cv.width; layer.height = cvs.cv.height;
      cvs.apply(lctx); drawStatic(lctx, cur.hs, cur.hd); layerKey = key;
    }

    /* dynamic parts */
    function drawImpeller(c) {
      c.save();
      c.beginPath(); c.arc(P.x, P.y, R2 + 4, 0, TAU); c.fillStyle = steelR(c, P.x, P.y, R2 + 4); c.fill();
      c.beginPath(); c.arc(P.x, P.y, R2 - 2, 0, TAU); c.fillStyle = 'rgba(8,9,11,.82)'; c.fill();
      var beta = 25 * Math.PI / 180;
      for (var k = 0; k < 6; k++) {
        var th0 = phi + k * TAU / 6, a = [], b = [];
        for (var i = 0; i <= 16; i++) {
          var f = i / 16, r = EYE + (R2 - 2 - EYE) * f, th = th0 - Math.log(r / EYE) / Math.tan(beta);
          var w = lerp(6.5, 3, f) / r;
          a.push([P.x + r * Math.cos(th), P.y + r * Math.sin(th)]);
          b.push([P.x + r * Math.cos(th + w), P.y + r * Math.sin(th + w)]);
        }
        c.beginPath(); a.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
        for (var j = b.length - 1; j >= 0; j--) c.lineTo(b[j][0], b[j][1]);
        c.closePath();
        var mid = a[8], vg = c.createLinearGradient(mid[0] - 30, mid[1] - 30, mid[0] + 30, mid[1] + 30);
        vg.addColorStop(0, '#C9CDD3'); vg.addColorStop(0.5, '#8A9099'); vg.addColorStop(1, '#3E434A');
        c.fillStyle = vg; c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.8; c.stroke();
      }
      // fixed key light sweeping across the rotating vanes
      var sp = c.createRadialGradient(P.x - 30, P.y - 40, 4, P.x - 10, P.y - 20, R2 + 10);
      sp.addColorStop(0, 'rgba(255,255,255,.22)'); sp.addColorStop(0.5, 'rgba(255,255,255,.05)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
      c.beginPath(); c.arc(P.x, P.y, R2 + 4, 0, TAU); c.fillStyle = sp; c.fill();
      // eye, hub, bore
      c.beginPath(); c.arc(P.x, P.y, EYE, 0, TAU); c.fillStyle = cavity(c, P.x, P.y, EYE); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.arc(P.x, P.y, 12, 0, TAU); c.fillStyle = steelR(c, P.x, P.y, 12); c.fill();
      c.beginPath(); c.arc(P.x, P.y, 4.5, 0, TAU); c.fillStyle = '#0A0B0D'; c.fill();
      c.restore();
    }

    function spawn(anywhere) {
      var p = { st: 0, o: Math.random() * 2 - 1, x: anywhere ? 30 + Math.random() * (SX1 - 30) : 26 - Math.random() * 30, rho: 0, ch: Math.random() * TAU, a: 0, k: 0, life: 0, tr: [] };
      if (anywhere && Math.random() < 0.45) { p.st = 4; p.x = P.x + Math.random() * (W - 30 - P.x); }
      return p;
    }
    function posOf(p) {
      var c = cur;
      if (p.st === 0) return [p.x, P.y + p.o * c.hs * 0.8];
      if (p.st === 1) { return [lerp(SX1, P.x + p.o * EYE * 0.45, p.k), lerp(P.y + p.o * c.hs * 0.8, P.y + p.o * EYE * 0.55, p.k)]; }
      if (p.st === 2) { var r = EYE + (R2 - EYE) * p.rho, th = phi + p.ch - Math.log(r / EYE) / Math.tan(25 * Math.PI / 180) + 0.26; return [P.x + r * Math.cos(th), P.y + r * Math.sin(th)]; }
      if (p.st === 3) { var ro = vout(p.a), rr = lerp(VIN + 4, ro - 4, (p.o + 1) / 2), aa = p.a - Math.PI / 2; return [P.x + rr * Math.cos(aa), P.y + rr * Math.sin(aa)]; }
      var tp = clamp((p.x - P.x) / 72, 0, 1), hw = lerp(THROAT - 3, c.hd * 0.82, tp);
      return [p.x, D_Y + p.o * hw];
    }
    function step(dt) {
      var c = cur, g = c.target || c;
      ['speed', 'flow', 'vSuc', 'vDis', 'hs', 'hd', 'margin', 'load'].forEach(function (k) { c[k] = lerp(c[k], g[k], 0.08 * dt); });
      phi += 0.075 * c.speed * dt; t += dt;
      var n = Math.round(clamp(40 + 130 * (c.flow / 600), 30, 170));
      while (parts.length < n) parts.push(spawn(!parts.seeded));
      parts.seeded = true; if (parts.length > n) parts.length = n;
      var vs = clamp(c.vSuc * 1.5, 0.35, 7) * dt, vd = clamp(c.vDis * 1.5, 0.35, 8) * dt;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.life += dt;
        if (p.st === 0) { p.x += vs; if (p.x >= SX1) { p.st = 1; p.k = 0; p.tr.length = 0; } }
        else if (p.st === 1) { p.k += 0.06 * dt; if (p.k >= 1) { p.st = 2; p.rho = 0; p.tr.length = 0; } }
        else if (p.st === 2) { p.rho += (0.018 + 0.03 * c.speed) * dt; if (p.rho >= 1) { p.st = 3; var ang = phi + p.ch - Math.log(R2 / EYE) / Math.tan(25 * Math.PI / 180); p.a = ((ang + Math.PI / 2) % TAU + TAU) % TAU; } }
        else if (p.st === 3) { p.a += (vd / 110) * 0.9; if (p.a >= TAU) { p.st = 4; p.x = P.x; } }
        else if (p.st === 4) { p.x += vd; if (p.x > W - 32) { parts[i] = spawn(false); continue; } }
        if (p.st === 1) continue;
        var q = posOf(p);
        p.tr.push(q[0], q[1]); if (p.tr.length > 22) p.tr.splice(0, 2);
      }
      if (c.margin < 1) {
        var rate = clamp(1 - c.margin, 0.35, 1.6) * 1.3 * dt;
        while (Math.random() < rate && rings.length < 60) {
          rate -= 1;
          var a = Math.PI * (0.55 + Math.random() * 0.9), rr = EYE * (0.75 + Math.random() * 1.1);
          rings.push({ x: P.x + rr * Math.cos(a), y: P.y + rr * Math.sin(a), life: 0, max: 30 + Math.random() * 24, rm: 4 + Math.random() * 6 });
        }
      }
      for (var b = rings.length - 1; b >= 0; b--) { rings[b].life += dt; if (rings[b].life >= rings[b].max) rings.splice(b, 1); }
    }
    function drawFlow(c, impellerPass) {
      c.lineCap = 'round';
      for (var i = 0; i < parts.length; i++) {
        if ((parts[i].st === 2) !== impellerPass || parts[i].st === 1) continue;
        var tr = parts[i].tr, n = tr.length / 2;
        if (n < 3) continue;
        var vis = 1, fade = Math.min(1, parts[i].life / 14);
        for (var k = 1; k < n; k++) {
          var f = k / (n - 1);
          c.strokeStyle = 'rgba(236,235,230,' + (0.62 * f * vis * fade).toFixed(3) + ')';
          c.lineWidth = 0.4 + 1.7 * f;
          c.beginPath(); c.moveTo(tr[(k - 1) * 2], tr[(k - 1) * 2 + 1]); c.lineTo(tr[k * 2], tr[k * 2 + 1]); c.stroke();
        }
      }
    }
    function drawAlerts(c) {
      if (rings.length) {
        c.save(); c.shadowColor = VERM; c.shadowBlur = 10;
        rings.forEach(function (r) {
          var k = r.life / r.max, rad = r.rm * (k < 0.7 ? k / 0.7 : 1 + (k - 0.7) * 0.6);
          c.beginPath(); c.arc(r.x, r.y, Math.max(0.4, rad), 0, TAU);
          c.strokeStyle = 'rgba(224,70,25,' + (0.95 * (1 - k * 0.8)).toFixed(3) + ')'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = 'rgba(224,70,25,' + (0.12 * (1 - k)).toFixed(3) + ')'; c.fill();
        });
        c.restore();
      }
      if (tgt && tgt.erosion) {
        var pulse = 0.55 + 0.45 * Math.sin(t * 0.1), hd = cur.hd, taper = P.x + 72;
        c.save(); c.shadowColor = VERM; c.shadowBlur = 14; c.strokeStyle = 'rgba(224,70,25,' + (0.5 + 0.4 * pulse).toFixed(3) + ')'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(taper, D_Y - hd + 1); c.lineTo(W - 30, D_Y - hd + 1); c.moveTo(taper, D_Y + hd - 1); c.lineTo(W - 30, D_Y + hd - 1); c.stroke();
        c.restore();
      }
    }
    function drawDynamicDrive(c) {
      // VFD load bar + status lamp, motor fan glint
      var lb = clamp(cur.load, 0, 1);
      c.fillStyle = 'rgba(255,255,255,.06)'; rrect(c, 908, P.y - 41, 48, 6, 3); c.fill();
      var lg = c.createLinearGradient(908, 0, 956, 0); lg.addColorStop(0, '#9B9CA3'); lg.addColorStop(1, '#ECEBE6');
      c.fillStyle = cur.load > 1 ? VERM : lg; rrect(c, 908, P.y - 41, Math.max(6, 48 * lb), 6, 3); c.fill();
      c.beginPath(); c.arc(956, P.y + 52, 2.5, 0, TAU); c.fillStyle = cur.load > 1 ? VERM : 'rgba(236,235,230,.55)'; c.fill();
      c.save(); c.translate(864, P.y); c.globalAlpha = 0.35;
      for (var fb = 0; fb < 4; fb++) { var fa = phi * 0.7 + fb * TAU / 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(fa) * 7, Math.sin(fa) * 30); c.strokeStyle = '#0B0C0E'; c.lineWidth = 2; c.stroke(); }
      c.restore();
    }

    function draw() {
      if (!cur || !tgt) return;
      ensureLayer();
      cvs.clear();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.restore();
      drawFlow(ctx, false);
      drawImpeller(ctx);
      drawFlow(ctx, true);
      drawAlerts(ctx);
      drawDynamicDrive(ctx);
    }
    function initial(d) {
      return { speed: d.speed, flow: d.flow, vSuc: d.vSuc, vDis: d.vDis, hs: clamp(d.Ds / 303 * 30, 14, 40), hd: clamp(d.D / 254 * 22, 10, 30), margin: d.margin, load: clamp(d.shaftKw / Math.max(d.motorKw, 1), 0, 1.2) };
    }
    function update(d) {
      tgt = d;
      var nv = initial(d);
      if (!cur) { cur = nv; cur.target = nv; } else cur.target = nv;
      if (reduced || !api.running()) {
        Object.keys(nv).forEach(function (k) { cur[k] = nv[k]; });
        if (reduced && !parts.length) for (var i = 0; i < 90; i++) step(1);
        if (cvs.cssW || cvs.resize()) draw();
      }
    }

    var api = loop(function (dt) { step(dt); draw(); });
    var baseStart = api.start;
    api.start = function () { cvs.resize(); layerKey = ''; if (reduced) { draw(); return; } baseStart(); };
    api.update = update;
    api.resize = function () { if (cvs.resize()) { layerKey = ''; draw(); } };
    api.bubbles = function () { return rings.length; };
    if (window.ResizeObserver) new ResizeObserver(function () { api.resize(); }).observe(cv);
    return api;
  }

  /* ------------------------------------------------------------------
     Mini impeller for the TBE operating strip
     ------------------------------------------------------------------ */
  function mini(cv, opts) {
    var cvs = setupCanvas(cv, 100, 100), ctx = cvs.ctx, phi = 0, w = 0.04, wt = 0.04, reduced = !!(opts && opts.reduced);
    function draw() {
      cvs.clear();
      ctx.beginPath(); ctx.arc(50, 50, 46, 0, TAU); ctx.fillStyle = steelR(ctx, 50, 50, 46); ctx.fill();
      ctx.beginPath(); ctx.arc(50, 50, 40, 0, TAU); ctx.fillStyle = '#0B0C0E'; ctx.fill();
      var beta = 25 * Math.PI / 180;
      for (var k = 0; k < 6; k++) {
        var th0 = phi + k * TAU / 6;
        ctx.beginPath();
        for (var i = 0; i <= 14; i++) { var r = 12 + 27 * i / 14, th = th0 - Math.log(r / 12) / Math.tan(beta); var x = 50 + r * Math.cos(th), y = 50 + r * Math.sin(th); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.strokeStyle = '#A9AEB6'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(50, 50, 12, 0, TAU); ctx.fillStyle = steelR(ctx, 50, 50, 12); ctx.fill();
      ctx.beginPath(); ctx.arc(50, 50, 3.5, 0, TAU); ctx.fillStyle = VERM; ctx.fill();
    }
    var api = loop(function (dt) { w = lerp(w, wt, 0.06 * dt); phi += w * dt; draw(); });
    var baseStart = api.start;
    api.start = function () { cvs.resize(); if (reduced) { draw(); return; } baseStart(); };
    api.update = function (omega) { wt = omega; if (reduced || !api.running()) { cvs.resize(); draw(); } };
    if (window.ResizeObserver) new ResizeObserver(function () { if (cvs.resize()) draw(); }).observe(cv);
    return api;
  }

  root.MyengTwin = { pump: pump, mini: mini };
})(window);
