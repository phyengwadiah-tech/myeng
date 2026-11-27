/*!
 * MYENG equipment twin renderer — REV 06
 * Draws a schematic cross-section of an end-suction centrifugal pump train
 * (suction → impeller → volute → discharge, shaft → motor → VFD) and animates it.
 * It performs no engineering math: every number it shows or reacts to is
 * computed by engine.js and passed in through update().
 */
(function (root) {
  'use strict';

  var C = { ink: '#111214', carbon: '#181A1E', hair: '#282B31', muted: '#8E9196', stone: '#F4F3EF', alu: '#E2E1DC', verm: '#E04619' };
  var TAU = Math.PI * 2;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function setupCanvas(cv, logicalW, logicalH) {
    var ctx = cv.getContext('2d');
    var o = { cv: cv, ctx: ctx, W: logicalW, H: logicalH, scale: 1, ox: 0, oy: 0, cssW: 0 };
    o.resize = function () {
      var r = cv.getBoundingClientRect();
      if (!r.width) return false;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      o.cssW = r.width;
      o.scale = Math.min(r.width / logicalW, r.height / logicalH);
      o.ox = (r.width - logicalW * o.scale) / 2; o.oy = (r.height - logicalH * o.scale) / 2;
      ctx.setTransform(dpr * o.scale, 0, 0, dpr * o.scale, dpr * o.ox, dpr * o.oy);
      return true;
    };
    o.clear = function () {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
    };
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

  function vanes(ctx, cx, cy, r1, r2, phi, n, width, stroke) {
    var beta = 25 * Math.PI / 180;
    for (var k = 0; k < n; k++) {
      var th0 = phi + k * TAU / n;
      ctx.beginPath();
      for (var i = 0; i <= 18; i++) {
        var r = r1 + (r2 - r1) * i / 18, th = th0 - Math.log(r / r1) / Math.tan(beta);
        var x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------
     Full pump-train twin (hydraulics tab)
     ------------------------------------------------------------------ */
  function pump(cv, opts) {
    var W = 1000, H = 440, cvs = setupCanvas(cv, W, H), ctx = cvs.ctx;
    var reduced = !!(opts && opts.reduced);
    var P = { x: 430, y: 250 };                 // pump centre (shaft axis)
    var R2 = 92, EYE = 28, VIN = 102, VOUT0 = 118, VOUT1 = 152;
    var D_Y = P.y - (VIN + VOUT1) / 2;           // discharge pipe centreline
    var tgt = null, cur = null, phi = 0, t = 0, parts = [], bubbles = [];

    function voutAt(a) { return VOUT0 + (VOUT1 - VOUT0) * (a / TAU); } // a: angle travelled from cutwater
    function defaults(d) {
      return {
        speed: d.speed, flow: d.flow, vSuc: d.vSuc, vDis: d.vDis, hs: clamp(d.Ds / 303 * 26, 12, 40), hd: clamp(d.D / 254 * 20, 9, 32),
        margin: d.margin, load: clamp(d.shaftKw / Math.max(d.motorKw, 1), 0, 1.2)
      };
    }
    function update(d) {
      tgt = d;
      var nv = defaults(d);
      if (!cur) cur = nv; else cur.target = nv;
      cur.target = nv;
      if (reduced || !api.running()) { snapCur(); draw(); }
    }
    function snapCur() { if (cur && cur.target) Object.keys(cur.target).forEach(function (k) { cur[k] = cur.target[k]; }); }

    function spawn(anywhere) {
      var p = { st: 0, o: Math.random() * 2 - 1, x: anywhere ? 20 + Math.random() * (P.x - 170) : 10 - Math.random() * 40, rho: 0, ch: Math.random() * TAU, a: 0, k: 0, life: 0 };
      if (anywhere && Math.random() < 0.45) { p.st = 4; p.x = P.x + Math.random() * (W - P.x); }
      return p;
    }
    function ensureParts() {
      var n = Math.round(clamp(50 + 230 * (cur.flow / 600), 40, 280));
      while (parts.length < n) parts.push(spawn(parts.length < n * 0.9 && !parts.ran));
      parts.ran = true;
      if (parts.length > n) parts.length = n;
    }
    function step(dt) {
      var c = cur, g = c.target || c;
      ['speed', 'flow', 'vSuc', 'vDis', 'hs', 'hd', 'margin', 'load'].forEach(function (k) { c[k] = lerp(c[k], g[k], 0.08 * dt); });
      var w = 0.075 * c.speed * dt;            // visual angular speed (rad/frame) ∝ N
      phi += w; t += dt;
      ensureParts();
      var vs = clamp(c.vSuc * 1.5, 0.35, 7) * dt, vd = clamp(c.vDis * 1.5, 0.35, 8) * dt;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.life += dt;
        if (p.st === 0) { p.x += vs; if (p.x >= P.x - VOUT1 - 6) { p.st = 1; p.k = 0; } }
        else if (p.st === 1) { p.k += 0.06 * dt; if (p.k >= 1) { p.st = 2; p.rho = 0; } }
        else if (p.st === 2) { p.rho += (0.018 + 0.03 * c.speed) * dt; if (p.rho >= 1) { p.st = 3; var ang = phi + p.ch - Math.log((EYE + (R2 - EYE)) / EYE) / Math.tan(25 * Math.PI / 180); p.a = ((ang + Math.PI / 2) % TAU + TAU) % TAU; } }
        else if (p.st === 3) { p.a += (vd / 120) * 0.9; if (p.a >= TAU) { p.st = 4; p.x = P.x; } }
        else if (p.st === 4) { p.x += vd; if (p.x > W + 10) parts[i] = spawn(false); }
      }
      // cavitation bubbles nucleate at the eye when margin < 1.0 m
      if (c.margin < 1) {
        var rate = clamp(1 - c.margin, 0.15, 1.6) * 0.9 * dt;
        while (Math.random() < rate && bubbles.length < 70) {
          rate -= 1;
          var a = Math.PI * (0.55 + Math.random() * 0.9), r = EYE * (0.7 + Math.random() * 1.3);
          bubbles.push({ x: P.x + r * Math.cos(a), y: P.y + r * Math.sin(a), life: 0, max: 22 + Math.random() * 24, rm: 1.6 + Math.random() * 3 });
        }
      }
      for (var b = bubbles.length - 1; b >= 0; b--) { bubbles[b].life += dt; bubbles[b].x += 0.15 * dt; if (bubbles[b].life >= bubbles[b].max) bubbles.splice(b, 1); }
    }

    function posOf(p) {
      var c = cur;
      if (p.st === 0) return [p.x, P.y + p.o * c.hs * 0.85, 1];
      if (p.st === 1) { var x0 = P.x - VOUT1 - 6, k = p.k; return [lerp(x0, P.x + p.o * EYE * 0.5, k), lerp(P.y + p.o * c.hs * 0.85, P.y + p.o * EYE * 0.6, k), 0.35]; }
      if (p.st === 2) { var r = EYE + (R2 - EYE) * p.rho, th = phi + p.ch - Math.log(r / EYE) / Math.tan(25 * Math.PI / 180) + 0.26; return [P.x + r * Math.cos(th), P.y + r * Math.sin(th), 0.9]; }
      if (p.st === 3) { var ro = voutAt(p.a), rr = lerp(VIN + 4, ro - 4, (p.o + 1) / 2), aa = p.a - Math.PI / 2; return [P.x + rr * Math.cos(aa), P.y + rr * Math.sin(aa), 0.9]; }
      var taper = clamp((p.x - P.x) / 70, 0, 1), hw = lerp((VOUT1 - VIN) / 2 - 3, c.hd * 0.85, taper);
      return [p.x, D_Y + p.o * hw, 1];
    }

    function label(txt, x, y, color, align, bg) {
      var fs = 11 / cvs.scale;
      ctx.font = '500 ' + fs.toFixed(1) + 'px "JetBrains Mono", monospace';
      ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
      if (bg) {
        var wd = ctx.measureText(txt).width, pad = 5 / cvs.scale, hh = fs + 8 / cvs.scale;
        var bx = align === 'right' ? x - wd - pad : align === 'center' ? x - wd / 2 - pad : x - pad;
        ctx.fillStyle = 'rgba(17,18,20,.92)'; ctx.fillRect(bx, y - hh / 2, wd + pad * 2, hh);
        ctx.strokeStyle = bg; ctx.lineWidth = 1 / cvs.scale; ctx.strokeRect(bx, y - hh / 2, wd + pad * 2, hh);
      }
      ctx.fillStyle = color; ctx.fillText(txt, x, y);
    }
    function pin(ax, ay, x, y, key, val, align, alert) {
      var col = alert ? C.verm : C.muted;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.strokeStyle = col; ctx.lineWidth = 1 / cvs.scale; ctx.stroke();
      ctx.beginPath(); ctx.arc(ax, ay, 2.6, 0, TAU); ctx.fillStyle = col; ctx.fill();
      var fs = 11 / cvs.scale, fv = 13 / cvs.scale;
      ctx.font = '500 ' + fs.toFixed(1) + 'px "JetBrains Mono", monospace'; var wk = ctx.measureText(key + '  ').width;
      ctx.font = '600 ' + fv.toFixed(1) + 'px "JetBrains Mono", monospace'; var wv = ctx.measureText(val).width;
      var wd = wk + wv, padx = 8 / cvs.scale, hh = fv + 12 / cvs.scale;
      var bx = align === 'right' ? x - wd - padx * 2 : align === 'center' ? x - wd / 2 - padx : x;
      var by = y + (y < ay ? -hh : 0);
      ctx.fillStyle = 'rgba(17,18,20,.94)'; ctx.fillRect(bx, by, wd + padx * 2, hh);
      ctx.strokeStyle = alert ? C.verm : C.hair; ctx.lineWidth = 1 / cvs.scale; ctx.strokeRect(bx, by, wd + padx * 2, hh);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = '500 ' + fs.toFixed(1) + 'px "JetBrains Mono", monospace'; ctx.fillStyle = alert ? C.stone : C.muted; ctx.fillText(key, bx + padx, by + hh / 2);
      ctx.font = '600 ' + fv.toFixed(1) + 'px "JetBrains Mono", monospace'; ctx.fillStyle = C.stone; ctx.fillText(val, bx + padx + wk, by + hh / 2);
    }
    function leader(x1, y1, x2, y2, color) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x1, y1, 2.5, 0, TAU); ctx.fillStyle = color; ctx.fill();
    }

    function draw() {
      if (!cur || !tgt) return;
      var c = cur, wide = cvs.cssW >= 640;
      cvs.clear();
      // drafting grid
      ctx.strokeStyle = 'rgba(40,43,49,.38)'; ctx.lineWidth = 1;
      for (var gx = 0; gx <= W; gx += 80) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (var gy = 0; gy <= H; gy += 80) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      // axis centreline
      ctx.setLineDash([18, 5, 3, 5]); ctx.strokeStyle = C.hair; ctx.beginPath(); ctx.moveTo(10, P.y); ctx.lineTo(W - 10, P.y); ctx.stroke(); ctx.setLineDash([]);

      // suction pipe
      var hs = c.hs, sx1 = P.x - VOUT1 - 6;
      ctx.fillStyle = 'rgba(24,26,30,.9)'; ctx.fillRect(0, P.y - hs - 6, sx1, (hs + 6) * 2);
      ctx.strokeStyle = C.alu; ctx.lineWidth = 1.3;
      [[-hs, -hs - 6], [hs, hs + 6]].forEach(function (yy) { ctx.beginPath(); ctx.moveTo(0, P.y + yy[0]); ctx.lineTo(sx1, P.y + yy[0]); ctx.stroke(); ctx.strokeStyle = C.muted; ctx.beginPath(); ctx.moveTo(0, P.y + yy[1]); ctx.lineTo(sx1, P.y + yy[1]); ctx.stroke(); ctx.strokeStyle = C.alu; });
      ctx.fillStyle = C.alu; ctx.fillRect(sx1 - 6, P.y - hs - 14, 6, (hs + 14) * 2); // flange

      // shaft, bearing frame, coupling, motor, VFD
      ctx.fillStyle = C.carbon; ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2;
      ctx.fillRect(P.x, P.y - 6, 240, 12); ctx.strokeRect(P.x, P.y - 6, 240, 12);
      ctx.fillRect(560, P.y - 30, 82, 60); ctx.strokeRect(560, P.y - 30, 82, 60);
      ctx.fillStyle = C.ink; ctx.fillRect(668, P.y - 18, 16, 36); ctx.strokeRect(668, P.y - 18, 16, 36);
      ctx.fillStyle = C.carbon; ctx.fillRect(690, P.y - 58, 170, 116); ctx.strokeStyle = C.alu; ctx.strokeRect(690, P.y - 58, 170, 116);
      ctx.strokeStyle = C.hair; for (var fx = 702; fx < 852; fx += 12) { ctx.beginPath(); ctx.moveTo(fx, P.y - 50); ctx.lineTo(fx, P.y + 50); ctx.stroke(); }
      ctx.fillStyle = C.ink; ctx.strokeStyle = C.muted; ctx.beginPath(); ctx.moveTo(860, P.y - 46); ctx.lineTo(884, P.y - 34); ctx.lineTo(884, P.y + 34); ctx.lineTo(860, P.y + 46); ctx.closePath(); ctx.fill(); ctx.stroke();
      // motor fan ticks rotate with speed
      ctx.save(); ctx.translate(872, P.y); for (var fb = 0; fb < 6; fb++) { var fa = phi * 0.6 + fb * TAU / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(fa) * 9, Math.sin(fa) * 26); ctx.strokeStyle = C.hair; ctx.stroke(); } ctx.restore();
      // VFD cabinet with load bar
      ctx.fillStyle = C.carbon; ctx.strokeStyle = C.alu; ctx.fillRect(910, P.y - 62, 78, 124); ctx.strokeRect(910, P.y - 62, 78, 124);
      ctx.fillStyle = C.ink; ctx.fillRect(920, P.y - 52, 58, 26);
      var lb = clamp(c.load, 0, 1);
      ctx.fillStyle = C.hair; ctx.fillRect(922, P.y + 40, 54, 6);
      ctx.fillStyle = c.load > 1 ? C.verm : C.stone; ctx.fillRect(922, P.y + 40, 54 * lb, 6);
      ctx.fillStyle = C.hair; for (var ln = 0; ln < 3; ln++) ctx.fillRect(922, P.y - 44 + ln * 7, 34 - ln * 8, 2);
      ctx.beginPath(); ctx.moveTo(884, P.y); ctx.lineTo(910, P.y); ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);

      // discharge pipe
      var hd = c.hd, dx0 = P.x, taperEnd = P.x + 70;
      ctx.fillStyle = 'rgba(24,26,30,.9)';
      ctx.beginPath(); ctx.moveTo(dx0, D_Y - (VOUT1 - VIN) / 2); ctx.lineTo(taperEnd, D_Y - hd); ctx.lineTo(W, D_Y - hd); ctx.lineTo(W, D_Y + hd); ctx.lineTo(taperEnd, D_Y + hd); ctx.lineTo(dx0, D_Y + (VOUT1 - VIN) / 2); ctx.closePath(); ctx.fill();
      var ero = tgt.erosion;
      var wallCol = ero ? 'rgba(224,70,25,' + (0.55 + 0.45 * Math.sin(t * 0.12)).toFixed(3) + ')' : C.alu;
      ctx.lineWidth = ero ? 2 : 1.3; ctx.strokeStyle = wallCol;
      ctx.beginPath(); ctx.moveTo(dx0, D_Y - (VOUT1 - VIN) / 2); ctx.lineTo(taperEnd, D_Y - hd); ctx.lineTo(W, D_Y - hd); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dx0, D_Y + (VOUT1 - VIN) / 2); ctx.lineTo(taperEnd, D_Y + hd); ctx.lineTo(W, D_Y + hd); ctx.stroke();
      ctx.lineWidth = 1; ctx.fillStyle = C.alu; ctx.fillRect(taperEnd, D_Y - hd - 8, 6, (hd + 8) * 2);

      // volute casing (spiral) and impeller
      ctx.beginPath();
      for (var a = 0; a <= TAU + 0.001; a += 0.05) { var rr = voutAt(a), aa = a - Math.PI / 2; var px = P.x + rr * Math.cos(aa), py = P.y + rr * Math.sin(aa); if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.lineTo(P.x, D_Y - (VOUT1 - VIN) / 2);
      ctx.fillStyle = 'rgba(24,26,30,.96)'; ctx.fill();
      ctx.strokeStyle = C.alu; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(P.x, P.y, VIN, 0, TAU); ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(P.x, P.y, R2 + 3, 0, TAU); ctx.fillStyle = C.carbon; ctx.fill(); ctx.strokeStyle = C.alu; ctx.lineWidth = 1.2; ctx.stroke();
      vanes(ctx, P.x, P.y, EYE, R2, phi, 6, 4.5, 'rgba(226,225,220,.74)');
      vanes(ctx, P.x, P.y, EYE, R2, phi, 6, 2.2, C.hair);
      ctx.beginPath(); ctx.arc(P.x, P.y, EYE, 0, TAU); ctx.fillStyle = C.ink; ctx.fill(); ctx.strokeStyle = C.muted; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(P.x, P.y, 11, 0, TAU); ctx.fillStyle = C.carbon; ctx.fill(); ctx.strokeStyle = C.alu; ctx.stroke();

      // streamlines (particles)
      for (var i = 0; i < parts.length; i++) {
        var q = posOf(parts[i]), fade = Math.min(1, parts[i].life / 12);
        ctx.fillStyle = 'rgba(226,225,220,' + (0.75 * q[2] * fade).toFixed(3) + ')';
        ctx.fillRect(q[0] - 1.6, q[1] - 0.7, 3.2, 1.4);
      }
      // cavitation micro-bubbles
      for (var b = 0; b < bubbles.length; b++) {
        var bb = bubbles[b], k = bb.life / bb.max, r = bb.rm * (k < 0.72 ? k / 0.72 : Math.max(0, (1 - k) / 0.28));
        ctx.beginPath(); ctx.arc(bb.x, bb.y, Math.max(0.3, r), 0, TAU);
        ctx.strokeStyle = 'rgba(224,70,25,' + (0.95 - 0.3 * k).toFixed(3) + ')'; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.fillStyle = 'rgba(224,70,25,.16)'; ctx.fill();
      }

      // four pinned readouts: rpm & VFD, flow, NPSH margin, discharge velocity
      if (wide) {
        var cavOn = c.margin < 1, eroOn = !!tgt.erosion;
        pin(P.x - EYE * 0.7, P.y + EYE * 0.7, 210, P.y + 128, cavOn ? 'CAVITATION ONSET · NPSH' : 'NPSH MARGIN', (tgt.margin >= 0 ? '+' : '') + tgt.margin.toFixed(2) + ' m', 'center', cavOn);
        pin(110, P.y - c.hs - 2, 110, P.y - c.hs - 34, 'FLOW Q', Math.round(tgt.flow).toLocaleString('en-US') + ' m³/h', 'left', false);
        pin(860, D_Y - c.hd, 860, D_Y - c.hd - 30, eroOn ? 'EROSION RISK · v' : 'DISCHARGE v', tgt.vDis.toFixed(2) + ' m/s', 'right', eroOn);
        pin(775, P.y + 58, 775, P.y + 96, 'SPEED', Math.round(tgt.rpm).toLocaleString('en-US') + ' rpm · VFD ' + tgt.speedPct + '%', 'center', false);
      }
    }

    var api = loop(function (dt) { step(dt); draw(); });
    var baseStart = api.start;
    api.start = function () { if (reduced) { draw(); return; } cvs.resize(); baseStart(); };
    api.update = update;
    api.resize = function () { if (cvs.resize()) draw(); };
    api.frame = function () { cvs.resize(); draw(); };
    api.bubbles = function () { return bubbles.length; };
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
      ctx.beginPath(); ctx.arc(50, 50, 46, 0, TAU); ctx.strokeStyle = C.hair; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(50, 50, 40, 0, TAU); ctx.fillStyle = C.carbon; ctx.fill(); ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.stroke();
      vanes(ctx, 50, 50, 12, 39, phi, 6, 3.4, 'rgba(226,225,220,.74)');
      ctx.beginPath(); ctx.arc(50, 50, 12, 0, TAU); ctx.fillStyle = C.ink; ctx.fill(); ctx.strokeStyle = C.muted; ctx.stroke();
      ctx.beginPath(); ctx.arc(50, 50, 4, 0, TAU); ctx.fillStyle = C.verm; ctx.fill();
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
