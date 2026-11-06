/* Swell engine: pure money maths for a salary + ABN + gig income mix.
   No DOM access here, so every function can be unit-tested in Node. */
var SwellEngine = (function () {
  'use strict';
  var Countries = typeof SwellCountries !== 'undefined' ? SwellCountries : require('./countries.js');
  function prof(state) { return Countries.get(state && state.settings && state.settings.country); }
  function taxOpts(state) { return state.settings || {}; }

  // ---- Australian rates, FY2026-27 (1 Jul 2026 – 30 Jun 2027) ----
  var RATES = {
    fy: '2026-27',
    fyStart: '2026-07-01',
    fyEnd: '2027-06-30',
    brackets: [ // [threshold, marginal rate above it]
      [0, 0],
      [18200, 0.15],
      [45000, 0.30],
      [135000, 0.37],
      [190000, 0.45]
    ],
    medicare: 0.02,
    medicareLowThreshold: 28011,   // single, levy shades in above this
    mlsTiers: [                    // single, no private hospital cover
      [0, 0],
      [105000, 0.01],
      [123000, 0.0125],
      [164000, 0.015]
    ],
    superGuarantee: 0.12,
    concessionalCap: 32500,
    gstThreshold: 75000,
    paygTriggerBusinessIncome: 4000,
    paygTriggerTaxPayable: 1000,
    keyDates: [
      { date: '2026-10-28', label: 'Q1 PAYG instalment / BAS due', kind: 'tax' },
      { date: '2026-10-31', label: 'FY25-26 tax return due (self-lodged)', kind: 'tax' },
      { date: '2027-02-28', label: 'Q2 PAYG instalment / BAS due', kind: 'tax' },
      { date: '2027-04-28', label: 'Q3 PAYG instalment / BAS due', kind: 'tax' },
      { date: '2027-06-15', label: 'Personal super contribution: send by mid-June so it lands before 30 June', kind: 'super' },
      { date: '2027-06-30', label: 'End of financial year', kind: 'tax' },
      { date: '2027-07-28', label: 'Q4 PAYG instalment / BAS due', kind: 'tax' }
    ]
  };

  // ---- helpers ----
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  // Dates are 'YYYY-MM-DD' strings handled as calendar dates (no time zone drift).
  function parseISO(s) {
    if (!s || typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCMonth() !== +m[2] - 1) return null; // rejects 2026-02-31
    return d;
  }
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function monthKey(s) { return typeof s === 'string' ? s.slice(0, 7) : ''; }
  function addMonths(key, n) {
    var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  }
  function daysBetween(a, b) { // b - a in whole days
    var da = parseISO(a), db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((db - da) / 86400000);
  }
  function daysInMonth(key) {
    var y = +key.slice(0, 4), m = +key.slice(5, 7);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function fyMonthKeys(state, today) { // the tax year's twelve months
    var out = [], k = monthKey(state ? yearFor(state, today).start : RATES.fyStart);
    for (var i = 0; i < 12; i++) out.push(addMonths(k, i));
    return out;
  }

  // ---- tax ----
  function incomeTax(taxable) {
    taxable = Math.max(0, num(taxable));
    var tax = 0, b = RATES.brackets;
    for (var i = 1; i < b.length; i++) {
      var lo = b[i][0], hi = i + 1 < b.length ? b[i + 1][0] : Infinity;
      if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * b[i][1];
    }
    return tax;
  }
  function lito(taxable) { // low income tax offset
    taxable = num(taxable);
    if (taxable <= 37500) return 700;
    if (taxable <= 45000) return 700 - (taxable - 37500) * 0.05;
    if (taxable <= 66667) return Math.max(0, 325 - (taxable - 45000) * 0.015);
    return 0;
  }
  function medicareLevy(taxable) {
    taxable = num(taxable);
    var lo = RATES.medicareLowThreshold, hi = lo * 1.25;
    if (taxable <= lo) return 0;
    if (taxable < hi) return Math.min((taxable - lo) * 0.10, taxable * RATES.medicare);
    return taxable * RATES.medicare;
  }
  function mls(taxable, hasPrivateHospital) {
    if (hasPrivateHospital) return 0;
    taxable = num(taxable);
    var rate = 0;
    RATES.mlsTiers.forEach(function (t) { if (taxable > t[0]) rate = t[1]; });
    return taxable * rate; // MLS applies to the whole income once over a tier
  }
  function totalTax(taxable, opts) {
    opts = opts || {};
    var t = Math.max(0, incomeTax(taxable) - lito(taxable));
    return t + medicareLevy(taxable) + mls(taxable, opts.privateHospital !== false);
  }
  function marginalRateAt(taxable) {
    var rate = 0;
    RATES.brackets.forEach(function (b) { if (taxable > b[0]) rate = b[1]; });
    return rate;
  }

  // Tax owed on side income = tax on (salary + side) minus tax already
  // covered by salary withholding (approximated as tax on salary alone).
  function sideIncomeTax(salaryGross, sideNet, opts) {
    salaryGross = Math.max(0, num(salaryGross));
    sideNet = Math.max(0, num(sideNet));
    var extra = totalTax(salaryGross + sideNet, opts) - totalTax(salaryGross, opts);
    return {
      tax: round2(extra),
      rate: sideNet > 0 ? extra / sideNet : marginalRateAt(salaryGross) + RATES.medicare
    };
  }

  function salaryNetMonthly(salaryGross, opts) {
    salaryGross = Math.max(0, num(salaryGross));
    return round2((salaryGross - totalTax(salaryGross, opts)) / 12);
  }

  // Country-aware versions: every deduction on a salary, and what side profit adds on top.
  function salaryDeductions(state, gross) { return prof(state).salary(Math.max(0, num(gross)), taxOpts(state)); }
  function salaryNet(state, gross) { gross = Math.max(0, num(gross)); return round2((gross - salaryDeductions(state, gross).total) / 12); }
  function sideCost(state, gross, side) {
    var P = prof(state), o = taxOpts(state);
    return Math.max(0, P.combined(gross, side, o) - P.salary(gross, o).total);
  }
  // Rate on the next 100 of side profit: tax, levies and contributions together.
  function marginalAt(state, gross, side) {
    return clamp((sideCost(state, gross, num(side) + 100) - sideCost(state, gross, side)) / 100, 0, 0.9);
  }
  // The tax year containing today. Rates stay those in the profile; once today passes them, offset > 0 flags it.
  function shiftYear(d, n) { return (+d.slice(0, 4) + n) + d.slice(4); }
  function yearFor(state, today) {
    var y = prof(state).year, n = 0;
    if (today && today > y.end) {
      n = +today.slice(0, 4) - +y.end.slice(0, 4);
      if (shiftYear(y.end, n) < today) n++;
    }
    return { start: shiftYear(y.start, n), end: shiftYear(y.end, n), offset: n, stale: n > 0 };
  }
  // The country's calendar for that year; rolled-forward dates that land on a weekend move to Monday.
  function keyDatesFor(state, today) {
    var n = yearFor(state, today).offset;
    return prof(state).keyDates.map(function (d) {
      var date = shiftYear(d.date, n);
      if (n > 0) {
        var day = parseISO(date), wd = day.getUTCDay();
        if (wd === 6 || wd === 0) date = toISO(new Date(day.getTime() + (wd === 6 ? 2 : 1) * 86400000));
      }
      return { date: date, key: d.key, kind: d.kind, instalment: d.instalment };
    });
  }
  function salesRate(state) { var P = prof(state); return P.salesTaxRate ? P.salesTaxRate(state.settings || {}) : P.salesTax.rate; }

  // Split one payment received into sales tax, tax, retirement and what's yours.
  function splitPayment(amount, p) {
    amount = Math.max(0, num(amount));
    p = p || {};
    var r = p.salesTaxRate != null ? clamp(num(p.salesTaxRate), 0, 0.5) : 0.10;
    var gst = p.gstRegistered ? amount * r / (1 + r) : 0;
    var exGst = amount - gst;
    var tax = exGst * clamp(num(p.taxRate), 0, 0.9);
    var sup = Math.min(exGst * clamp(num(p.superPct), 0, 0.5), exGst - tax); // never set aside more than the payment
    var gstR = round2(gst), taxR = round2(tax), supR = round2(sup);
    return {
      amount: round2(amount), gst: gstR, tax: taxR, super: supR,
      yours: round2(amount - gstR - taxR - supR), exGst: round2(exGst)
    };
  }

  // ---- state readers ----
  function streamById(state, id) {
    for (var i = 0; i < state.streams.length; i++) if (state.streams[i].id === id) return state.streams[i];
    return null;
  }
  function salaryGross(state) {
    return state.streams.reduce(function (s, x) {
      return s + (x.kind === 'salary' && x.active !== false ? num(x.annualGross) : 0);
    }, 0);
  }
  function variableStreams(state) {
    return state.streams.filter(function (x) { return x.kind !== 'salary' && x.active !== false; });
  }
  function isVariableEntry(state, e) {
    var s = streamById(state, e.streamId);
    return !!s && s.kind !== 'salary'; // pausing stops expected income, not the tax on money already earned
  }
  function inFY(dateStr, state, today) {
    var y = state ? yearFor(state, today) : { start: RATES.fyStart, end: RATES.fyEnd };
    return !!dateStr && dateStr >= y.start && dateStr <= y.end;
  }

  function entryStatus(e, today) {
    if (e.stage === 'paid') return 'paid';
    if (e.stage === 'pipeline') return 'pipeline';
    if (e.due && e.due < today) return 'overdue';
    return 'invoiced';
  }

  function billMonthly(b) {
    var a = num(b.amount);
    switch (b.freq) {
      case 'weekly': return a * 52 / 12;
      case 'fortnightly': return a * 26 / 12;
      case 'quarterly': return a / 3;
      case 'annual': return a / 12;
      default: return a;
    }
  }
  function monthlyNeeds(state) {
    var essentials = 0, rituals = 0;
    (state.bills || []).forEach(function (b) {
      if (b.category === 'ritual') rituals += billMonthly(b); else essentials += billMonthly(b);
    });
    var goals = (state.goals || []).reduce(function (s, g) {
      return s + (num(g.saved) < num(g.target) ? num(g.monthly) : 0);
    }, 0);
    return { essentials: round2(essentials), rituals: round2(rituals), goals: round2(goals),
      total: round2(essentials + rituals + goals) };
  }

  function gstOf(state, amount) {
    var r = salesRate(state);
    return state.settings.gstRegistered ? num(amount) * r / (1 + r) : 0;
  }

  // Projected side income (ex GST, net of expenses) for the whole FY:
  // actual paid so far + open invoices + each stream's expected monthly for remaining months.
  function projectedSideNet(state, today) {
    var paidYTD = 0, open = 0, s = state.settings, nowKey = monthKey(today), byMonth = {}, paidNow = 0;
    state.entries.forEach(function (e) {
      if (!isVariableEntry(state, e)) return;
      var ex = num(e.amount) - gstOf(state, e.amount);
      if (e.stage === 'paid' && inFY(e.paid, state, today)) {
        paidYTD += ex;
        if (monthKey(e.paid) === nowKey) paidNow += ex;
      } else if (e.stage === 'invoiced' && inFY(e.due || today, state, today)) {
        open += ex;
        var k = e.due && e.due > today ? monthKey(e.due) : nowKey;
        byMonth[k] = (byMonth[k] || 0) + ex;
      }
    });
    var expected = variableStreams(state).reduce(function (t, x) { return t + num(x.expectedMonthly); }, 0);
    var expectedEx = s.gstRegistered ? expected / (1 + salesRate(state)) : expected;
    // Expected income fills each remaining month only as far as logged work doesn't already cover it.
    var expectedRest = 0;
    fyMonthKeys(state, today).forEach(function (k) {
      if (k < nowKey) return;
      expectedRest += Math.max(0, expectedEx - (byMonth[k] || 0) - (k === nowKey ? paidNow : 0));
    });
    var gross = paidYTD + open + expectedRest;
    return {
      paidYTD: round2(paidYTD), open: round2(open),
      expectedRest: round2(expectedRest),
      gross: round2(gross),
      net: round2(Math.max(0, gross - num(s.businessExpenses)))
    };
  }

  function taxPlan(state, today) {
    var P = prof(state), o = taxOpts(state);
    var sal = salaryGross(state), proj = projectedSideNet(state, today);
    var sideTax = round2(sideCost(state, sal, proj.net));
    var effective = proj.net > 0 ? sideTax / proj.net : marginalAt(state, sal, 0);
    // Rate to reserve on each side payment (gross, before sales tax), so expenses lower it.
    var reserveRate = proj.gross > 0 ? sideTax / proj.gross : effective;
    var reserveTarget = 0;
    state.entries.forEach(function (e) {
      if (e.stage !== 'paid' || !inFY(e.paid, state, today) || !isVariableEntry(state, e)) return;
      var sp = splitPayment(e.amount, { gstRegistered: state.settings.gstRegistered, salesTaxRate: salesRate(state), taxRate: reserveRate });
      reserveTarget += sp.tax + sp.gst;
    });
    var paidToAto = num(state.balances.taxPaid);
    var needInVault = Math.max(0, reserveTarget - paidToAto);
    var shortfall = needInVault - num(state.balances.taxVault);
    var salDed = P.salary(sal, o);
    return {
      country: P.code,
      salaryGross: sal,
      projected: proj,
      sideTax: sideTax,
      effectiveRate: effective,
      reserveRate: reserveRate,
      marginalRate: marginalAt(state, sal, proj.net),
      salaryTax: round2(salDed.total),
      salarySocial: round2(salDed.social),
      totalTax: round2(P.combined(sal, proj.net, o)),
      vaultTarget: round2(needInVault),
      vaultShortfall: round2(shortfall),
      paygLikely: !!P.instalments.likely(sideTax, proj.net, { salaryTotal: salDed.total, settings: o }),
      instalmentsPerYear: P.instalments.perYear,
      quarterlyInstalment: round2(sideTax / P.instalments.perYear)
    };
  }

  // GST turnover: last 12 months of side income (incl. invoiced) plus a projection.
  function gstStatus(state, today) {
    var from = toISO(new Date(parseISO(today) - 365 * 86400000));
    var turnover = 0;
    state.entries.forEach(function (e) {
      if (!isVariableEntry(state, e) || e.stage === 'pipeline') return;
      var d = e.stage === 'paid' ? e.paid : (e.issued || e.due);
      if (d && d > from && d <= today) turnover += num(e.amount) - gstOf(state, e.amount);
    });
    var proj = projectedSideNet(state, today).gross;
    var st = prof(state).salesTax, line = st.threshold;
    if (!line) return { turnover: round2(turnover), projected: proj, threshold: 0, rate: 0, hardCap: null, level: 'none', pct: 0 };
    var level = state.settings.gstRegistered ? 'registered'
      : (turnover >= line || proj >= line) ? 'register'
      : (Math.max(turnover, proj) >= line * 0.8) ? 'approaching' : 'clear';
    return { turnover: round2(turnover), projected: proj, threshold: line, rate: salesRate(state), hardCap: st.hardCap || null, level: level,
      pct: clamp(Math.max(turnover, proj) / line, 0, 1.5) };
  }

  // Take-home (after GST + tax reserve + super) by month, from paid side income.
  function takeHomeByMonth(state, today, reserveRate) {
    var map = {};
    state.entries.forEach(function (e) {
      if (e.stage !== 'paid' || !e.paid || e.paid > today || !isVariableEntry(state, e)) return;
      var sp = splitPayment(e.amount, { gstRegistered: state.settings.gstRegistered, salesTaxRate: salesRate(state),
        taxRate: reserveRate, superPct: num(state.settings.superTopUpPct) / 100 });
      var k = monthKey(e.paid);
      map[k] = (map[k] || 0) + sp.yours;
    });
    return map;
  }

  // The steady amount of side income to pay yourself each month.
  function smoothedSide(state, today, reserveRate) {
    var map = takeHomeByMonth(state, today, reserveRate);
    var nowKey = monthKey(today), months = [];
    for (var i = 6; i >= 1; i--) {
      var k = addMonths(nowKey, -i);
      months.push({ key: k, value: round2(map[k] || 0) });
    }
    var withData = months.filter(function (m) { return m.value > 0; }).length;
    var values = months.map(function (m) { return m.value; });
    var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var lowHalf = sorted.slice(0, 3).reduce(function (a, b) { return a + b; }, 0) / 3;
    var method = state.settings.smoothing || 'steady';
    var amount;
    if (withData < 3) {
      // Not enough history: lean on stated expectations, discounted.
      var exp = variableStreams(state).reduce(function (t, x) { return t + num(x.expectedMonthly); }, 0);
      var sp = splitPayment(exp, { gstRegistered: state.settings.gstRegistered, salesTaxRate: salesRate(state), taxRate: reserveRate,
        superPct: num(state.settings.superTopUpPct) / 100 });
      amount = sp.yours * 0.7;
      method = 'estimate';
    } else if (method === 'average') amount = avg;
    else if (method === 'floor') amount = sorted[0];
    else amount = (avg + lowHalf) / 2; // 'steady': halfway between average and lean months
    // Business costs are paid out of side income, so they can't also be spent.
    amount = Math.max(0, amount - num(state.settings.businessExpenses) / 12);
    return { amount: round2(amount), months: months, average: round2(avg), lowHalf: round2(lowHalf),
      floor: round2(sorted[0]), method: method, historyMonths: withData };
  }

  // Average days late per client, from paid invoices with a due date.
  function clientLateness(state) {
    var by = Object.create(null);
    state.entries.forEach(function (e) {
      if (e.stage !== 'paid' || !e.due || !e.paid || !e.client) return;
      var late = Math.max(0, daysBetween(e.due, e.paid));
      (by[e.client] = by[e.client] || []).push(late);
    });
    var out = Object.create(null);
    Object.keys(by).forEach(function (c) {
      var a = by[c];
      out[c] = { avgLate: Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length), invoices: a.length };
    });
    return out;
  }

  // Expected landing date for an open invoice, shifted by that client's habit.
  function expectedLanding(e, lateness) {
    if (!e.due) return null;
    var d = parseISO(e.due); if (!d) return null;
    var late = lateness[e.client] ? lateness[e.client].avgLate : 0;
    return toISO(new Date(d.getTime() + late * 86400000));
  }

  // Month-by-month outlook for the reservoir: booked side income flows in, your
  // steady side pay (draw) flows out on the 1st. This month's draw is assumed taken
  // and money already paid this month is assumed already in the balance.
  function forecast(state, today, monthsAhead, reserveRate, draw) {
    monthsAhead = monthsAhead || 6;
    draw = Math.max(0, num(draw));
    var lateness = clientLateness(state), nowKey = monthKey(today);
    var opts = { gstRegistered: state.settings.gstRegistered, salesTaxRate: salesRate(state), taxRate: reserveRate,
      superPct: num(state.settings.superTopUpPct) / 100 };
    var rows = [];
    for (var i = 0; i < monthsAhead; i++) {
      rows.push({ key: addMonths(nowKey, i), paid: 0, confirmed: 0, likely: 0, draw: i === 0 && state.settings.lastDraw === nowKey ? 0 : draw });
    }
    function rowFor(k) { for (var j = 0; j < rows.length; j++) if (rows[j].key === k) return rows[j]; return null; }
    state.entries.forEach(function (e) {
      if (!isVariableEntry(state, e)) return;
      var yours = splitPayment(e.amount, opts).yours;
      if (e.stage === 'paid') {
        if (e.paid && monthKey(e.paid) === nowKey && e.paid <= today) rows[0].paid += yours;
      } else if (e.stage === 'invoiced') {
        var land = expectedLanding(e, lateness) || today;
        if (land < today) land = today; // overdue money is still coming, from now
        var r1 = rowFor(monthKey(land)); if (r1) r1.confirmed += yours;
      } else if (e.stage === 'pipeline') {
        var r2 = rowFor(monthKey(e.due && e.due > today ? e.due : today));
        if (r2) r2.likely += yours * clamp(num(e.probability) / 100, 0, 1);
      }
    });
    var bal = num(state.balances.reservoir) - num(state.balances.retHeld);
    var costs = num(state.settings.businessExpenses) / 12;
    rows.forEach(function (r, idx) {
      r.paid = round2(r.paid); r.confirmed = round2(r.confirmed); r.likely = round2(r.likely);
      r.inflow = round2(r.confirmed + r.likely);
      bal = bal + r.inflow - r.draw - (idx === 0 ? 0 : costs);
      r.reservoirEnd = round2(bal);
      var earned = r.inflow + (idx === 0 ? r.paid : 0);
      var ratio = draw > 0 ? earned / draw : (earned > 0 ? 2 : 1);
      r.mood = ratio < 0.8 ? 'lean' : ratio > 1.2 ? 'flow' : 'steady';
      r.bookingGap = idx === 0 ? 0 : round2(Math.max(0, draw + costs - r.inflow));
    });
    return rows;
  }

  function spentThisMonth(state, today) {
    var k = monthKey(today), t = { ritual: 0, everyday: 0 };
    (state.spends || []).forEach(function (s) {
      if (monthKey(s.date) !== k) return;
      if (s.kind === 'ritual') t.ritual += num(s.amount); else t.everyday += num(s.amount);
    });
    t.ritual = round2(t.ritual); t.everyday = round2(t.everyday);
    t.total = round2(t.ritual + t.everyday);
    return t;
  }

  // The headline: what's safe to spend for the rest of this month.
  function safeToSpend(state, today, plan) {
    plan = plan || taxPlan(state, today);
    var sal = salaryNet(state, plan.salaryGross);
    var smooth = smoothedSide(state, today, plan.reserveRate);
    var needs = monthlyNeeds(state);
    var paySelf = round2(sal + smooth.amount);
    var flexible = round2(paySelf - needs.essentials - needs.goals);
    var spent = spentThisMonth(state, today);
    var ritualBudget = Math.max(0, Math.min(needs.rituals, flexible));
    // Rituals have their own allowance; only ritual overspend eats into everyday money.
    var ritualOver = Math.max(0, spent.ritual - needs.rituals);
    var left = round2(flexible - needs.rituals - spent.everyday - ritualOver);
    var dim = daysInMonth(monthKey(today));
    var dayOfMonth = +today.slice(8, 10);
    var daysLeft = dim - dayOfMonth + 1;
    var weeksLeft = Math.max(1, daysLeft / 7);
    return {
      salaryNet: sal, sideSmoothed: smooth.amount, smoothing: smooth, paySelf: paySelf,
      needs: needs, flexible: flexible, spent: spent, left: left,
      perWeek: round2(Math.max(0, left) / weeksLeft), perDay: round2(Math.max(0, left) / daysLeft),
      daysLeft: daysLeft, ritualBudget: round2(ritualBudget),
      ritualLeft: round2(Math.max(0, needs.rituals - spent.ritual))
    };
  }

  // Buffer: how many months of side-income pay-outs the reservoir covers, and where any surplus goes.
  function reservoir(state, today, sts) {
    var bal = num(state.balances.reservoir), held = num(state.balances.retHeld);
    var avail = bal - held; // money earmarked for retirement isn't a buffer or a surplus
    var draw = sts.sideSmoothed > 0 ? sts.sideSmoothed : 0;
    var gapIfNoSide = Math.max(0, sts.needs.total - sts.salaryNet);
    var targetMonths = num(state.settings.bufferMonths) || 3;
    var target = round2(targetMonths * Math.max(draw, gapIfNoSide));
    var surplus = target > 0 ? round2(Math.max(0, avail - target)) : 0;
    var r = state.settings.flowRules || { future: 50, goals: 30, joy: 20 };
    var tot = num(r.future) + num(r.goals) + num(r.joy);
    if (!tot) { r = { future: 100, goals: 0, joy: 0 }; tot = 100; }
    return {
      balance: bal, held: round2(held), available: round2(avail), target: target, targetMonths: targetMonths,
      runwayMonths: draw > 0 ? round2(Math.max(0, avail) / draw) : null,
      hasSalary: sts.salaryNet > 0,
      salaryCoversEssentials: sts.salaryNet >= sts.needs.essentials,
      essentialsCoverPct: sts.needs.essentials > 0 ? clamp(sts.salaryNet / sts.needs.essentials, 0, 9) : 1,
      fillPct: target > 0 ? clamp(avail / target, 0, 1.5) : 1,
      surplus: surplus,
      split: {
        future: round2(surplus * num(r.future) / tot),
        goals: round2(surplus * num(r.goals) / tot),
        joy: round2(surplus - round2(surplus * num(r.future) / tot) - round2(surplus * num(r.goals) / tot))
      }
    };
  }

  function superPlan(state, today, plan) {
    var R = prof(state).retirement;
    var employer = R.employerRate ? R.used(plan.salaryGross) : 0;
    var topPct = num(state.settings.superTopUpPct) / 100;
    var personal = plan.projected.gross * topPct; // the same share every payment sets aside
    var counted = R.used(plan.salaryGross);
    var cap = R.capFor ? R.capFor(plan.salaryGross, plan.projected.net) : R.cap;
    var within = R.deductible ? Math.min(personal, Math.max(0, cap - counted)) : personal; // only this much earns relief
    return {
      employer: round2(employer), personalPlanned: round2(personal), cap: cap,
      alreadyCounted: round2(counted),
      room: round2(Math.max(0, cap - counted - personal)), overCap: R.deductible && counted + personal > cap + 0.5,
      missedIfNone: round2(plan.projected.net * (R.employerRate || 0)), // what an employer would have paid
      deductible: R.deductible,
      taxSaving: round2(R.saving(within, plan.marginalRate, plan.salaryGross, plan.projected.net, taxOpts(state)))
    };
  }

  // Everything coming up: tax dates, open invoices, bills (next 60 days).
  function upcoming(state, today, horizonDays) {
    horizonDays = horizonDays || 60;
    var end = toISO(new Date(parseISO(today).getTime() + horizonDays * 86400000));
    var items = [], lateness = clientLateness(state);
    keyDatesFor(state, today).forEach(function (d) {
      if (d.date >= today && d.date <= end) items.push({ date: d.date, key: d.key, label: d.label || d.key, kind: d.kind, instalment: !!d.instalment });
    });
    state.entries.forEach(function (e) {
      if (e.stage !== 'invoiced') return;
      var st = entryStatus(e, today);
      if (st === 'overdue') items.push({ date: today, label: (e.client || 'Invoice') + ' is ' + daysBetween(e.due, today) + ' days overdue', kind: 'overdue', amount: num(e.amount), id: e.id, client: e.client, days: daysBetween(e.due, today) });
      else if (e.due && e.due <= end) {
        var land = expectedLanding(e, lateness);
        items.push({ date: e.due, label: (e.client || 'Invoice') + ' due' + (land && land !== e.due ? ' (usually lands ' + daysBetween(e.due, land) + ' days late)' : ''), kind: 'invoice', amount: num(e.amount), id: e.id, client: e.client, late: land && land !== e.due ? daysBetween(e.due, land) : 0 });
      }
    });
    var k = monthKey(today);
    (state.bills || []).forEach(function (b) {
      if (!b.day || (b.freq !== 'monthly' && b.freq !== undefined)) return;
      for (var i = 0; i < 3; i++) {
        var mk = addMonths(k, i), day = Math.min(num(b.day), daysInMonth(mk));
        var ds = mk + '-' + String(day).padStart(2, '0');
        if (ds >= today && ds <= end) { items.push({ date: ds, label: b.name, client: b.name, kind: 'bill', amount: num(b.amount) }); break; }
      }
    });
    items.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return items;
  }

  function streamTotalsFY(state, today) {
    var out = Object.create(null);
    state.streams.forEach(function (s) { out[s.id] = 0; });
    state.entries.forEach(function (e) {
      if (e.stage === 'paid' && inFY(e.paid, state, today) && out[e.streamId] !== undefined) out[e.streamId] += num(e.amount);
    });
    Object.keys(out).forEach(function (k) { out[k] = round2(out[k]); });
    return out;
  }

  function validateState(st) {
    var errs = [];
    if (!st || typeof st !== 'object') return ['State is not an object'];
    ['streams', 'entries', 'bills', 'goals', 'spends'].forEach(function (k) {
      if (!Array.isArray(st[k])) errs.push(k + ' must be a list');
    });
    if (!st.settings || typeof st.settings !== 'object') errs.push('settings missing');
    if (!st.balances || typeof st.balances !== 'object') errs.push('balances missing');
    if (errs.length) return errs;
    st.entries.forEach(function (e, i) {
      if (!(num(e.amount) >= 0)) errs.push('entry ' + i + ' amount');
      if (['pipeline', 'invoiced', 'paid'].indexOf(e.stage) < 0) errs.push('entry ' + i + ' stage');
      if (e.stage === 'paid' && !parseISO(e.paid)) errs.push('entry ' + i + ' paid date');
    });
    return errs;
  }

  // Fill any missing fields so older or hand-edited saves still load.
  // Coerces every field to the type the planner expects, so restored or hand-edited
  // data can never crash a render or inject markup through a "number".
  function normalise(st) {
    st = st && typeof st === 'object' && !Array.isArray(st) ? st : {};
    var isObj = function (x) { return x && typeof x === 'object' && !Array.isArray(x); };
    var str = function (x) { return typeof x === 'string' ? x : x == null ? '' : String(x); };
    var date = function (x) { return parseISO(x) ? x : ''; };
    var pick = function (x, list, dflt) { return list.indexOf(x) >= 0 ? x : dflt; };
    ['streams', 'entries', 'bills', 'goals', 'spends'].forEach(function (k) {
      st[k] = Array.isArray(st[k]) ? st[k].filter(isObj) : [];
    });
    var seen = {};
    function id(x, p) { var v = str(x.id) || (p + Math.random().toString(36).slice(2, 9)); while (seen[v]) v += '_'; seen[v] = 1; return v; }
    st.streams.forEach(function (s) {
      s.id = id(s, 's'); s.name = str(s.name) || 'Income';
      s.kind = pick(s.kind, ['salary', 'abn', 'other'], 'abn');
      s.color = pick(s.color, ['ink', 'sea', 'sand', 'rose'], 'ink');
      s.annualGross = Math.max(0, num(s.annualGross)); s.expectedMonthly = Math.max(0, num(s.expectedMonthly));
      s.active = s.active !== false;
    });
    st.entries.forEach(function (e) {
      e.id = id(e, 'e'); e.streamId = str(e.streamId); e.client = str(e.client);
      e.amount = Math.max(0, num(e.amount)); e.stage = pick(e.stage, ['pipeline', 'invoiced', 'paid'], 'invoiced');
      e.issued = date(e.issued); e.due = date(e.due); e.paid = date(e.paid);
      if (e.stage === 'paid' && !e.paid) e.paid = e.due || e.issued || toISO(new Date());
      e.credit = isObj(e.credit) ? { res: num(e.credit.res), vault: num(e.credit.vault), ret: num(e.credit.ret) } : null;
      e.probability = clamp(num(e.probability != null ? e.probability : 70), 0, 100); e.vaulted = !!e.vaulted;
    });
    st.bills.forEach(function (b) {
      b.id = id(b, 'b'); b.name = str(b.name) || 'Bill'; b.amount = Math.max(0, num(b.amount));
      b.freq = pick(b.freq, ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'], 'monthly');
      b.category = pick(b.category, ['essential', 'ritual'], 'essential');
      b.day = num(b.day) >= 1 && num(b.day) <= 31 ? Math.round(num(b.day)) : null;
    });
    st.goals.forEach(function (g) {
      g.id = id(g, 'g'); g.name = str(g.name) || 'Goal';
      g.target = Math.max(0, num(g.target)); g.saved = Math.max(0, num(g.saved)); g.monthly = Math.max(0, num(g.monthly));
    });
    st.spends = st.spends.filter(function (p) { return parseISO(p.date); });
    st.spends.forEach(function (p) {
      p.id = id(p, 'p'); p.label = str(p.label); p.amount = Math.max(0, num(p.amount)); p.kind = pick(p.kind, ['ritual', 'everyday'], 'everyday');
    });
    var s0 = isObj(st.settings) ? st.settings : {}, fr = isObj(s0.flowRules) ? s0.flowRules : {};
    var country = pick(s0.country, Countries.codes, 'AU'), CP = Countries.get(country);
    st.settings = {
      country: country,
      currency: /^[A-Z]{3}$/.test(str(s0.currency)) ? str(s0.currency) : '',
      onboarded: !!s0.onboarded,
      toured: !!s0.toured,
      stepsHidden: !!s0.stepsHidden,
      balancesSet: !!s0.balancesSet,
      planName: str(s0.planName).trim().slice(0, 60),
      region: CP.regions ? pick(s0.region, CP.regions, CP.defaultRegion) : '',
      regionRate: clamp(num(s0.regionRate != null ? s0.regionRate : 5), 0, 15),
      lang: pick(s0.lang, ['en', 'de'], 'en'),
      churchTax: pick(String(s0.churchTax), ['none', '8', '9'], 'none'),
      hasChildren: !!s0.hasChildren,
      scotland: !!s0.scotland,
      gstRegistered: !!s0.gstRegistered && !!CP.salesTax.threshold,
      lastDraw: /^\d{4}-\d{2}$/.test(str(s0.lastDraw)) ? str(s0.lastDraw) : '',
      privateHospital: s0.privateHospital !== false,
      superTopUpPct: clamp(num(s0.superTopUpPct != null ? s0.superTopUpPct : 12), 0, 50),
      bufferMonths: clamp(Math.round(num(s0.bufferMonths)) || 3, 1, 24),
      smoothing: pick(s0.smoothing, ['steady', 'average', 'floor'], 'steady'),
      businessExpenses: Math.max(0, num(s0.businessExpenses)),
      flowRules: {
        future: clamp(num(fr.future != null ? fr.future : 50), 0, 100),
        goals: clamp(num(fr.goals != null ? fr.goals : 30), 0, 100),
        joy: clamp(num(fr.joy != null ? fr.joy : 20), 0, 100)
      }
    };
    var b0 = isObj(st.balances) ? st.balances : {};
    st.balances = { reservoir: num(b0.reservoir), taxVault: Math.max(0, num(b0.taxVault)), taxPaid: Math.max(0, num(b0.taxPaid)), retHeld: Math.max(0, num(b0.retHeld)), taxPaidYear: str(b0.taxPaidYear) };
    st.sample = !!st.sample;
    st.edited = !!st.edited;
    st.savedAt = typeof st.savedAt === 'string' ? st.savedAt : '';
    st.v = 1;
    return st;
  }

  function computeAll(state, today) {
    var plan = taxPlan(state, today);
    var sts = safeToSpend(state, today, plan);
    return {
      plan: plan, sts: sts,
      res: reservoir(state, today, sts),
      gst: gstStatus(state, today),
      sup: superPlan(state, today, plan),
      fc: forecast(state, today, 6, plan.reserveRate, sts.sideSmoothed),
      up: upcoming(state, today, 60),
      lateness: clientLateness(state),
      fyTotals: streamTotalsFY(state, today),
      country: prof(state)
    };
  }

  return {
    RATES: RATES, round2: round2, parseISO: parseISO, toISO: toISO, monthKey: monthKey, addMonths: addMonths,
    daysBetween: daysBetween, daysInMonth: daysInMonth, fyMonthKeys: fyMonthKeys,
    incomeTax: incomeTax, lito: lito, medicareLevy: medicareLevy, mls: mls, totalTax: totalTax,
    marginalRateAt: marginalRateAt, sideIncomeTax: sideIncomeTax, salaryNetMonthly: salaryNetMonthly,
    splitPayment: splitPayment, entryStatus: entryStatus, billMonthly: billMonthly, monthlyNeeds: monthlyNeeds,
    projectedSideNet: projectedSideNet, taxPlan: taxPlan, gstStatus: gstStatus, smoothedSide: smoothedSide,
    clientLateness: clientLateness, expectedLanding: expectedLanding, forecast: forecast,
    spentThisMonth: spentThisMonth, safeToSpend: safeToSpend, reservoir: reservoir, superPlan: superPlan,
    upcoming: upcoming, streamTotalsFY: streamTotalsFY, validateState: validateState, normalise: normalise,
    computeAll: computeAll, salaryGross: salaryGross, streamById: streamById,
    Countries: Countries, profile: prof, salaryNet: salaryNet, salaryDeductions: salaryDeductions, sideCost: sideCost,
    marginalAt: marginalAt, salesRate: salesRate, inFY: inFY, yearFor: yearFor, keyDatesFor: keyDatesFor
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SwellEngine;
