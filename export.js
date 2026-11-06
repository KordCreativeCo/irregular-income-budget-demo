/* Spreadsheet export: turns the planner into sheets, then a CSV or a real .xlsx workbook.
   No dependencies and no DOM, so every byte can be tested in Node.
   A cell is a string, a number, null, or { d: 'YYYY-MM-DD' } / { p: 0.35 } / { h: 'Header' }. */
var SwellExport = (function () {
  'use strict';

  // ---------- the planner as sheets ----------
  function buildSheets(state, c, o) {
    var t = o.t, E = o.E, today = o.today, s = c.sts, res = c.res, p = c.plan;
    var D = function (iso) { return iso ? { d: iso } : null; };
    var H = function (keys) { return keys.map(function (k) { return { h: t('xp.' + k) }; }); };
    var kind = function (k) { return t('kind.' + k); };
    var stream = function (id) { var x = E.streamById(state, id); return x ? x.name : ''; };

    var summary = [H(['item', 'value'])].concat([
      ['budget', o.name], ['country', t('country.' + o.country)], ['year', t('term.YEAR')], ['currency', o.currency], ['exported', D(today)],
      ['salaryNet', s.salaryNet], ['sidePay', s.sideSmoothed], ['monthlyPay', s.paySelf], ['leftMonth', s.left], ['perWeek', s.perWeek],
      ['reserveRate', { p: p.reserveRate }], ['sideProfit', p.projected.net], ['sideTax', p.sideTax],
      ['reservoir', res.balance], ['heldRetirement', res.held], ['bufferTarget', res.target], ['surplus', res.surplus],
      ['vault', state.balances.taxVault], ['owed', p.vaultTarget], ['taxPaid', state.balances.taxPaid],
      ['essentials', s.needs.essentials], ['rituals', s.needs.rituals], ['goals', s.needs.goals]
    ].map(function (r) { return [t('xp.' + r[0]), r[1]]; }));

    var streams = [H(['name', 'type', 'grossYear', 'expectedMonth', 'paidYear', 'active'])].concat(state.streams.map(function (x) {
      return [x.name, kind(x.kind), x.kind === 'salary' ? x.annualGross : null, x.kind === 'salary' ? null : x.expectedMonthly, x.kind === 'salary' ? null : c.fyTotals[x.id] || 0, x.active === false ? t('xp.no') : t('xp.yes')];
    }));

    var work = state.entries.slice().sort(function (a, b) { return (a.paid || a.due || '') < (b.paid || b.due || '') ? -1 : 1; });
    var invoices = [H(['client', 'stream', 'status', 'amount', 'yours', 'chance', 'issued', 'due', 'paid'])].concat(work.map(function (e) {
      return [e.client, stream(e.streamId), t('stage.' + E.entryStatus(e, today)), e.amount, E.splitPayment(e.amount, o.split).yours, e.stage === 'pipeline' ? { p: e.probability / 100 } : null, D(e.issued), D(e.due), D(e.paid)];
    }));

    var bills = [H(['name', 'category', 'amount', 'frequency', 'perMonth', 'day'])].concat(state.bills.map(function (b) {
      return [b.name, t('cat.' + b.category), b.amount, t('freq.' + b.freq), E.round2(E.billMonthly(b)), b.day && b.freq === 'monthly' ? b.day : null];
    }));

    var goals = [H(['name', 'target', 'saved', 'perMonth'])].concat(state.goals.map(function (g) { return [g.name, g.target, g.saved, g.monthly]; }));

    var spending = [H(['date', 'what', 'category', 'amount'])].concat(state.spends.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (x) {
      return [D(x.date), x.label, t('cat.' + (x.kind === 'ritual' ? 'ritual' : 'everyday')), x.amount];
    }));

    var forecast = [H(['month', 'booked', 'likely', 'draw', 'reservoirEnd', 'toBook', 'outlook'])].concat(c.fc.map(function (r) {
      return [r.key, r.paid + r.confirmed, r.likely, r.draw, r.reservoirEnd, r.bookingGap, t('mood.' + r.mood)];
    }));

    var dates = [H(['date', 'what'])].concat(E.keyDatesFor(state, today).map(function (d) { return [D(d.date), t('date.' + d.key)]; }));

    return [
      { name: t('xp.s.summary'), rows: summary }, { name: t('xp.s.streams'), rows: streams }, { name: t('xp.s.invoices'), rows: invoices },
      { name: t('xp.s.bills'), rows: bills }, { name: t('xp.s.goals'), rows: goals }, { name: t('xp.s.spending'), rows: spending },
      { name: t('xp.s.forecast'), rows: forecast }, { name: t('xp.s.dates'), rows: dates }
    ];
  }

  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

  // ---------- CSV: one file, one titled block per sheet ----------
  function csvCell(v, sep, comma) {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.d) return v.d;
      if (v.p != null) { var pc = round2(v.p * 100) + '%'; return comma ? pc.replace('.', ',') : pc; }
      v = v.h;
    }
    if (typeof v === 'number') { var n = String(round2(v)); return comma ? n.replace('.', ',') : n; }
    v = String(v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // a client called =SUM(...) must stay text in Excel
    return v.indexOf(sep) >= 0 || /["\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  // German Excel expects semicolons and decimal commas. The BOM makes Excel read ü, €, £ correctly.
  function toCSV(sheets, opts) {
    var german = opts && opts.german, sep = german ? ';' : ',', lines = [];
    sheets.forEach(function (sh, i) {
      if (i) lines.push('');
      lines.push(csvCell(sh.name, sep, german));
      sh.rows.forEach(function (r) { lines.push(r.map(function (c) { return csvCell(c, sep, german); }).join(sep)); });
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  // ---------- XLSX: the minimal valid workbook, in a stored (uncompressed) zip ----------
  function xml(v) {
    return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
    });
  }
  function colName(i) { var s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  function serial(iso) { return Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000); }
  var STYLE = { header: 1, money: 2, date: 3, pct: 4 };
  function textCell(ref, v, style) { return '<c r="' + ref + '" t="inlineStr"' + (style ? ' s="' + style + '"' : '') + '><is><t xml:space="preserve">' + xml(v) + '</t></is></c>'; }
  function cellXML(ref, v) {
    if (v == null) return '';
    if (typeof v === 'number') return '<c r="' + ref + '" s="' + (Number.isInteger(v) && Math.abs(v) < 32 ? 0 : STYLE.money) + '"><v>' + round2(v) + '</v></c>';
    if (typeof v === 'object') {
      if (v.d) return '<c r="' + ref + '" s="' + STYLE.date + '"><v>' + serial(v.d) + '</v></c>';
      if (v.p != null) return '<c r="' + ref + '" s="' + STYLE.pct + '"><v>' + v.p + '</v></c>';
      return textCell(ref, v.h, STYLE.header);
    }
    return textCell(ref, v);
  }
  function width(v) { if (v == null) return 0; if (typeof v === 'object') return v.h ? String(v.h).length + 2 : 12; return typeof v === 'number' ? 13 : String(v).length + 1; }
  function sheetXML(sh) {
    var cols = [];
    sh.rows.forEach(function (r) { r.forEach(function (c, i) { cols[i] = Math.max(cols[i] || 8, Math.min(width(c), 60)); }); });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols>' + cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' +
      sh.rows.map(function (r, y) { return '<row r="' + (y + 1) + '">' + r.map(function (c, x) { return cellXML(colName(x) + (y + 1), c); }).join('') + '</row>'; }).join('') +
      '</sheetData></worksheet>';
  }
  // Excel refuses duplicate names, names over 31 characters, and a few characters.
  function sheetNames(sheets) {
    var seen = {};
    return sheets.map(function (sh) {
      var base = String(sh.name).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 28).trim() || 'Sheet', n = base, i = 2;
      while (seen[n.toLowerCase()]) n = base + ' ' + i++;
      seen[n.toLowerCase()] = 1;
      return n;
    });
  }
  var utf8 = (function () { var e = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null; return function (s) { return e.encode(s); }; })();
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    var chunks = [], central = [], offset = 0;
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.text), crc = crc32(data);
      var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length));
      var head = new Uint8Array([].concat(u32(0x04034b50), common, u16(0)));
      chunks.push(head, name, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), common, u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += head.length + name.length + data.length;
    });
    var size = central.reduce(function (t, c) { return t + c.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(size), u32(offset), u16(0)));
    var all = chunks.concat(central, [end]), out = new Uint8Array(all.reduce(function (t, c) { return t + c.length; }, 0)), at = 0;
    all.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  }
  function toXLSX(sheets) {
    var names = sheetNames(sheets);
    var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var files = [
      { name: '[Content_Types].xml', text: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', text: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map(function (n, i) { return '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', text: X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="174" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ];
    files[4].text = files[4].text.replace('<numFmts count="1">', '<numFmts count="2"><numFmt numFmtId="174" formatCode="0.0%"/>');
    sheets.forEach(function (sh, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: sheetXML(sh) }); });
    return zip(files);
  }

  return { buildSheets: buildSheets, toCSV: toCSV, toXLSX: toXLSX, sheetNames: sheetNames };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SwellExport;
