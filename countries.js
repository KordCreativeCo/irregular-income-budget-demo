/* Swell country profiles: each one knows its tax year, how a salary is taxed, how side
   profit stacks on top, its sales-tax line, its prepayment rhythm and its retirement rules.
   Pure maths, no DOM, so every profile can be unit-tested in Node. All amounts are annual. */
var SwellCountries = (function () {
  'use strict';

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function pos(v) { return Math.max(0, num(v)); }
  function band(x, lo, hi) { return Math.max(0, Math.min(x, hi) - lo); }
  function bracketTax(x, brackets) { // brackets: [[from, rate], ...] ascending
    var t = 0;
    for (var i = 0; i < brackets.length; i++) {
      var lo = brackets[i][0], hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
      t += band(x, lo, hi) * brackets[i][1];
    }
    return t;
  }

  // ---------------------------------------------------------------- Australia, FY2026-27
  var AU_BR = [[0, 0], [18200, 0.15], [45000, 0.30], [135000, 0.37], [190000, 0.45]];
  function auLito(x) {
    if (x <= 37500) return 700;
    if (x <= 45000) return 700 - (x - 37500) * 0.05;
    if (x <= 66667) return Math.max(0, 325 - (x - 45000) * 0.015);
    return 0;
  }
  function auMedicare(x) {
    var lo = 28011, hi = lo * 1.25;
    if (x <= lo) return 0;
    if (x < hi) return Math.min((x - lo) * 0.10, x * 0.02);
    return x * 0.02;
  }
  function auMls(x, s) {
    if (s.privateHospital !== false) return 0;
    var rate = x > 164000 ? 0.015 : x > 123000 ? 0.0125 : x > 105000 ? 0.01 : 0;
    return x * rate;
  }
  function auTotal(x, s) { x = pos(x); return Math.max(0, bracketTax(x, AU_BR) - auLito(x)) + auMedicare(x) + auMls(x, s || {}); }

  var AU = {
    code: 'AU', currency: 'AUD', locale: { en: 'en-AU', de: 'de-DE' },
    year: { start: '2026-07-01', end: '2027-06-30', label: '2026-27' },
    bands: [[0, 0, '0%'], [18200, 0.15, '15%'], [45000, 0.30, '30%'], [135000, 0.37, '37%'], [190000, 0.45, '45%']],
    bandsMax: 200000,
    salary: function (g, s) { var t = auTotal(g, s); return { tax: t, social: 0, total: t }; },
    combined: function (g, side, s) { return auTotal(pos(g) + pos(side), s); },
    salesTax: { rate: 0.10, threshold: 75000 },
    instalments: { perYear: 4, likely: function (tax, net) { return net >= 4000 && tax >= 1000; } },
    retirement: { employerRate: 0.12, cap: 32500, deductible: true,
      used: function (g) { return Math.min(pos(g), 270830) * 0.12; }, // SG stops at the maximum contribution base
      saving: function (personal, marginal) { return personal * Math.max(0, marginal - 0.15); } },
    settings: ['privateHospital'],
    keyDates: [
      { date: '2026-10-28', key: 'au_q1', kind: 'tax', instalment: true },
      { date: '2026-11-02', key: 'au_return', kind: 'tax' },
      { date: '2027-03-01', key: 'au_q2', kind: 'tax', instalment: true },
      { date: '2027-04-28', key: 'au_q3', kind: 'tax', instalment: true },
      { date: '2027-06-15', key: 'au_super', kind: 'super' },
      { date: '2027-06-30', key: 'au_eofy', kind: 'tax' },
      { date: '2027-07-28', key: 'au_q4', kind: 'tax', instalment: true }
    ]
  };

  // ---------------------------------------------------------------- Germany, 2026 (Steuerklasse I)
  // §32a EStG 2026: zvE and tax both rounded down to whole euros.
  function deEst(x) {
    x = Math.floor(pos(x));
    var t;
    if (x <= 12348) t = 0;
    else if (x <= 17799) { var y = (x - 12348) / 10000; t = (914.51 * y + 1400) * y; }
    else if (x <= 69878) { var z = (x - 17799) / 10000; t = (173.10 * z + 2397) * z + 1034.87; }
    else if (x <= 277825) t = 0.42 * x - 11135.63;
    else t = 0.45 * x - 19470.38;
    return Math.floor(t);
  }
  function deSoli(est) { return est <= 20350 ? 0 : Math.min(est * 0.055, (est - 20350) * 0.119); }
  // Employee social insurance; freelance side profit stays outside it while the job is the main one.
  function deSocial(g, s) {
    g = pos(g);
    var rv = Math.min(g, 101400), kv = Math.min(g, 69750);
    var pension = rv * 0.093, unemp = rv * 0.013, health = kv * (0.073 + 0.0145);
    var care = kv * (s.hasChildren ? 0.018 : 0.024);
    return { total: pension + unemp + health + care, deductible: pension + health * 0.96 + care };
  }
  // §46 EStG / §70 EStDV: side profit up to €410 is tax-free, then phased in up to €820.
  function deSideTaxable(p) { p = pos(p); return p <= 410 ? 0 : p < 820 ? 2 * p - 820 : p; }
  function deTax(g, side, s) {
    var soc = deSocial(g, s);
    var zve = Math.max(0, pos(g) - (g > 0 ? 1230 : 0) - 36 - soc.deductible + deSideTaxable(side));
    var church = s.churchTax === '8' ? 0.08 : s.churchTax === '9' ? 0.09 : 0;
    var est = deEst(zve);
    if (church) est = deEst(zve - est * church); // church tax paid is itself deductible (§10 EStG)
    return { tax: est + deSoli(est) + est * church, social: soc.total };
  }
  var DE = {
    code: 'DE', currency: 'EUR', locale: { en: 'en-IE', de: 'de-DE' },
    year: { start: '2026-01-01', end: '2026-12-31', label: '2026' },
    bands: [[0, 0, '0%'], [12348, 0.20, '14–42%'], [69878, 0.42, '42%'], [277825, 0.45, '45%']], // the 14–42% zone rises smoothly
    bandsMax: 160000,
    salary: function (g, s) { var r = deTax(g, 0, s || {}); return { tax: r.tax, social: r.social, total: r.tax + r.social }; },
    combined: function (g, side, s) { var r = deTax(g, side, s || {}); return r.tax + r.social; },
    // Kleinunternehmer (§19 UStG): over €25,000 net last year means 19% from this year; over €100,000 this year means at once.
    salesTax: { rate: 0.19, threshold: 25000, hardCap: 100000 },
    instalments: { perYear: 4, likely: function (tax) { return tax >= 400; } },
    retirement: { employerRate: 0, cap: 30826, deductible: true,
      // Statutory pension contributions (employee and employer) already count towards the Basisrente cap.
      used: function (g) { return Math.min(pos(g), 101400) * 0.186; },
      saving: function (personal, marginal) { return personal * marginal; } },
    settings: ['churchTax', 'hasChildren'],
    keyDates: [
      { date: '2026-03-10', key: 'de_vz', kind: 'tax', instalment: true },
      { date: '2026-06-10', key: 'de_vz', kind: 'tax', instalment: true },
      { date: '2026-07-31', key: 'de_return25', kind: 'tax' },
      { date: '2026-09-10', key: 'de_vz', kind: 'tax', instalment: true },
      { date: '2026-12-10', key: 'de_vz', kind: 'tax', instalment: true },
      { date: '2026-12-15', key: 'de_ruerup', kind: 'super' },
      { date: '2026-12-31', key: 'de_yearend', kind: 'tax' },
      { date: '2027-03-10', key: 'de_vz', kind: 'tax', instalment: true },
      { date: '2027-08-02', key: 'de_return26', kind: 'tax' }
    ]
  };

  // ---------------------------------------------------------------- United Kingdom, 2026/27
  // Bands apply to taxable income (after the personal allowance, which tapers away from £100,000).
  var GB_RUK = [[0, 0.20], [37700, 0.40], [125140, 0.45]];
  var GB_SCO = [[0, 0.19], [3967, 0.20], [16956, 0.21], [31092, 0.42], [62430, 0.45], [125140, 0.48]];
  function gbIncomeTax(income, s) {
    income = pos(income);
    var pa = Math.max(0, 12570 - Math.max(0, (income - 100000) / 2));
    return bracketTax(Math.max(0, income - pa), s.scotland ? GB_SCO : GB_RUK);
  }
  function gbClass1(g) { g = pos(g); return band(g, 12570, 50270) * 0.08 + Math.max(0, g - 50270) * 0.02; }
  function gbClass4(p) { p = pos(p); return band(p, 12570, 50270) * 0.06 + Math.max(0, p - 50270) * 0.02; }
  // Trading allowance: receipts up to £1,000 are tax-free; above that, deduct £1,000 or real expenses, whichever is more.
  function gbSide(p, s) { p = pos(p); var exp = pos(s && s.businessExpenses), receipts = p + exp; return receipts <= 1000 ? 0 : Math.max(0, receipts - Math.max(1000, exp)); }
  var GB = {
    code: 'GB', currency: 'GBP', locale: { en: 'en-GB', de: 'de-DE' },
    year: { start: '2026-04-06', end: '2027-04-05', label: '2026/27' },
    bands: [[0, 0, '0%'], [12570, 0.20, '20%'], [50270, 0.40, '40%'], [100000, 0.60, '60%'], [125140, 0.45, '45%']],
    bandsMax: 160000,
    salary: function (g, s) { s = s || {}; var t = gbIncomeTax(g, s), ni = gbClass1(g); return { tax: t, social: ni, total: t + ni }; },
    combined: function (g, side, s) { s = s || {}; var p = gbSide(side, s); return gbIncomeTax(pos(g) + p, s) + gbClass1(g) + gbClass4(p); },
    salesTax: { rate: 0.20, threshold: 90000 },
    // Payments on account: bill over £1,000 and under 80% of it collected at source.
    instalments: { perYear: 2, likely: function (tax, net, ctx) { var paye = ctx && ctx.salaryTotal || 0; return tax > 1000 && paye / (paye + tax) < 0.8; } },
    retirement: { employerRate: 0, cap: 60000, deductible: true,
      used: function () { return 0; },
      // Relief at source gives back income tax (not NI) at your top rates.
      saving: function (personal, marginal, g, side, s) {
        var inc = pos(g) + gbSide(side, s);
        return Math.max(0, gbIncomeTax(inc, s || {}) - gbIncomeTax(inc - pos(personal), s || {}));
      } },
    settings: ['scotland'],
    keyDates: [
      { date: '2026-07-31', key: 'gb_poa2_prev', kind: 'tax', instalment: true },
      { date: '2026-10-05', key: 'gb_register', kind: 'tax' },
      { date: '2027-01-31', key: 'gb_jan', kind: 'tax', instalment: true },
      { date: '2027-04-05', key: 'gb_yearend', kind: 'tax' },
      { date: '2027-04-05', key: 'gb_pension', kind: 'super' },
      { date: '2027-07-31', key: 'gb_poa2', kind: 'tax', instalment: true }
    ]
  };

  // ---------------------------------------------------------------- Austria, 2026
  // Salary is the annual gross across 14 payments; the 13th and 14th are taxed apart at 6%.
  var AT_BR = [[0, 0], [13539, 0.20], [21992, 0.30], [36458, 0.40], [70365, 0.48], [104859, 0.50], [1000000, 0.55]];
  function atTariff(x) { return bracketTax(pos(x), AT_BR); }
  function atSalaryParts(g) {
    g = pos(g);
    var month = g / 14, regular = month * 12, special = month * 2;
    var cut = month <= 2225 ? 0.0295 : month <= 2427 ? 0.0195 : month <= 2630 ? 0.0095 : 0; // lower unemployment share on low pay
    var svReg = Math.min(month, 6930) * 12 * (0.1807 - cut), svSpec = Math.min(special, 13860) * (0.1707 - cut);
    var specTax = Math.max(0, special - svSpec - 620) * 0.06;
    return { regularTaxable: Math.max(0, regular - svReg - (g > 0 ? 132 : 0)), sv: svReg + svSpec, specTax: specTax, vab: g > 0 ? 496 : 0 };
  }
  // Neue Selbständige: SVS once profit passes €6,613.20; contributions are business costs,
  // then the 15% Grundfreibetrag (on up to €33,000) and the €730 Veranlagungsfreibetrag apply.
  function atSide(g, p) {
    p = pos(p);
    var svs = 0;
    if (p > 6613.20) {
      var base = Math.min(p, Math.max(0, 97020 - Math.min(pos(g), 97020)));
      svs = base * (0.185 + 0.068 + 0.0153) + 155.40;
    }
    var profit = Math.max(0, p - svs);
    var taxable = profit - Math.min(profit, 33000) * 0.15;
    if (g > 0) taxable = taxable <= 730 ? 0 : taxable < 1460 ? 2 * taxable - 1460 : taxable;
    return { svs: svs, taxable: taxable };
  }
  function atTotal(g, side) {
    var sp = atSalaryParts(g), sd = atSide(g, side);
    var tax = Math.max(0, atTariff(sp.regularTaxable + sd.taxable) - sp.vab) + sp.specTax;
    return { tax: tax, social: sp.sv + sd.svs };
  }
  var AT = {
    code: 'AT', currency: 'EUR', locale: { en: 'en-IE', de: 'de-AT' },
    year: { start: '2026-01-01', end: '2026-12-31', label: '2026' },
    bands: [[0, 0, '0%'], [13539, 0.20, '20%'], [21992, 0.30, '30%'], [36458, 0.40, '40%'], [70365, 0.48, '48%'], [104859, 0.50, '50%']],
    bandsMax: 130000,
    salary: function (g) { var r = atTotal(g, 0); return { tax: r.tax, social: r.social, total: r.tax + r.social }; },
    combined: function (g, side) { var r = atTotal(g, side); return r.tax + r.social; },
    salesTax: { rate: 0.20, threshold: 55000 },
    instalments: { perYear: 4, likely: function (tax) { return tax >= 300; } },
    // Prämienbegünstigte Zukunftsvorsorge: no deduction, but a 4.25% state premium on up to €3,817.04.
    retirement: { employerRate: 0, cap: 3817.04, deductible: false,
      used: function () { return 0; },
      saving: function (personal) { return Math.min(pos(personal), 3817.04) * 0.0425; } },
    settings: [],
    keyDates: [
      { date: '2026-02-15', key: 'at_vz', kind: 'tax', instalment: true },
      { date: '2026-05-15', key: 'at_vz', kind: 'tax', instalment: true },
      { date: '2026-06-30', key: 'at_return25', kind: 'tax' },
      { date: '2026-08-15', key: 'at_vz', kind: 'tax', instalment: true },
      { date: '2026-11-16', key: 'at_vz', kind: 'tax', instalment: true },
      { date: '2026-12-31', key: 'at_yearend', kind: 'tax' },
      { date: '2027-02-15', key: 'at_vz', kind: 'tax', instalment: true },
      { date: '2027-06-30', key: 'at_return26', kind: 'tax' }
    ]
  };

  // ---------------------------------------------------------------- United States, 2026 (single filer)
  // Federal: Rev. Proc. 2025-32. Side profit adds self-employment tax, half of which is deductible,
  // and earns the 20% QBI deduction. States from the most recent published tables (CA uses 2025).
  var US_FED = [[0, 0.10], [12400, 0.12], [50400, 0.22], [105700, 0.24], [201775, 0.32], [256225, 0.35], [640600, 0.37]];
  var US_STATES = {
    CA: { std: 5706, credit: 153, br: [[0, 0.01], [11079, 0.02], [26264, 0.04], [41452, 0.06], [57542, 0.08], [72724, 0.093], [371479, 0.103], [445771, 0.113], [742953, 0.123], [1000000, 0.133]], levy: function (g) { return g * 0.013; } },
    NY: { std: 8000, levy: function (g) { return Math.min(g * 0.00432, 411.91); }, br: [[0, 0.039], [8500, 0.044], [11700, 0.0515], [13900, 0.054], [80650, 0.059], [215400, 0.0685], [1077550, 0.0965], [5000000, 0.103], [25000000, 0.109]] },
    IL: { std: 2850, br: [[0, 0.0495]] },
    MA: { std: 4400, levy: function (g) { return Math.min(g, 184500) * 0.0046; }, br: [[0, 0.05], [1107750, 0.09]] },
    TX: { br: [] }, FL: { br: [] },
    WA: { br: [], levy: function (g) { return Math.min(g, 184500) * 0.00807 + g * 0.0058; } }
  };
  function usFica(g) { g = pos(g); return Math.min(g, 184500) * 0.062 + g * 0.0145 + Math.max(0, g - 200000) * 0.009; }
  function usSe(g, p) {
    var base = pos(p) * 0.9235;
    if (base < 400) return { tax: 0, half: 0 };
    var ss = Math.min(base, Math.max(0, 184500 - pos(g))) * 0.124, med = base * 0.029;
    var addl = Math.max(0, base - Math.max(0, 200000 - pos(g))) * 0.009;
    return { tax: ss + med + addl, half: (ss + med) / 2 };
  }
  function usState(agi, g, s) {
    var code = s.region || 'CA';
    if (code === 'OTHER') return Math.max(0, agi - 16100) * pos(s.regionRate) / 100;
    var st = US_STATES[code] || US_STATES.CA;
    var tax = st.br.length ? Math.max(0, bracketTax(Math.max(0, agi - (st.std || 0)), st.br) - (st.credit || 0)) : 0;
    if (code === 'NY' && agi > 107650) { // benefit recapture: lower brackets phase out at high incomes
      var ti = Math.max(0, agi - 8000), step = 568.25;
      tax += ti <= 215400 ? Math.min(1, (agi - 107650) / 50000) * Math.max(0, 0.059 * ti - tax)
        : step + Math.min(1, Math.max(0, agi - 215400) / 50000) * Math.max(0, 0.0685 * ti - tax - step);
    }
    if (st.levy) tax += st.levy(pos(g));
    return tax;
  }
  // extraDeduction: a deductible retirement contribution (lowers income tax, not SE tax).
  function usParts(g, p, s, extraDeduction) {
    g = pos(g); p = pos(p); s = s || {};
    var se = usSe(g, p);
    var agi = g + p - se.half - pos(extraDeduction);
    var pre = Math.max(0, agi - 16100);
    var qbi = Math.max(0, p - se.half - pos(extraDeduction));
    var qbiDed = 0.2 * Math.min(qbi, pre) * (1 - Math.min(1, Math.max(0, pre - 201750) / 75000)); // treated as a service business above the threshold
    var fed = bracketTax(Math.max(0, pre - qbiDed), US_FED);
    return { income: fed + usState(agi, g, s), payroll: usFica(g) + se.tax };
  }
  var US = {
    code: 'US', currency: 'USD', locale: { en: 'en-US', de: 'de-DE' },
    year: { start: '2026-01-01', end: '2026-12-31', label: '2026' },
    bands: [[0, 0, '0%'], [16100, 0.10, '10%'], [28500, 0.12, '12%'], [66500, 0.22, '22%'], [121800, 0.24, '24%'], [217875, 0.32, '32%']],
    bandsMax: 200000,
    regions: ['CA', 'NY', 'TX', 'FL', 'WA', 'IL', 'MA', 'OTHER'], defaultRegion: 'CA',
    salary: function (g, s) { var r = usParts(g, 0, s, 0); return { tax: r.income, social: r.payroll, total: r.income + r.payroll }; },
    combined: function (g, side, s) { var r = usParts(g, side, s, 0); return r.income + r.payroll; },
    salesTax: { rate: 0, threshold: 0 }, // no VAT; design services are generally outside state sales tax
    instalments: { perYear: 4, likely: function (tax) { return tax >= 1000; } },
    // SEP-IRA: up to 20% of net self-employment earnings, $72,000 cap; it lowers income tax, not SE tax.
    retirement: { employerRate: 0, cap: 72000, deductible: true,
      used: function () { return 0; },
      capFor: function (g, side) { return Math.min(72000, 0.2 * Math.max(0, pos(side) - usSe(g, side).half)); },
      saving: function (personal, marginal, g, side, s) {
        return Math.max(0, usParts(g, side, s, 0).income - usParts(g, side, s, personal).income);
      } },
    settings: [],
    keyDates: [
      { date: '2026-04-15', key: 'us_apr', kind: 'tax', instalment: true },
      { date: '2026-06-15', key: 'us_q2', kind: 'tax', instalment: true },
      { date: '2026-09-15', key: 'us_q3', kind: 'tax', instalment: true },
      { date: '2026-12-31', key: 'us_solo', kind: 'super' },
      { date: '2027-01-15', key: 'us_q4', kind: 'tax', instalment: true },
      { date: '2027-04-15', key: 'us_return', kind: 'tax' }
    ]
  };

  // ---------------------------------------------------------------- Canada, 2026 (single)
  // Federal 14% bottom rate; CPP/QPP and EI on salary; side profit pays both CPP halves only on
  // whatever room the salary leaves below the YMPE/YAMPE. Provinces from the 2026 CRA tables.
  var CA_FED = [[0, 0.14], [58523, 0.205], [117045, 0.26], [181440, 0.29], [258482, 0.33]];
  var CA_PROV = {
    ON: { br: [[0, 0.0505], [53891, 0.0915], [107785, 0.1116], [150000, 0.1216], [220000, 0.1316]], bpa: 12989, credit: 0.0505, vat: 0.13 },
    BC: { br: [[0, 0.056], [50363, 0.077], [100728, 0.105], [115648, 0.1229], [140430, 0.147], [190405, 0.168], [265545, 0.205]], bpa: 13216, credit: 0.056, vat: 0.05 },
    AB: { br: [[0, 0.08], [61200, 0.10], [154259, 0.12], [185111, 0.13], [246813, 0.14], [370220, 0.15]], bpa: 22769, credit: 0.08, vat: 0.05 },
    QC: { br: [[0, 0.14], [54345, 0.19], [108680, 0.24], [132245, 0.2575]], bpa: 18952, credit: 0.14, vat: 0.14975 }
  };
  function caOhp(x) { // Ontario Health Premium on taxable income
    if (x <= 20000) return 0;
    if (x <= 36000) return Math.min(300, (x - 20000) * 0.06);
    if (x <= 48000) return Math.min(450, 300 + (x - 36000) * 0.06);
    if (x <= 72000) return Math.min(600, 450 + (x - 48000) * 0.25);
    if (x <= 200000) return Math.min(750, 600 + (x - 72000) * 0.25);
    return Math.min(900, 750 + (x - 200000) * 0.25);
  }
  function caParts(g, p, s, extraDeduction) {
    g = pos(g); p = pos(p); s = s || {};
    var qc = s.region === 'QC';
    var rate = qc ? 0.063 : 0.0595, baseRate = qc ? 0.053 : 0.0495;
    // Salary: pension plan, second tier, EI (and QPIP in Québec).
    var contrib = band(g, 3500, 74600), cpp2 = band(g, 74600, 85000) * 0.04;
    var cpp = contrib * rate, cppBase = contrib * baseRate, cppAdd = contrib * 0.01;
    var ei = Math.min(g, 68900) * (qc ? 0.013 : 0.0163), qpip = qc ? Math.min(g, 103000) * 0.0043 : 0;
    // Side profit: both halves, only on the room the salary leaves.
    var seContrib = Math.max(0, Math.min(g + p, 74600) - Math.max(g, 3500));
    var seCpp = seContrib * rate * 2, seCpp2 = (band(g + p, 74600, 85000) - band(g, 74600, 85000)) * 0.08;
    var seQpip = qc ? Math.max(0, Math.min(g + p, 103000) - g) * 0.00878 : 0;
    var seDeduct = seContrib * (rate + 0.01) + seCpp2 + seQpip * 0.4;
    var taxable = Math.max(0, g + p - cppAdd - cpp2 - seDeduct - pos(extraDeduction));
    var credits = cppBase + seContrib * baseRate + ei + qpip;
    // Federal: BPA shrinks between $181,440 and $258,482 of net income.
    var bpa = 16452 - 1623 * Math.min(1, Math.max(0, taxable - 181440) / 77042);
    var fed = Math.max(0, bracketTax(taxable, CA_FED) - 0.14 * (bpa + Math.min(1501, g) + credits));
    if (qc) fed *= 1 - 0.165; // Québec abatement
    var prov;
    if (s.region === 'OTHER') prov = taxable * pos(s.regionRate) / 100;
    else {
      var P = CA_PROV[s.region] || CA_PROV.ON;
      prov = Math.max(0, bracketTax(taxable, P.br) - P.credit * (P.bpa + (qc ? 0 : credits)));
      if (!s.region || s.region === 'ON') prov += 0.20 * Math.max(0, prov - 5818) + 0.36 * Math.max(0, prov - 7446) + caOhp(taxable);
      if (qc && p > 0) prov += Math.min(1000, Math.max(0, p - 17500) * 0.01); // Health Services Fund on side profit (estimate)
    }
    return { income: fed + prov, payroll: cpp + cpp2 + ei + qpip + seCpp + seCpp2 + seQpip, taxable: taxable, fed: fed, prov: prov };
  }
  var CA = {
    code: 'CA', currency: 'CAD', locale: { en: 'en-CA', de: 'de-DE' },
    year: { start: '2026-01-01', end: '2026-12-31', label: '2026' },
    bands: [[0, 0, '0%'], [16452, 0.14, '14%'], [58523, 0.205, '20.5%'], [117045, 0.26, '26%'], [181440, 0.29, '29%']],
    bandsMax: 200000,
    regions: ['ON', 'BC', 'AB', 'QC', 'OTHER'], defaultRegion: 'ON',
    salary: function (g, s) { var r = caParts(g, 0, s, 0); return { tax: r.income, social: r.payroll, total: r.income + r.payroll }; },
    combined: function (g, side, s) { var r = caParts(g, side, s, 0); return r.income + r.payroll; },
    // Small supplier: $30,000 over four quarters; GST 5%, HST 13% in Ontario, GST + QST in Québec.
    salesTax: { rate: 0.13, threshold: 30000, metaRate: '5–15%' },
    salesTaxRate: function (s) { var P = CA_PROV[s && s.region]; return P ? P.vat : s && s.region === 'OTHER' ? 0.05 : 0.13; },
    instalments: { perYear: 4, likely: function (tax, net, ctx) { return tax > (ctx && ctx.settings && ctx.settings.region === 'QC' ? 1800 : 3000); } },
    // RRSP: 18% of last year's earned income up to $33,810; deductible against income tax only.
    retirement: { employerRate: 0, cap: 33810, deductible: true,
      used: function () { return 0; },
      capFor: function (g, side) { return Math.min(33810, 0.18 * (pos(g) + pos(side))); },
      saving: function (personal, marginal, g, side, s) {
        return Math.max(0, caParts(g, side, s, 0).income - caParts(g, side, s, personal).income);
      } },
    settings: [],
    keyDates: [
      { date: '2026-03-16', key: 'ca_inst', kind: 'tax', instalment: true },
      { date: '2026-04-30', key: 'ca_balance25', kind: 'tax' },
      { date: '2026-06-15', key: 'ca_inst', kind: 'tax', instalment: true },
      { date: '2026-06-15', key: 'ca_file25', kind: 'tax' },
      { date: '2026-09-15', key: 'ca_inst', kind: 'tax', instalment: true },
      { date: '2026-12-15', key: 'ca_inst', kind: 'tax', instalment: true },
      { date: '2027-03-01', key: 'ca_rrsp', kind: 'super' },
      { date: '2027-03-15', key: 'ca_inst', kind: 'tax', instalment: true },
      { date: '2027-04-30', key: 'ca_balance26', kind: 'tax' }
    ]
  };

  var list = { AU: AU, DE: DE, AT: AT, GB: GB, US: US, CA: CA };
  function get(code) { return list[code] || AU; }
  return { AU: AU, DE: DE, AT: AT, GB: GB, US: US, CA: CA, list: list, get: get, codes: ['AU', 'US', 'CA', 'GB', 'DE', 'AT'],
    _: { deEst: deEst, deSoli: deSoli, bracketTax: bracketTax, auTotal: auTotal, gbIncomeTax: gbIncomeTax, gbClass1: gbClass1, gbClass4: gbClass4,
      atTariff: atTariff, atSide: atSide, atTotal: atTotal, usParts: usParts, usSe: usSe, usFica: usFica, caParts: caParts, caOhp: caOhp } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SwellCountries;
