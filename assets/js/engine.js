/*!
 * MYENG deterministic engineering engine — REV 04
 * Pure functions only. No DOM, no network. Every number shown in the
 * Studio is produced here, so the formulas can be audited in one place.
 *
 * Units (unless noted):  Q m³/h · H m · ρ kg/m³ · μ cP (mPa·s) · D mm · ε mm
 *                        P kW · pressure kPa (abs) · money USD
 */
(function (root) {
  'use strict';

  var G = 9.81; // m/s², as used in P_h = ρgQH / 3.6e6

  /* ---------- Pump power ---------- */

  // Hydraulic (water) power, kW.  P_h = ρ g Q H / 3.6×10⁶
  function hydraulicPower(rho, Q, H) {
    return (rho * G * Q * H) / 3.6e6;
  }

  // Part-load efficiency from a parabolic η–Q characteristic through the origin
  // and the BEP:  η(Q) = η_BEP · r(2 − r),  r = Q / Q_BEP.
  // A standard first-order approximation; replace with the vendor curve when certified.
  function efficiencyAtFlow(etaBep, Q, Qbep) {
    if (!(Qbep > 0)) return etaBep;
    var r = Q / Qbep;
    var f = r * (2 - r);
    return etaBep * Math.max(f, 0.05);
  }

  // API 610 driver sizing: nameplate ≥ rated power × margin.
  function api610MotorMargin(Pshaft) {
    if (Pshaft < 22) return 1.25;
    if (Pshaft <= 55) return 1.15;
    return 1.10;
  }

  /* ---------- Pipe friction (Darcy–Weisbach) ---------- */

  // Darcy friction factor. Laminar 64/Re, turbulent Swamee–Jain (explicit Colebrook),
  // linear blend across the 2300–4000 transition.
  function frictionFactor(Re, relRough) {
    if (!(Re > 0)) return 0;
    if (Re < 2300) return 64 / Re;
    var sj = function (re) {
      var t = Math.log10(relRough / 3.7 + 5.74 / Math.pow(re, 0.9));
      return 0.25 / (t * t);
    };
    if (Re < 4000) {
      var fl = 64 / 2300, ft = sj(4000), w = (Re - 2300) / 1700;
      return fl + (ft - fl) * w;
    }
    return sj(Re);
  }

  // Head loss through a line:  h_f = (f·L/D + ΣK) · v² / 2g
  function pipeLoss(Q, p) {
    var D = p.D / 1000;                       // m
    var A = Math.PI * D * D / 4;              // m²
    var v = (Q / 3600) / A;                   // m/s
    var mu = p.mu / 1000;                     // Pa·s
    var Re = mu > 0 ? (p.rho * v * D) / mu : 0;
    var f = frictionFactor(Re, (p.eps / 1000) / D);
    var dyn = v * v / (2 * G);
    var hf = (f * p.L / D + p.K) * dyn;
    return { v: v, Re: Re, f: f, hf: hf, dyn: dyn };
  }

  function systemHead(Q, h) {
    return h.zStatic + pipeLoss(Q, { D: h.D, L: h.L, eps: h.eps, K: h.K, rho: h.rho, mu: h.mu }).hf;
  }

  /* ---------- Pump curve & affinity laws ---------- */

  // Quadratic H–Q through the rated duty (Qd, Hd) with shutoff head H0 = k·Hd.
  // At speed ratio s (Affinity: Q∝N, H∝N²):  H_s(Q) = s²·H0 − (H0 − Hd)(Q/Qd)²
  function pumpHead(Q, s, H0, Hd, Qd) {
    return s * s * H0 - (H0 - Hd) * Math.pow(Q / Qd, 2);
  }
  function pumpMaxFlow(s, H0, Hd, Qd) {
    return s * Qd * Math.sqrt(H0 / Math.max(H0 - Hd, 1e-6));
  }

  // Operating point = intersection of pump and system curves (bisection).
  function operatingPoint(s, H0, Hd, Qd, h) {
    var qMax = pumpMaxFlow(s, H0, Hd, Qd);
    var g = function (q) { return pumpHead(q, s, H0, Hd, Qd) - systemHead(q, h); };
    if (g(0) <= 0) return null;               // cannot overcome static head
    var lo = 0, hi = qMax;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (g(mid) > 0) lo = mid; else hi = mid;
    }
    var Q = (lo + hi) / 2;
    return { Q: Q, H: pumpHead(Q, s, H0, Hd, Qd) };
  }

  /* ---------- NPSH ---------- */

  // NPSHa = (P_surface − P_vapour)/(ρg) + z_s − h_f,suction
  function npshAvailable(Q, h) {
    var loss = pipeLoss(Q, { D: h.Ds, L: h.Ls, eps: h.eps, K: h.Ks, rho: h.rho, mu: h.mu });
    var head = ((h.Psurf - h.Pvap) * 1000) / (h.rho * G);
    return { npsha: head + h.zs - loss.hf, pressureHead: head, suctionLoss: loss.hf, vSuction: loss.v };
  }

  // NPSHr scaled from the rated value: NPSHr ∝ Q² (affinity-consistent first approximation).
  function npshRequired(npshrRated, Q, Qrated) {
    return npshrRated * Math.pow(Q / Qrated, 2);
  }

  /* ---------- API 610 material classes (simplified ordering) ---------- */

  var MATERIAL_CLASSES = ['I-1', 'I-2', 'S-1', 'S-3', 'S-4', 'S-5', 'S-6', 'S-8', 'C-6', 'A-7', 'A-8', 'D-1', 'D-2'];
  function materialRank(c) { return MATERIAL_CLASSES.indexOf(c); }

  /* ---------- Bid evaluation (TBE + TCO) ---------- */

  function evaluateBid(bid, duty, basis, npsha) {
    var Ph = hydraulicPower(basis.rho, duty.Q, duty.H);
    var eta = efficiencyAtFlow(bid.etaBep / 100, duty.Q, bid.qBep);
    var etaM = bid.etaMotor / 100;
    var Pshaft = Ph / eta;
    var Pin = Pshaft / etaM;                           // P_s = P_h / (η_pump · η_motor)
    var kWh = Pin * duty.hours;
    var energyYr = kWh * duty.tariff;
    var energyH = energyYr * duty.horizon;
    var maintH = bid.maint * duty.horizon;
    var tco = bid.capex + energyH + maintH;
    var co2 = kWh * basis.ef / 1000;                   // t/yr
    var ratio = duty.Q / bid.qBep;
    var margin = npsha - bid.npshr;
    var motorReq = Pshaft * api610MotorMargin(Pshaft);

    var dev = [];
    if (eta * 100 < basis.minEff) {
      dev.push({ sev: 'major', code: 'EFF', text: 'Efficiency at rated duty ' + (eta * 100).toFixed(1) + '% is below the ' + basis.minEff.toFixed(1) + '% project minimum.' });
    }
    if (ratio < 0.7 || ratio > 1.2) {
      dev.push({ sev: 'major', code: 'POR', text: 'Rated flow is ' + (ratio * 100).toFixed(0) + '% of BEP — outside the 70–120% preferred operating region.' });
    } else if (ratio < 0.8 || ratio > 1.1) {
      dev.push({ sev: 'minor', code: 'BEP', text: 'Rated flow is ' + (ratio * 100).toFixed(0) + '% of BEP — API 610 expects rated flow within 80–110% of BEP.' });
    }
    if (margin < 0) {
      dev.push({ sev: 'major', code: 'NPSH', text: 'NPSHr ' + bid.npshr.toFixed(1) + ' m exceeds NPSHa ' + npsha.toFixed(1) + ' m — cavitation expected.' });
    } else if (margin < 1.0) {
      dev.push({ sev: 'major', code: 'NPSH', text: 'NPSH margin ' + margin.toFixed(2) + ' m is below the 1.0 m minimum (NPSHa ' + npsha.toFixed(1) + ' m vs NPSHr ' + bid.npshr.toFixed(1) + ' m).' });
    }
    var rq = materialRank(basis.material), rb = materialRank(bid.material);
    if (rb < 0 || rb < rq) {
      dev.push({ sev: 'major', code: 'MAT', text: 'Material class ' + bid.material + ' offered; ' + basis.material + ' or better is specified for this service.' });
    }
    if (bid.mawp < basis.minMawp) {
      dev.push({ sev: 'major', code: 'MAWP', text: 'Casing MAWP ' + bid.mawp.toFixed(0) + ' bar(g) is below the ' + basis.minMawp.toFixed(0) + ' bar(g) API 610 minimum.' });
    }
    if (bid.motorKw < motorReq) {
      dev.push({ sev: 'major', code: 'DRV', text: 'Motor ' + bid.motorKw.toFixed(0) + ' kW is below the API 610 driver rating of ' + motorReq.toFixed(1) + ' kW (' + Math.round((api610MotorMargin(Pshaft) - 1) * 100) + '% over ' + Pshaft.toFixed(1) + ' kW shaft power).' });
    }
    if (bid.lead > basis.maxLead) {
      dev.push({ sev: 'commercial', code: 'LEAD', text: 'Lead time ' + bid.lead.toFixed(0) + ' weeks exceeds the ' + basis.maxLead.toFixed(0) + '-week schedule requirement.' });
    }
    var compliant = dev.every(function (d) { return d.sev !== 'major'; });

    return {
      Ph: Ph, eta: eta, Pshaft: Pshaft, Pin: Pin, kWh: kWh, energyYr: energyYr,
      energyH: energyH, maintH: maintH, tco: tco, co2: co2, ratio: ratio,
      npshMargin: margin, motorReq: motorReq, deviations: dev, compliant: compliant
    };
  }

  function evaluate(state) {
    var na = npshAvailable(state.duty.Q, Object.assign({}, state.hyd, { rho: state.basis.rho }));
    var res = state.bids.map(function (b) { return evaluateBid(b, state.duty, state.basis, na.npsha); });
    var cheapest = 0;
    res.forEach(function (r, i) { if (state.bids[i].capex < state.bids[cheapest].capex) cheapest = i; });
    var pool = res.map(function (r, i) { return i; }).filter(function (i) { return res[i].compliant; });
    var anyCompliant = pool.length > 0;
    if (!anyCompliant) pool = res.map(function (r, i) { return i; });
    var rec = pool.reduce(function (a, i) { return res[i].tco < res[a].tco ? i : a; }, pool[0]);
    res.forEach(function (r) { r.savingsVsCheapest = res[cheapest].tco - r.tco; });
    return { bids: res, recommended: rec, anyCompliant: anyCompliant, cheapest: cheapest, npsha: na };
  }

  /* ---------- Hydraulic study (VFD, throttling, NPSH at operating point) ---------- */

  function hydraulicStudy(state, bidIndex) {
    var d = state.duty, b = state.basis, h = Object.assign({}, state.hyd, { rho: b.rho });
    var bid = state.bids[bidIndex];
    var s = h.speed / 100;
    var H0 = d.H * h.shutoff;
    var op = operatingPoint(s, H0, d.H, d.Q, h);
    var opFull = operatingPoint(1, H0, d.H, d.Q, h);
    var etaM = bid.etaMotor / 100, etaV = h.vfdEff / 100;
    var out = { s: s, H0: H0, op: op, opFull: opFull, bid: bid, bidIndex: bidIndex };
    if (!op) { out.noFlow = true; return out; }

    var etaOp = efficiencyAtFlow(bid.etaBep / 100, op.Q, bid.qBep * s);
    var PhOp = hydraulicPower(b.rho, op.Q, op.H);
    var Pvfd = PhOp / (etaOp * etaM * etaV);

    // Same delivered flow by throttling at full speed: pump runs on its 100% curve.
    var Hthr = pumpHead(op.Q, 1, H0, d.H, d.Q);
    var etaThr = efficiencyAtFlow(bid.etaBep / 100, op.Q, bid.qBep);
    var Pthr = hydraulicPower(b.rho, op.Q, Hthr) / (etaThr * etaM);

    var dis = pipeLoss(op.Q, { D: h.D, L: h.L, eps: h.eps, K: h.K, rho: b.rho, mu: h.mu });
    var suc = npshAvailable(op.Q, h);
    var npshr = npshRequired(bid.npshr, op.Q, d.Q);
    var saveKw = Pthr - Pvfd;

    out.etaOp = etaOp; out.PhOp = PhOp; out.Pvfd = Pvfd; out.PshaftOp = PhOp / etaOp; out.Hthr = Hthr; out.Pthr = Pthr;
    out.saveKw = saveKw;
    out.saveUsd = saveKw * d.hours * d.tariff;
    out.saveCo2 = saveKw * d.hours * b.ef / 1000;
    out.vDis = dis.v; out.Re = dis.Re; out.f = dis.f; out.hf = dis.hf;
    out.vSuc = suc.vSuction; out.npsha = suc.npsha; out.npshr = npshr; out.npshMargin = suc.npsha - npshr;
    out.qBepS = bid.qBep * s;
    out.affinity = { Q: s, H: s * s, P: s * s * s };
    return out;
  }

  /* ---------- Impeller size estimate (twin labelling only) ---------- */

  // Outlet diameter from the head coefficient ψ = 2gH / u2²  (ψ ≈ 1.05 for radial impellers):
  // u2 = √(2gH/ψ),  D2 = 60·u2 / (π·n)  → mm.  An estimate, not vendor data.
  function impellerDiameterEst(H, rpm, psi) {
    psi = psi || 1.05;
    if (!(H > 0) || !(rpm > 0)) return 0;
    var u2 = Math.sqrt(2 * G * H / psi);
    return 60 * u2 / (Math.PI * rpm) * 1000;
  }

  /* ---------- Fleet ROI (pricing section) ---------- */

  // Pumps procured each year keep running for the rest of the 10-year window.
  function fleetSavings(o) {
    var eta0 = o.baseEff / 100, eta1 = (o.baseEff + o.delta) / 100;
    var kwPerPump = o.kw * (1 - eta0 / eta1);
    var pumpYears = 0;
    for (var y = 1; y <= o.years; y++) pumpYears += o.perYear * y;
    var kWh = kwPerPump * o.hours * pumpYears;
    return { kwPerPump: kwPerPump, pumpYears: pumpYears, kWh: kWh, usd: kWh * o.tariff, co2: kWh * o.ef / 1000 };
  }

  root.MyengEngine = {
    G: G, hydraulicPower: hydraulicPower, efficiencyAtFlow: efficiencyAtFlow, api610MotorMargin: api610MotorMargin,
    frictionFactor: frictionFactor, pipeLoss: pipeLoss, systemHead: systemHead, pumpHead: pumpHead,
    pumpMaxFlow: pumpMaxFlow, operatingPoint: operatingPoint, npshAvailable: npshAvailable,
    npshRequired: npshRequired, MATERIAL_CLASSES: MATERIAL_CLASSES, evaluateBid: evaluateBid,
    evaluate: evaluate, hydraulicStudy: hydraulicStudy, fleetSavings: fleetSavings, impellerDiameterEst: impellerDiameterEst
  };
})(typeof window !== 'undefined' ? window : globalThis);
