/* Swell UI. Renders from one state object; every change goes through commit(). */
(function () {
  'use strict';
  var E = window.SwellEngine, I18N = window.SwellI18n;
  var LS_KEY = 'swell.planner.v1';
  var GENERIC_NAME = 'Irregular Income Budget';
  var TABS = ['today', 'income', 'vault', 'plan', 'setup'];

  var settleNext = true;
  var state, view = 'today', invoiceFilter = 'open', splitAmount = 4400;
  var today = localToday();
  var Y, P, lang, loc, t, th; // country profile, language, locale, plain and HTML translators

  // ---------- language, country and formatting ----------
  var money0, pctFmt, symbol, symbolFirst;
  var CURRENCIES = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'NZD', 'SGD', 'USD'];
  // The country suggests a currency; settings.currency is only set when someone picks a different one.
  function currencyCode() { return state.settings.currency || P.currency; }
  // First visit, or a full reset: nothing entered yet and the welcome screen not yet answered.
  function needsWelcome(x) { return !x.sample && !x.settings.onboarded && !x.streams.length && !x.entries.length; }
  function setLocale() {
    P = E.profile(state); lang = state.settings.lang === 'de' ? 'de' : 'en'; loc = P.locale[lang];
    Y = E.yearFor(state, today);
    var tr = I18N.make(lang, P.code, Y.offset);
    t = tr.t; th = tr.th;
    money0 = new Intl.NumberFormat(loc, { style: 'currency', currency: currencyCode(), maximumFractionDigits: 0, minimumFractionDigits: 0 });
    pctFmt = function (d) { return new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
    var parts = money0.formatToParts(1);
    symbol = (parts.find(function (p) { return p.type === 'currency'; }) || {}).value || '';
    symbolFirst = parts.findIndex(function (p) { return p.type === 'currency'; }) < parts.findIndex(function (p) { return p.type === 'integer'; });
    document.documentElement.lang = lang === 'de' ? (P.code === 'AT' ? 'de-AT' : 'de') : (P.code === 'GB' ? 'en-GB' : 'en');
  }
  function fmt(n) { n = Number(n) || 0; var s = money0.format(Math.abs(Math.round(n))); return (Math.round(n) < 0 ? '−' : '') + s; }
  function fmtK(n) {
    n = Number(n) || 0; var a = Math.abs(n), sign = n < 0 ? '−' : '';
    if (a < 1000) return sign + money0.format(Math.round(a));
    var v = new Intl.NumberFormat(loc, { maximumFractionDigits: a >= 100000 ? 0 : 1 }).format(a / 1000);
    if (lang === 'de') return sign + v + ' Tsd. ' + symbol;
    return sign + (symbolFirst ? symbol + v + 'k' : v + 'k ' + symbol);
  }
  function num1(n) { return new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n) || 0); }
  function pct(n, d) { return pctFmt(d).format(Number(n) || 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dateOf(iso) { return E.parseISO(iso); }
  function dfmt(iso, o) { var d = dateOf(iso); if (!d) return '—'; o.timeZone = 'UTC'; return new Intl.DateTimeFormat(loc, o).format(d); }
  function dShort(iso) { return dfmt(iso, { day: 'numeric', month: 'short' }); }
  function dLong(iso) { return dfmt(iso, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function mName(key, long) { return dfmt(key + '-01', { month: long ? 'long' : 'short' }); }
  function localToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Reads what people actually type: 1500, 1,500, 1.500, 12,50, 4.400,50, $1,500. NaN if it can't be sure.
  function parseNum(raw) {
    var v = String(raw == null ? '' : raw).replace(/[\s\u00a0'’$€£]/g, '').replace(/^(AU|CA|US)/i, '');
    if (!v) return NaN;
    if (/^-?\d+$/.test(v)) return Number(v);
    var dot = v.lastIndexOf('.'), comma = v.lastIndexOf(',');
    if (dot >= 0 && comma >= 0) { // the last separator is the decimal point
      v = dot > comma ? v.replace(/,/g, '') : v.replace(/\./g, '').replace(',', '.');
    } else if (comma >= 0) {
      if (/^-?\d{1,3}(,\d{3})+$/.test(v) && lang !== 'de') v = v.replace(/,/g, '');
      else if ((v.match(/,/g) || []).length > 1) return NaN;
      else v = v.replace(',', '.');
    } else if (dot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(v) && lang === 'de') {
      v = v.replace(/\./g, '');
    }
    return /^-?\d*\.?\d+$/.test(v) ? Number(v) : NaN;
  }
  function numOut(v) { return v === '' || v == null ? '' : lang === 'de' ? String(v).replace('.', ',') : String(v); }
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function inDays(iso) { return E.daysBetween(today, iso); }
  function when(iso) {
    var n = inDays(iso);
    if (n === 0) return t('when.today'); if (n === 1) return t('when.tomorrow');
    if (n < 0) return t('when.ago', { n: Math.abs(n) });
    return t('when.in', { n: n });
  }
  function kindLabel(k) { return t('kind.' + k); }
  function stageLabel(s) { return t('stage.' + s); }
  var COLORS = ['ink', 'sea', 'sand', 'rose'];

  // ---------- storage ----------
  var Store = { mode: 'local', ref: null, saving: false, pending: false, timer: null, failed: false };
  function loadLocal() {
    try { var raw = localStorage.getItem(LS_KEY); if (raw) { var s = JSON.parse(raw); if (E.validateState(E.normalise(s)).length === 0) return E.normalise(s); } } catch (e) { /* storage blocked */ }
    return null;
  }
  function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); Store.localFailed = false; } catch (e) { Store.localFailed = true; } }
  // Hiding the example note is a per-browser convenience, so it lives outside the planner data.
  var NOTE_KEY = 'swell.noteHidden';
  function noteHidden() { try { return localStorage.getItem(NOTE_KEY) === '1'; } catch (e) { return false; } }
  function setNoteHidden(on) { try { if (on) localStorage.setItem(NOTE_KEY, '1'); else localStorage.removeItem(NOTE_KEY); } catch (e) { /* storage blocked */ } }
  function setStatus() {
    var el = document.getElementById('store-status'); if (!el) return;
    el.textContent = Store.failed ? t('store.failed') : Store.mode === 'cloud' ? t('store.cloud') : Store.localFailed ? t('store.none') : t('store.local');
  }
  function scheduleSave() {
    saveLocal();
    if (Store.mode !== 'cloud') return;
    clearTimeout(Store.timer);
    Store.timer = setTimeout(function () { Store.timer = null; flushCloud(); }, 700);
  }
  function flushCloud() {
    if (!Store.ref) return;
    if (Store.saving) { Store.pending = true; return; }
    Store.saving = true;
    var body = { state: JSON.parse(JSON.stringify(state)), savedAt: new Date().toISOString() };
    Store.ref.set(body).then(function () { Store.failed = false; }, function (e) {
      console.warn('Swell save failed', e && e.code); Store.failed = true;
    }).then(function () {
      Store.saving = false; setStatus();
      if (Store.pending) { Store.pending = false; flushCloud(); }
    });
  }
  function initCloud() {
    var c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    Promise.all([c.use('db'), c.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return null;
      return user.id().then(function (id) {
        if (!id) return null;
        var ref = db.doc('data/users/' + id + '/planner');
        return ref.get().then(function (snap) {
          Store.ref = ref; Store.mode = 'cloud';
          var cloud = null;
          if (snap.exists) {
            var d = snap.data() || {}, raw = d.state;
            // An empty or malformed copy is treated as no copy at all.
            if (raw && Array.isArray(raw.streams) && raw.settings) {
              cloud = E.normalise(JSON.parse(JSON.stringify(raw)));
              if (E.validateState(cloud).length) cloud = null;
            }
          }
          var isReal = function (x) { return needsWelcome(x) ? !!x.savedAt : !x.sample || x.edited; };
          // Real work always beats the untouched example; between two real copies, the newest edit wins.
          var useCloud = cloud && (!isReal(state) || (isReal(cloud) && (!state.savedAt || (cloud.savedAt && cloud.savedAt > state.savedAt))));
          if (useCloud) { closeModal(); state = cloud; saveLocal(); render(); if (isReal(cloud)) toast(t('toast.synced')); }
          else if (isReal(state)) flushCloud();
          setStatus();
        });
      });
    }).catch(function (e) { console.warn('Swell private space unavailable', e && e.code); setStatus(); });
  }

  // Any real edit marks the example as yours, so switching country or language can't throw it away.
  function commit(msg, notAnEdit) {
    if (state.sample && !notAnEdit) state.edited = true;
    state.savedAt = new Date().toISOString();
    scheduleSave(); render();
    if (msg) toast(Store.localFailed && Store.mode !== 'cloud' ? t('store.none') : msg);
  }

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  var ICON_X = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" style="stroke:currentColor;stroke-width:1.5;stroke-linecap:round;fill:none"></path></svg>';
  function closeBtn() { return '<button type="button" class="x" data-close aria-label="' + esc(t('btn.close')) + '">' + ICON_X + '</button>'; }

  // ---------- modal + forms ----------
  var modalState = null, modalReturn = null, downOnScrim = false;
  function closeModal() {
    var had = !!modalState;
    document.getElementById('modal-root').innerHTML = ''; modalState = null;
    if (had && modalReturn && document.contains(modalReturn)) modalReturn.focus({ preventScroll: true });
    modalReturn = null;
  }
  function openModal(html, handlers) {
    var root = document.getElementById('modal-root');
    if (!modalState) modalReturn = document.activeElement;
    root.innerHTML = '<div class="scrim" data-scrim><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    modalState = handlers || {};
    var first = root.querySelector('input,select,textarea,button:not(.x)');
    if (first) first.focus();
  }
  function fieldHTML(f) {
    var id = 'f_' + f.key, v = f.value == null ? '' : f.value, cls = 'field' + (f.full ? ' full' : '');
    var hint = f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '';
    if (f.type === 'choice') return '<fieldset class="choice field full"><legend>' + esc(f.label) + '</legend>' + f.options.map(function (o) {
      return '<label><input type="radio" name="' + id + '" value="' + esc(o[0]) + '"' + (o[0] === v ? ' checked' : '') + '><span class="c"><b>' + esc(o[1]) + '</b><small>' + esc(o[2]) + '</small></span></label>';
    }).join('') + '</fieldset>';
    if (f.type === 'checkbox') return '<label class="check field full"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
    var input;
    if (f.type === 'select') {
      input = '<select id="' + id + '">' + f.options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea id="' + id + '">' + esc(v) + '</textarea>';
    } else {
      var isNum = f.type === 'money' || f.type === 'number';
      input = '<input type="' + (isNum ? 'text' : f.type || 'text') + '" id="' + id + '" value="' + esc(isNum ? numOut(v) : v) + '"' +
        (isNum ? ' inputmode="decimal" autocomplete="off" data-num' : '') +
        (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + '>';
    }
    return '<div class="' + cls + '" data-field="' + esc(f.key) + '"><label for="' + id + '">' + esc(f.label) + '</label>' + input + hint + '</div>';
  }
  function readFields(fields) {
    var out = {};
    fields.forEach(function (f) {
      if (f.type === 'choice') { var ch = document.querySelector('input[name="f_' + f.key + '"]:checked'); out[f.key] = ch ? ch.value : ''; return; }
      var el = document.getElementById('f_' + f.key); if (!el) return;
      if (f.type === 'checkbox') out[f.key] = el.checked;
      else if (f.type === 'money' || f.type === 'number') out[f.key] = el.value.trim() === '' ? null : parseNum(el.value);
      else out[f.key] = el.value.trim();
    });
    return out;
  }
  // fields: [{key,label,type,value,options,hint,full,required}]; onSave(values) returns error string or nothing
  function openForm(o) {
    var html = '<div class="mh"><h3>' + esc(o.title) + '</h3>' + closeBtn() + '</div>' +
      (o.intro ? '<p class="muted small" style="margin:0">' + o.intro + '</p>' : '') +
      '<form data-form novalidate><div class="fields">' + o.fields.map(fieldHTML).join('') + '</div>' +
      (o.extra || '') +
      '<p class="err" data-err hidden></p>' +
      '<div class="spread actions">' +
      (o.onDelete ? '<button type="button" class="btn ghost sm" data-del>' + esc(o.deleteLabel || t('btn.delete')) + '</button>' : '<span></span>') +
      '<div class="row"><button type="button" class="btn ghost" data-close>' + esc(t('btn.cancel')) + '</button><button type="submit" class="btn">' + esc(o.submit || t('btn.save')) + '</button></div></div></form>';
    openModal(html, {
      submit: function () {
        var vals = readFields(o.fields), err = null;
        o.fields.forEach(function (f) {
          if (err) return;
          var v = vals[f.key];
          if (f.required && (v === '' || v == null)) err = t('err.needed', { f: f.label });
          else if ((f.type === 'money' || f.type === 'number') && v != null && (!isFinite(v) || v < (f.min != null ? f.min : 0))) err = t('err.min', { f: f.label, n: f.min != null ? f.min : 0 });
          else if ((f.type === 'money' || f.type === 'number') && v != null && f.max != null && v > f.max) err = t('err.max', { f: f.label, n: f.max });
          else if (f.type === 'date' && v && !E.parseISO(v)) err = t('err.date', { f: f.label });
        });
        if (!err) err = o.onSave(vals) || null;
        if (err) { var p = document.querySelector('[data-err]'); p.textContent = err; p.hidden = false; return; }
        closeModal();
      },
      del: o.onDelete ? function (btn) {
        if (btn.dataset.armed) { o.onDelete(); closeModal(); return; }
        btn.dataset.armed = '1'; btn.textContent = t('btn.deleteAgain'); btn.classList.remove('ghost'); btn.classList.add('danger');
      } : null,
      input: o.onInput || null,
      fields: o.fields
    });
  }

  // ---------- small renderers ----------
  function pill(kind, text) { text = String(text); return '<span class="pill p-' + kind + '">' + esc(text.charAt(0).toUpperCase() + text.slice(1)) + '</span>'; }
  function meter(frac, cls, tick) {
    var w = Math.max(0, Math.min(1, frac)) * 100;
    return '<div class="meter ' + (cls || '') + '"><i style="width:' + w.toFixed(1) + '%"></i>' +
      (tick != null ? '<span class="tick" style="left:calc(' + (Math.max(0, Math.min(1, tick)) * 100).toFixed(1) + '% - 1px)"></span>' : '') + '</div>';
  }
  function card(title, label, body, cls) {
    return '<section class="card ' + (cls || '') + '"><div class="card-h"><h2>' + title + '</h2>' + (label ? '<span class="label">' + label + '</span>' : '') + '</div>' + body + '</section>';
  }
  function stat(label, value, sub, style) {
    return '<div class="stat"><span class="label">' + label + '</span><b class="num"' + (style ? ' style="' + style + '"' : '') + '>' + value + '</b>' + (sub ? '<span class="small muted">' + sub + '</span>' : '') + '</div>';
  }
  function streamName(id) { var s = E.streamById(state, id); return s ? s.name : t('misc.unassigned'); }
  function splitOpts() {
    var plan = E.taxPlan(state, today);
    return { gstRegistered: state.settings.gstRegistered, salesTaxRate: E.salesRate(state), taxRate: plan.reserveRate, superPct: (Number(state.settings.superTopUpPct) || 0) / 100 };
  }
  function splitHTML(sp) {
    var tot = sp.amount || 1;
    var bar = '<div class="splitbar" aria-hidden="true">' +
      (sp.gst ? '<i style="width:' + (sp.gst / tot * 100) + '%;background:var(--muted)"></i>' : '') +
      '<i style="width:' + (sp.tax / tot * 100) + '%;background:var(--c2)"></i>' +
      '<i style="width:' + (sp.super / tot * 100) + '%;background:var(--c4)"></i>' +
      '<i style="width:' + (sp.yours / tot * 100) + '%;background:var(--ink)"></i></div>';
    var noVat = !P.salesTax.threshold;
    return '<div class="split' + (noVat ? ' three' : '') + '">' + (noVat ? '' :
      '<div><span class="label">' + esc(t('term.VAT')) + '</span><b>' + fmt(sp.gst) + '</b><span class="small muted">' + esc(sp.gst ? t('split.vatTo') : t('split.vatNone')) + '</span></div>') +
      '<div><span class="label">' + esc(t('split.tax')) + '</span><b>' + fmt(sp.tax) + '</b><span class="small muted">' + esc(t('split.taxTo')) + '</span></div>' +
      '<div><span class="label">' + esc(t('term.RETC')) + '</span><b>' + fmt(sp.super) + '</b><span class="small muted">' + esc(t('split.retTo')) + '</span></div>' +
      '<div class="yours"><span class="label">' + esc(t('split.yours')) + '</span><b>' + fmt(sp.yours) + '</b><span class="small muted">' + esc(t('split.yoursTo')) + '</span></div></div>' + bar;
  }

  // ---------- TODAY ----------
  var TODO_PILL = { tax: ['invoiced', 'pill.tax'], overdue: ['overdue', 'pill.action'], lean: ['lean', 'pill.heads'], flow: ['flow', 'pill.surplus'], pay: ['paid', 'pill.pay'] };
  function todoItems(c) {
    var items = [], sp = splitOpts(), g = c.gst;
    state.entries.forEach(function (e) {
      var s = E.streamById(state, e.streamId);
      if (e.stage === 'paid' && !e.vaulted && s && s.kind !== 'salary' && e.paid >= Y.start) {
        var x = E.splitPayment(e.amount, sp);
        items.push({ cls: 'tax', title: t('todo.vault', { amt: fmt(x.tax + x.gst) }), sub: t('todo.vaultSub', { client: e.client || t('misc.aPayment'), amt: fmt(e.amount), date: dShort(e.paid) }), btn: '<button class="btn sm" data-act="vault-entry" data-id="' + esc(e.id) + '">' + esc(t('btn.done')) + '</button>' });
      }
    });
    state.entries.forEach(function (e) {
      if (E.entryStatus(e, today) === 'overdue') items.push({ cls: 'overdue', title: t('todo.overdue', { client: e.client || t('misc.anInvoice'), n: E.daysBetween(e.due, today) }), sub: t('todo.overdueSub', { amt: fmt(e.amount), date: dShort(e.due) }) + (c.lateness[e.client] && c.lateness[e.client].avgLate > 0 ? ' · ' + t('todo.usuallyLate', { n: c.lateness[e.client].avgLate }) : ''), btn: '<button class="btn sm ghost" data-act="chase" data-id="' + esc(e.id) + '">' + esc(t('btn.nudgeLong')) + '</button>' });
    });
    E.keyDatesFor(state, today).forEach(function (d) {
      var n = inDays(d.date);
      if (d.instalment && n >= 0 && n <= 21 && c.plan.paygLikely) {
        items.push({ cls: 'tax', title: t('todo.inst', { when: when(d.date) }), sub: t('todo.instSub', { amt: fmt(c.plan.quarterlyInstalment), vault: fmt(state.balances.taxVault) }), btn: '<button class="btn sm ghost" data-act="pay-tax">' + esc(t('btn.logPayment')) + '</button>' });
      }
    });
    if (c.sts.sideSmoothed > 0 && state.settings.lastDraw !== E.monthKey(today)) items.push({ cls: 'pay', title: t('todo.draw', { amt: fmt(c.sts.sideSmoothed), month: mName(E.monthKey(today), true) }), sub: t('todo.drawSub'), btn: '<button class="btn sm" data-act="pay-self">' + esc(t('btn.paySelf')) + '</button>' });
    if (c.plan.vaultShortfall > 50) items.push({ cls: 'tax', title: t('todo.short', { amt: fmt(c.plan.vaultShortfall) }), sub: t('todo.shortSub', { rate: pct(c.plan.reserveRate) }), btn: '<button class="btn sm ghost" data-act="edit-balances">' + esc(t('btn.update')) + '</button>' });
    if (g.level === 'register') items.push({ cls: 'overdue', title: t('todo.register'), sub: t('todo.registerSub', { amt: fmt(Math.max(g.turnover, g.projected)), line: fmt(g.threshold), rate: pct(g.rate, g.rate * 100 % 1 ? 3 : 0) }), btn: '<button class="btn sm ghost" data-tab-go="vault">' + esc(t('btn.why')) + '</button>' });
    else if (g.level === 'approaching') items.push({ cls: 'lean', title: t('todo.approach', { pct: pct(g.pct) }), sub: t('todo.approachSub', { amt: fmt(g.projected), line: fmt(g.threshold), rate: pct(g.rate, g.rate * 100 % 1 ? 3 : 0) }), btn: '<button class="btn sm ghost" data-tab-go="vault">' + esc(t('btn.details')) + '</button>' });
    for (var i = 1; i < Math.min(4, c.fc.length); i++) {
      var r = c.fc[i];
      if (r.bookingGap > 100) { items.push({ cls: 'lean', title: t('todo.book', { amt: fmt(r.bookingGap), month: mName(r.key, true) }), sub: t('todo.bookSub'), btn: '<button class="btn sm ghost" data-tab-go="income">' + esc(t('btn.forecast')) + '</button>' }); break; }
    }
    if (c.res.surplus > 100) items.push({ cls: 'flow', title: t('todo.surplus', { amt: fmt(c.res.surplus) }), sub: t('todo.surplusSub', { n: c.res.targetMonths }), btn: '<button class="btn sm" data-act="move-surplus">' + esc(t('btn.splitIt')) + '</button>' });
    return items;
  }

  // The reservoir measured in months: one column per month of steady side pay it can carry,
  // buffer months in ink, overflow in sand, each labelled with the month it would pay for.
  function runwayChart(res) {
    var unit = res.targetMonths > 0 ? res.target / res.targetMonths : 0;
    if (!(unit > 0)) return '';
    var held = Math.max(0, res.available / unit), tm = res.targetMonths;
    var n = Math.max(1, Math.min(12, Math.max(tm, Math.ceil(held))));
    var mk = E.monthKey(today), cols = '';
    for (var i = 0; i < n; i++) {
      var fill = Math.max(0, Math.min(1, held - i));
      cols += '<div class="mo' + (i < tm ? ' buf' : ' over') + (fill === 0 ? ' dry' : '') + '"><span class="tube"><i style="--f:' + (fill * 100).toFixed(1) + '%"></i></span>' +
        '<span class="mn">' + esc(mName(E.addMonths(mk, i + 1))) + '</span></div>';
    }
    var short = Math.max(0, res.target - res.available);
    var brk = '<span class="brk" style="grid-column:1 / span ' + Math.min(tm, n) + '"><b><span class="w">' + esc(t('res.bufferN', { n: tm })) + ' </span>' + esc(t('res.buffer')) + '</b><span class="num">' + esc(short > 0 ? t('res.toGo', { amt: fmtK(short) }) : fmtK(res.target)) + '</span></span>' +
      (n > tm && res.surplus > 0 ? '<span class="brk over" style="grid-column:' + (tm + 1) + ' / span ' + (n - tm) + '"><b>' + esc(t('res.surplus')) + '</b><span class="num">' + fmtK(res.surplus) + '</span></span>' : '');
    var label = t('res.aria', { held: num1(held), n: tm }) + (res.surplus > 0 ? t('res.ariaSurplus', { amt: fmt(res.surplus) }) : '');
    return '<figure class="runway" role="img" aria-label="' + esc(label) + '" style="--n:' + n + '"><div class="brks" aria-hidden="true">' + brk + '</div><div class="cols" aria-hidden="true">' + cols + '</div>' +
      (held > 12 ? '<figcaption class="more">' + esc(t('res.more', { n: num1(held - 12) })) + '</figcaption>' : '') + '</figure>';
  }

  // Today's cover: a quiet B&W photograph with the greeting set over it.
  function cover() {
    var h = new Date().getHours();
    var hello = h < 12 ? t('hello.morning') : h < 18 ? t('hello.afternoon') : t('hello.evening');
    return '<div class="cover"><img src="assets/cover.jpg" alt=""><div class="cover-text"><h2>' + esc(hello) + '</h2>' +
      '<p class="accent">' + esc(t('hello.accent')) + '</p></div></div>';
  }
  // The month as a fine measure: one hairline per day, lived days in ink, Mondays taller, today labelled.
  function monthMeasure(mk) {
    var dim = E.daysInMonth(mk), dayN = +today.slice(8, 10), ticks = '';
    for (var i = 1; i <= dim; i++) {
      var dow = new Date(Date.UTC(+mk.slice(0, 4), +mk.slice(5, 7) - 1, i)).getUTCDay();
      var cls = (i < dayN ? 'past' : '') + (dow === 1 ? ' wk' : '') + (i === dayN ? ' now' : '');
      ticks += '<i class="' + cls.trim() + '">' + (i === dayN ? '<b>' + esc(t('when.today')) + '</b>' : '') + '</i>';
    }
    var lived = dim > 1 ? ((dayN - 1) / (dim - 1) * 100).toFixed(2) : '0';
    return '<div class="days" aria-hidden="true" style="--lived:' + lived + '%">' + ticks + '</div>' +
      '<div class="ends" aria-hidden="true"><span>' + esc(dShort(mk + '-01')) + '</span><span>' + esc(dShort(mk + '-' + String(dim).padStart(2, '0'))) + '</span></div>';
  }

  // The inputs Today needs before its numbers mean anything, worked out from what's already filled in.
  function nextSteps() {
    var st = state.settings, b = state.balances;
    if (state.sample || st.stepsHidden) return '';
    var steps = [
      { key: 'income', done: state.streams.length > 0, act: 'add-stream', btn: t('stream.add') },
      { key: 'bills', done: state.bills.length > 0, act: 'add-bill', v: 'essential', btn: t('next.billsBtn') },
      { key: 'work', done: state.entries.length > 0, act: 'add-entry', btn: t('btn.logWork') },
      { key: 'money', done: st.balancesSet || !!(Number(b.reservoir) || Number(b.taxVault) || Number(b.taxPaid)), act: 'edit-balances', btn: t('next.moneyBtn') }
    ];
    var doneCount = steps.filter(function (x) { return x.done; }).length, current = null;
    if (doneCount === steps.length) return '';
    return '<section class="card steps" aria-labelledby="steps-h"><div class="card-h"><h2 id="steps-h">' + esc(t('next.title')) + '</h2><span class="label">' + esc(t('next.count', { done: doneCount, n: steps.length })) + '</span></div>' +
      '<p class="small muted steps-intro">' + esc(t('next.intro')) + '</p><ol>' + steps.map(function (x) {
        var isNext = !x.done && !current; if (isNext) current = x;
        return '<li class="' + (x.done ? 'done' : isNext ? 'next' : '') + '"><div><b>' + esc(t('next.' + x.key)) + '</b>' + (x.done ? '<span class="label">' + esc(t('next.done')) + '</span>' : '<p class="small muted">' + esc(t('next.' + x.key + 'Why')) + '</p>') + '</div>' +
          (x.done ? '' : '<button class="btn sm' + (isNext ? '' : ' ghost') + '" data-act="' + x.act + '"' + (x.v ? ' data-v="' + x.v + '"' : '') + '>' + esc(x.btn) + '</button>') + '</li>';
      }).join('') + '</ol><div class="steps-foot"><button type="button" class="hide" data-act="tour-start">' + esc(t('tour.replay')) + '</button><button type="button" class="hide" data-act="hide-steps">' + esc(t('next.hide')) + '</button></div></section>';
  }
  function renderToday(c) {
    var s = c.sts, res = c.res, mk = E.monthKey(today);
    if (!state.streams.length) {
      return nextSteps() || '<div class="empty"><b>' + esc(t('empty.start')) + '</b><span>' + esc(t('empty.startSub')) + '</span><button class="btn" data-act="add-stream">' + esc(t('btn.addStream')) + '</button></div>';
    }
    var leftLine = s.left >= 0
      ? th('sts.left', { amt: fmt(s.left), month: mName(mk, true), n: s.daysLeft, rituals: fmt(s.ritualLeft) })
      : th('sts.over', { amt: fmt(-s.left) });
    var method = s.smoothing.method;
    var smoothNote = method === 'estimate' ? t('sts.estimate')
      : t('sts.note.' + method, { amt: fmt(s.sideSmoothed), from: mName(s.smoothing.months[0].key), to: mName(s.smoothing.months[5].key), avg: fmt(s.smoothing.average), low: fmt(s.smoothing.floor) }) +
        (Number(state.settings.businessExpenses) > 0 ? ' ' + t('sts.note.costs', { costs: fmt(state.settings.businessExpenses / 12) }) : '');
    var status = s.left < 0 ? ['bad', t('sts.overPlan')] : s.left < Math.max(0, s.flexible - s.needs.rituals) * 0.15 ? ['warn', t('sts.low')] : ['good', t('sts.onPlan')];
    if (!state.bills.length) status = ['warn', t('sts.noBills')];
    var hero = nextSteps() + cover() + '<div class="hero">' +
      '<section class="statement" aria-labelledby="sts-h">' +
      '<h2 class="big num' + (settleNext ? ' settle' : '') + '" id="sts-h">' + fmt(Math.max(0, s.perWeek)) + '</h2>' +
      '<p class="caption">' + esc(s.left >= 0 ? t('sts.safe') : t('sts.hold')) + '</p>' +
      '<p class="status-line"><span class="num">' + esc(t('sts.perDay', { amt: fmt(s.perDay) })) + '</span><span class="status ' + status[0] + '"><i></i>' + esc(status[1]) + '</span></p>' +
      '<dl class="facts"><div><dt>' + esc(t('sts.salary')) + '</dt><dd class="num">' + fmt(s.salaryNet) + '<small>' + esc(t('sts.salarySub')) + '</small></dd></div>' +
      '<div><dt>' + esc(t('sts.side')) + '</dt><dd class="num">' + fmt(s.sideSmoothed) + '<small>' + esc(t('sts.sideSub')) + '</small></dd></div>' +
      '<div><dt>' + esc(t('sts.earn')) + '</dt><dd class="num">' + fmt(s.paySelf) + '<small>' + esc(t('sts.earnSub')) + '</small></dd></div></dl>' +
      monthMeasure(mk) +
      '<p class="pace">' + leftLine + '</p>' +
      '<p class="pay-q" id="pay-q">' + esc(t('sts.q')) + '</p><div class="seg" role="group" aria-labelledby="pay-q">' +
      [['steady', 'sts.m.steady'], ['average', 'sts.m.average'], ['floor', 'sts.m.floor']].map(function (m) {
        return '<button data-act="smoothing" data-v="' + m[0] + '" aria-pressed="' + (state.settings.smoothing === m[0]) + '">' + esc(t(m[1])) + '</button>';
      }).join('') + '</div><p class="smooth-note">' + esc(smoothNote) + '</p></section>' +
      '<section class="card reservoir" aria-labelledby="res-h"><div class="card-h"><h2 id="res-h">' + esc(t('res.title')) + '</h2><span class="label">' + esc(t('res.label')) + '</span></div>' +
      '<div class="res-head"><div class="mid num">' + fmt(res.balance) + '</div>' +
      (res.runwayMonths != null ? '<p class="runway-line"><em class="num">' + esc(t('res.months', { n: num1(res.runwayMonths) })) + '</em> ' + esc(t('res.monthsSub')) + '</p>' : '<p class="runway-line">' + esc(t('res.noSide')) + '</p>') + '</div>' +
      runwayChart(res) +
      (res.hasSalary ? '<p class="small muted res-note">' + esc(res.salaryCoversEssentials ? t('res.covers') : t('res.coversPct', { pct: pct(res.essentialsCoverPct) })) + '</p>' : '') +
      (res.held > 0 ? '<p class="small muted res-note">' + esc(t('res.held', { amt: fmt(res.held) })) + '</p>' : '') +
      (res.surplus > 0 ? '<div class="flow-split"><div class="splitbar" aria-hidden="true"><i class="k-ink" style="flex:' + res.split.future + '"></i><i class="k-sea" style="flex:' + res.split.goals + '"></i><i class="k-sand" style="flex:' + res.split.joy + '"></i></div>' +
        '<div class="stats">' + stat('<i class="dot k-ink"></i>' + esc(t('flow.future')), fmt(res.split.future)) + stat('<i class="dot k-sea"></i>' + esc(t('flow.goals')), fmt(res.split.goals)) + stat('<i class="dot k-sand"></i>' + esc(t('flow.joy')), fmt(res.split.joy)) + '</div></div>' : '') +
      '<div class="row">' + (s.sideSmoothed > 0 && state.settings.lastDraw !== mk ? '<button class="btn sm" data-act="pay-self">' + esc(t('btn.paySelf')) + '</button>' : '') + '<button class="btn ghost sm" data-act="edit-balances">' + esc(t('btn.updateBalance')) + '</button>' + (res.surplus > 0 ? '<button class="btn sm" data-act="move-surplus">' + esc(t('btn.splitSurplus')) + '</button>' : '') + '</div></section></div>';

    var todos = todoItems(c);
    var todoHTML = todos.length ? '<ul class="todo">' + todos.map(function (x) {
      return '<li><div class="t">' + pill(TODO_PILL[x.cls][0], t(TODO_PILL[x.cls][1])) + '<b>' + esc(x.title) + '</b><span>' + esc(x.sub) + '</span></div>' + x.btn + '</li>';
    }).join('') + '</ul>' : '<div class="empty"><b>' + esc(t('todo.clear')) + '</b><span>' + esc(t('todo.clearSub')) + '</span></div>';

    var ups = c.up.slice(0, 8);
    var upHTML = ups.length ? '<div class="lines">' + ups.map(function (u) {
      var k = u.kind === 'overdue' ? 'overdue' : u.kind === 'tax' ? 'invoiced' : u.kind === 'invoice' ? 'paid' : u.kind === 'super' ? 'pipeline' : 'ok';
      return '<div class="line"><div class="nm"><b>' + esc(upLabel(u)) + '</b><span>' + esc(dShort(u.date) + ' · ' + when(u.date)) + '</span></div><span class="num">' + (u.amount ? fmt(u.amount) : '') + '</span>' + pill(k, t('upk.' + u.kind)) + '</div>';
    }).join('') + '</div>' : '<p class="muted">' + esc(t('up.none')) + '</p>';

    var everydayBudget = Math.max(0, s.flexible - s.needs.rituals);
    var monthSpends = state.spends.filter(function (p) { return E.monthKey(p.date) === mk; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var spendHTML = '<form class="inline-form" data-form-inline="spend">' +
      '<input type="text" id="sp_amt" inputmode="decimal" autocomplete="off" placeholder="' + esc(t('spend.amount', { sym: symbol })) + '" aria-label="' + esc(t('spend.amountAria')) + '">' +
      '<input type="text" id="sp_label" class="grow" placeholder="' + esc(t('spend.what')) + '" aria-label="' + esc(t('spend.whatAria')) + '">' +
      '<select id="sp_kind" aria-label="' + esc(t('spend.kind')) + '"><option value="everyday">' + esc(t('cat.everyday')) + '</option><option value="ritual">' + esc(t('cat.ritual')) + '</option></select>' +
      '<button class="btn" type="submit">' + esc(t('btn.log')) + '</button></form><p class="err" id="sp_err" hidden></p>' +
      '<div class="stats"><div class="stat"><span class="label">' + esc(t('cat.everyday')) + '</span><b class="num">' + fmt(s.spent.everyday) + '</b><span class="small muted">' + esc(t('spend.of', { amt: fmt(everydayBudget) })) + '</span>' + meter(everydayBudget ? s.spent.everyday / everydayBudget : 0, s.spent.everyday > everydayBudget ? 'bad' : '') + '</div>' +
      '<div class="stat"><span class="label">' + esc(t('cat.rituals')) + '</span><b class="num">' + fmt(s.spent.ritual) + '</b><span class="small muted">' + esc(t('spend.ofRituals', { amt: fmt(s.needs.rituals) })) + '</span>' + meter(s.needs.rituals ? s.spent.ritual / s.needs.rituals : 0, s.spent.ritual > s.needs.rituals ? 'bad' : '') + '</div></div>' +
      (monthSpends.length ? '<div class="lines">' + monthSpends.map(function (p) {
        var nm = p.label || (p.kind === 'ritual' ? t('cat.ritual') : t('spend.spending'));
        return '<div class="line"><div class="nm"><b>' + esc(nm) + '</b><span>' + esc(dShort(p.date) + ' · ' + (function (w) { return lang === 'de' ? w : w.toLowerCase(); })(t('cat.' + (p.kind === 'ritual' ? 'ritual' : 'everyday')))) + '</span></div><span class="num">' + fmt(p.amount) + '</span><button class="x" data-act="del-spend" data-id="' + esc(p.id) + '" aria-label="' + esc(t('spend.remove', { what: nm })) + '">' + ICON_X + '</button></div>';
      }).join('') + '</div>' : '<p class="muted small">' + esc(t('spend.none')) + '</p>');

    return hero + '<div class="grid" style="margin-top:16px">' +
      '<div class="c7">' + card(esc(t('todo.title')), esc(t('todo.count', { n: todos.length })), todoHTML) + '</div>' +
      '<div class="c5">' + card(esc(t('up.title')), esc(t('up.label')), upHTML) + '</div>' +
      '<div class="c12">' + card(esc(t('spend.title', { month: mName(mk, true) })), esc(t('spend.label')), spendHTML) + '</div></div>';
  }
  function upLabel(u) {
    if (u.kind === 'overdue') return t('up.overdue', { client: u.client || t('misc.invoice'), n: u.days });
    if (u.kind === 'invoice') return u.late ? t('up.dueLate', { client: u.client || t('misc.invoice'), n: u.late }) : t('up.due', { client: u.client || t('misc.invoice') });
    if (u.kind === 'bill') return u.client;
    return t('date.' + u.key);
  }

  // ---------- MONEY IN ----------
  // Six months drawn as one ruled almanac: booked work solid, likely work hatched, the steady pay you
  // draw as one fine line, and any shortfall as an empty dashed frame the size of the work to book.
  function forecastChart(c) {
    var rows = c.fc, draw = c.sts.sideSmoothed, maxV = Math.max(draw, 1);
    rows.forEach(function (r) { maxV = Math.max(maxV, r.paid + r.confirmed + r.likely); });
    var top = maxV * 1.18, pc = function (v) { return (Math.max(0, v) / top * 100).toFixed(2) + '%'; };
    var cols = rows.map(function (r, i) {
      var solid = r.paid + r.confirmed, total = solid + r.likely, gap = i === 0 ? 0 : r.bookingGap;
      var labelAt = Math.max(total, gap > 0 ? total + gap : 0);
      return '<div class="sw-col">' +
        (gap > 0 ? '<i class="sw-gap" style="bottom:' + pc(total) + ';height:' + pc(gap) + '"></i>' : '') +
        (r.likely > 0 ? '<i class="sw-likely" style="bottom:' + pc(solid) + ';height:' + pc(r.likely) + '"></i>' : '') +
        (solid > 0 ? '<i class="sw-booked" style="height:' + pc(solid) + '"></i>' : '') +
        (total > 0 ? '<span class="sw-val num" style="bottom:' + pc(labelAt) + '">' + fmtK(total) + '</span>' : '') + '</div>';
    }).join('');
    var months = rows.map(function (r, i) {
      var note = r.bookingGap > 0 && i > 0 ? '<span class="sw-note book">' + esc(t('fc.book', { amt: fmtK(r.bookingGap) })) + '</span>'
        : '<span class="sw-note">' + esc(i === 0 ? t('fc.soFar', { amt: fmtK(r.paid + r.inflow) }) : t('fc.covered')) + '</span>';
      return '<div class="sw-m"><span class="sw-name">' + esc(mName(r.key)) + (i === 0 ? '<em>' + esc(t('fc.now')) + '</em>' : '') + '</span>' +
        '<span class="sw-mood ' + r.mood + '"><i></i>' + esc(t('mood.' + r.mood)) + '</span><b class="num">' + fmtK(r.reservoirEnd) + '</b>' + note + '</div>';
    }).join('');
    var lean = rows.filter(function (r, i) { return i > 0 && r.bookingGap > 0; }).length;
    var label = t('fc.aria', { amt: fmt(draw) }) + ' ' + (lean ? t('fc.ariaLean', { n: lean }) : t('fc.ariaOk'));
    return '<figure class="swell-chart"><div class="sw-plot" role="img" aria-label="' + esc(label) + '">' +
      (draw > 0 ? '<i class="sw-steady" style="bottom:' + pc(draw) + '"></i>' : '') + cols + '</div>' +
      '<div class="sw-months">' + months + '</div></figure>';
  }

  function renderIncome(c) {
    var opts = splitOpts();
    var streams = state.streams.map(function (st) {
      var fy = c.fyTotals[st.id] || 0, body;
      if (st.kind === 'salary') {
        body = '<b class="num">' + fmt(st.annualGross) + '</b><span class="small muted">' + esc(t('inc.salarySub', { amt: fmt(E.salaryNet(state, st.annualGross)) })) + '</span>';
      } else {
        body = '<b class="num">' + fmt(fy) + '</b><span class="small muted">' + esc(t('inc.sideSub', { amt: fmt(st.expectedMonthly) })) + '</span>';
      }
      return '<div class="stream"><div class="spread"><span class="kind"><span class="dot k-' + esc(st.color || 'ink') + '"></span>' + esc(kindLabel(st.kind)) + '</span>' + (st.active === false ? pill('steady', t('inc.paused')) : '') + '</div>' +
        '<strong>' + esc(st.name) + '</strong>' + body + '<div class="row"><button class="btn ghost sm" data-act="edit-stream" data-id="' + esc(st.id) + '">' + esc(t('btn.edit')) + '</button></div></div>';
    }).join('');
    var streamsCard = card(esc(t('inc.streams')), esc(t('inc.streamsN', { n: state.streams.length })),
      (streams ? '<div class="streams">' + streams + '</div>' : '<div class="empty"><b>' + esc(t('inc.noStreams')) + '</b><span>' + esc(t('inc.noStreamsSub')) + '</span></div>') +
      '<div class="row"><button class="btn" data-act="add-stream">' + esc(t('btn.addStreamShort')) + '</button></div>');

    var forecastCard = card(esc(t('fc.title')), esc(t('fc.label')),
      '<p class="sub" style="margin:0">' + th('fc.intro', { amt: fmt(c.sts.sideSmoothed) }) + '</p>' +
      forecastChart(c) +
      '<div class="legend"><span><i class="sw k-booked"></i>' + esc(t('fc.k.booked')) + '</span><span><i class="sw k-likely"></i>' + esc(t('fc.k.likely')) + '</span><span><i class="sw k-steady"></i>' + esc(t('fc.k.steady')) + '</span><span><i class="sw k-gap"></i>' + esc(t('fc.k.gap')) + '</span></div>' +
      '<p class="small muted" style="margin:0">' + esc(t('fc.foot')) + '</p>');

    var list = state.entries.filter(function (e) {
      var st = E.entryStatus(e, today);
      if (invoiceFilter === 'open') return st !== 'paid';
      if (invoiceFilter === 'paid') return st === 'paid';
      return true;
    }).sort(function (a, b) {
      var da = a.stage === 'paid' ? a.paid : a.due || '', db = b.stage === 'paid' ? b.paid : b.due || '';
      return invoiceFilter === 'paid' ? (da < db ? 1 : -1) : (da < db ? -1 : 1);
    });
    var rows = list.map(function (e) {
      var st = E.entryStatus(e, today), land = st === 'invoiced' || st === 'overdue' ? E.expectedLanding(e, c.lateness) : null;
      var dateCell = st === 'paid' ? esc(t('inv.paidOn', { date: dShort(e.paid) }))
        : st === 'pipeline' ? esc((e.due ? t('inv.around', { date: dShort(e.due) }) : '—') + ' · ' + (e.probability || 0) + '%')
        : esc(t('inv.due', { date: dShort(e.due) })) + (land && land !== e.due ? '<br><span class="small muted">' + esc(t('inv.likely', { date: dShort(land) })) + '</span>' : '');
      var yours = E.splitPayment(e.amount, opts).yours;
      var actions = '';
      if (st === 'invoiced' || st === 'overdue') actions += '<button class="btn sm" data-act="mark-paid" data-id="' + esc(e.id) + '">' + esc(t('btn.paid')) + '</button>';
      if (st === 'overdue') actions += '<button class="btn sm ghost" data-act="chase" data-id="' + esc(e.id) + '">' + esc(t('btn.nudge')) + '</button>';
      if (st === 'pipeline') actions += '<button class="btn sm ghost" data-act="to-invoice" data-id="' + esc(e.id) + '">' + esc(t('btn.invoiced')) + '</button>';
      actions += '<button class="btn sm ghost" data-act="edit-entry" data-id="' + esc(e.id) + '">' + esc(t('btn.edit')) + '</button>';
      return '<tr><td><div class="who"><b>' + esc(e.client || t('misc.untitled')) + '</b><span>' + esc(streamName(e.streamId)) + '</span></div></td>' +
        '<td class="num r">' + fmt(e.amount) + '<br><span class="small muted">' + esc(t('inv.yours', { amt: fmt(yours) })) + '</span></td>' +
        '<td class="small">' + dateCell + '</td><td>' + pill(st, stageLabel(st)) + '</td><td class="r"><div class="row end">' + actions + '</div></td></tr>';
    }).join('');
    var invCard = card(esc(t('inv.title')), '<span class="seg" role="group" aria-label="' + esc(t('inv.filter')) + '">' + [['open', 'inv.f.open'], ['paid', 'inv.f.paid'], ['all', 'inv.f.all']].map(function (f) {
      return '<button data-act="inv-filter" data-v="' + f[0] + '" aria-pressed="' + (invoiceFilter === f[0]) + '">' + esc(t(f[1])) + '</button>';
    }).join('') + '</span>',
      (rows ? '<div class="tbl"><table><thead><tr><th>' + esc(t('inv.h.client')) + '</th><th class="r">' + esc(t('inv.h.amount')) + '</th><th>' + esc(t('inv.h.when')) + '</th><th>' + esc(t('inv.h.status')) + '</th><th class="r"><span class="label" style="position:absolute;left:-9999px">' + esc(t('inv.h.actions')) + '</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty"><b>' + esc(t('inv.empty')) + '</b><span>' + esc(t('inv.emptySub')) + '</span></div>') +
      '<div class="row"><button class="btn" data-act="add-entry">' + esc(t('btn.logWork')) + '</button></div>');

    var late = Object.keys(c.lateness).map(function (k) { return [k, c.lateness[k]]; }).sort(function (a, b) { return b[1].avgLate - a[1].avgLate; });
    var lateCard = card(esc(t('late.title')), esc(t('late.label')),
      late.length ? '<div class="lines">' + late.map(function (l) {
        return '<div class="line"><div class="nm"><b>' + esc(l[0]) + '</b><span>' + esc(t('late.invoices', { n: l[1].invoices })) + '</span></div><span class="num">' + esc(l[1].avgLate ? t('late.days', { n: l[1].avgLate }) : t('late.onTime')) + '</span>' + pill(l[1].avgLate > 14 ? 'overdue' : l[1].avgLate > 3 ? 'invoiced' : 'paid', t(l[1].avgLate > 14 ? 'late.slow' : l[1].avgLate > 3 ? 'late.bit' : 'late.reliable')) + '</div>';
      }).join('') + '</div>' : '<p class="muted">' + esc(t('late.none')) + '</p>');

    return '<div class="grid"><div class="c12">' + forecastCard + '</div><div class="c12">' + invCard + '</div><div class="c7">' + streamsCard + '</div><div class="c5">' + lateCard + '</div></div>';
  }

  // ---------- TAX VAULT ----------
  function rateStack(plan) {
    var sal = plan.salaryGross, side = plan.projected.net, total = sal + side;
    var max = Math.max(P.bandsMax, total * 1.08), W = 640, H = 70, T = 6, BH = 34;
    var x = function (v) { return Math.min(W, v / max * W); };
    var br = P.bands, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('vault.stackAria')) + '">';
    for (var i = 1; i < br.length; i++) {
      var lo = br[i][0], hi = i + 1 < br.length ? br[i + 1][0] : max;
      if (lo >= max) break;
      s += '<rect x="' + x(lo) + '" y="' + T + '" width="' + Math.max(0, x(hi) - x(lo)) + '" height="' + BH + '" style="fill:var(--line);opacity:' + Math.min(1, 0.35 + br[i][1]) + '"></rect>' +
        (x(hi) - x(lo) > 40 ? '<text x="' + (x(lo) + 4) + '" y="' + (T + BH + 14) + '" style="fill:var(--muted);font:600 10px var(--font);letter-spacing:.06em">' + esc(br[i][2]) + '</text>' : '');
    }
    s += '<rect x="0" y="' + (T + 8) + '" width="' + x(sal) + '" height="' + (BH - 16) + '" style="fill:var(--ink)"></rect>';
    s += '<rect x="' + x(sal) + '" y="' + (T + 8) + '" width="' + Math.max(0, x(total) - x(sal)) + '" height="' + (BH - 16) + '" style="fill:var(--c2)"></rect>';
    s += '</svg>';
    return s;
  }

  function renderVault(c) {
    var p = c.plan, opts = splitOpts(), sp = E.splitPayment(splitAmount, opts);
    var ruleGap = (p.reserveRate - 0.25) * p.projected.gross;
    var rateCard = '<section class="hero-main" aria-labelledby="rate-h"><h2 class="hero-line" id="rate-h">' + esc(t('vault.setAside')) + ' <span class="big num">' + esc(pct(p.reserveRate, 1)) + '</span> ' + esc(state.settings.gstRegistered ? t('vault.everyExVat') : t('vault.every')) + '</h2>' +
      '<p class="sub">' + th(p.salaryGross > 0 ? 'vault.why' : 'vault.whyNoSalary', { salary: fmt(p.salaryGross), side: fmt(p.projected.net), tax: fmt(p.sideTax) }) +
      (ruleGap > 200 ? ' ' + th('vault.rule', { amt: fmt(ruleGap) }) : '') + '</p>' +
      rateStack(p) +
      '<div class="legend"><span><i class="sw" style="background:var(--ink)"></i>' + esc(t('vault.kSalary', { amt: fmtK(p.salaryGross) })) + '</span><span><i class="sw" style="background:var(--c2)"></i>' + esc(t('vault.kSide', { amt: fmtK(p.projected.net) })) + '</span><span>' + esc(t('vault.marginal', { rate: pct(p.marginalRate) })) + '</span></div></section>';

    var splitCard = card(esc(t('splitc.title')), esc(t('splitc.label')),
      '<div class="field"><label for="split_amt">' + esc(t('splitc.amount')) + '</label><input type="text" id="split_amt" inputmode="decimal" autocomplete="off" value="' + esc(numOut(splitAmount)) + '"></div><div id="split_out">' + splitHTML(sp) + '</div>' +
      '<p class="small muted" style="margin:0">' + esc(t('splitc.note', { pct: pct((Number(state.settings.superTopUpPct) || 0) / 100) })) + '</p>');

    var vaultFrac = p.vaultTarget > 0 ? state.balances.taxVault / p.vaultTarget : 1;
    var vaultCard = card(esc(t('vc.title')), esc(t('vc.label')),
      '<div class="stats">' + stat(esc(t('vc.in')), fmt(state.balances.taxVault)) +
      stat(esc(t('vc.owed')), fmt(p.vaultTarget), esc(t('vc.owedSub', { date: dShort(Y.start), paid: fmt(state.balances.taxPaid) }))) +
      stat(esc(t('vc.status')), esc(p.vaultShortfall > 50 ? t('vc.short', { amt: fmt(p.vaultShortfall) }) : p.vaultShortfall > -1 ? t('vc.onTrack') : t('vc.ahead', { amt: fmt(-p.vaultShortfall) })), '', 'color:var(--' + (p.vaultShortfall > 50 ? 'bad' : 'good') + ')') + '</div>' +
      meter(vaultFrac, vaultFrac < 0.9 ? 'bad' : '') +
      '<div class="row"><button class="btn" data-act="pay-tax">' + esc(t('btn.logTax')) + '</button><button class="btn ghost" data-act="edit-balances">' + esc(t('btn.editBalances')) + '</button></div>');

    var mtd = P.code === 'GB' && p.projected.gross > 15000 ? ' ' + t('inst.mtd') : '';
    var paygCard = card(esc(t('term.INSTC')), esc(p.paygLikely ? t('inst.likely') : t('inst.notYet')),
      '<div class="stats">' + stat(esc(t('inst.year')), fmt(p.sideTax)) + stat(esc(p.instalmentsPerYear === 2 ? t('inst.each2') : t('inst.each4')), fmt(p.quarterlyInstalment)) + '</div>' +
      '<p class="small" style="margin:0">' + esc((p.paygLikely ? t('inst.bodyLikely') : t('inst.bodyNot')) + mtd) + '</p>');

    var g = c.gst;
    var gstCard = g.level === 'none' ? card(esc(t('se.title')), esc(t('se.label')), '<p class="small" style="margin:0">' + th('se.body', { rate: pct(p.marginalRate) }) + '</p>') : card(esc(t('vat.title')), esc(g.level === 'registered' ? t('vat.registered') : t('vat.line', { amt: fmt(g.threshold) })),
      (g.level === 'registered' ? '<p class="small" style="margin:0">' + esc(t('vat.regBody', { rate: pct(g.rate, g.rate * 100 % 1 ? 3 : 0) })) + '</p>' :
        '<div class="spread"><b class="mid num">' + fmt(Math.max(g.turnover, g.projected)) + '</b>' + pill(g.level === 'register' ? 'overdue' : g.level === 'approaching' ? 'invoiced' : 'paid', t('vat.lv.' + g.level)) + '</div>' +
        meter(g.pct, g.level === 'register' ? 'bad' : g.level === 'approaching' ? 'warn' : '') +
        '<p class="small muted" style="margin:0">' + esc(t('vat.body', { last: fmt(g.turnover), proj: fmt(g.projected), line: fmt(g.threshold), cap: fmt(g.hardCap || 0), rate: pct(g.rate, g.rate * 100 % 1 ? 3 : 0) })) + '</p>'));

    var sup = c.sup, topPct = pct((Number(state.settings.superTopUpPct) || 0) / 100);
    var supStats = (P.retirement.employerRate ? stat(esc(t('ret.employer')), fmt(sup.employer), esc(t('ret.employerSub', { pct: pct(P.retirement.employerRate) }))) : '') +
      stat(esc(t('ret.topup')), fmt(sup.personalPlanned), esc(t('ret.topupSub', { pct: topPct }))) +
      (sup.deductible ? stat(esc(t('ret.room')), esc(sup.overCap ? t('ret.overCap') : fmt(sup.room)), '', 'color:var(--' + (sup.overCap ? 'bad' : 'ink') + ')')
        : stat(esc(t('ret.premium')), fmt(sup.taxSaving)));
    var superCard = card(esc(t('ret.title')), esc(t('ret.label', { cap: fmtK(sup.cap) })),
      '<div class="stats">' + supStats + '</div>' +
      (sup.deductible ? meter((sup.alreadyCounted + sup.personalPlanned) / sup.cap, sup.overCap ? 'bad' : '') : meter(sup.personalPlanned / sup.cap)) +
      (c.res.held > 0 ? '<div class="spread"><span class="small">' + esc(t('ret.held', { amt: fmt(c.res.held) })) + '</span><button class="btn ghost sm" data-act="contribute">' + esc(t('btn.contribute')) + '</button></div>' : '') +
      '<p class="small" style="margin:0">' + th('ret.body', { missed: fmt(sup.missedIfNone), rate: pct(c.plan.marginalRate), saving: fmt(sup.taxSaving), used: fmt(sup.alreadyCounted), cap: fmt(sup.cap) }) + '</p>');

    var dates = E.keyDatesFor(state, today).map(function (d) {
      var past = d.date < today;
      return '<div class="line"><div class="nm"><b' + (past ? ' class="muted"' : '') + '>' + esc(t('date.' + d.key)) + '</b><span>' + esc(dLong(d.date) + (past ? '' : ' · ' + when(d.date))) + '</span></div><span></span>' + pill(past ? 'steady' : d.kind === 'super' ? 'pipeline' : 'invoiced', past ? t('dates.past') : t('upk.' + d.kind)) + '</div>';
    }).join('');
    var datesCard = card(esc(t('dates.title')), esc(t('term.YEAR')), '<div class="lines">' + dates + '</div>');

    return '<div class="grid"><div class="c7">' + rateCard + '</div><div class="c5">' + splitCard + '</div>' +
      '<div class="c6">' + vaultCard + '</div><div class="c6">' + paygCard + '</div>' +
      '<div class="c6">' + gstCard + '</div><div class="c6">' + superCard + '</div>' +
      '<div class="c12">' + datesCard + '</div></div>';
  }

  // ---------- SPENDING & GOALS ----------
  var FREQ = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'];
  function renderPlan(c) {
    var s = c.sts, n = s.needs, pay = s.paySelf || 1;
    var everyday = Math.max(0, pay - n.essentials - n.goals - n.rituals);
    var over = n.total > pay;
    var bar = '<div class="splitbar" style="height:16px" aria-hidden="true">' +
      '<i style="width:' + Math.min(100, n.essentials / Math.max(pay, n.total) * 100) + '%;background:var(--ink)"></i>' +
      '<i style="width:' + Math.min(100, n.goals / Math.max(pay, n.total) * 100) + '%;background:var(--c4)"></i>' +
      '<i style="width:' + Math.min(100, n.rituals / Math.max(pay, n.total) * 100) + '%;background:var(--c3)"></i>' +
      '<i style="width:' + Math.min(100, everyday / Math.max(pay, n.total) * 100) + '%;background:var(--c2)"></i></div>';
    var overview = card(esc(t('plan.title')), esc(t('plan.label', { amt: fmt(s.paySelf) })),
      bar + '<div class="stats">' +
      stat('<span class="dot k-ink"></span>' + esc(t('cat.essentials')), fmt(n.essentials)) +
      stat('<span class="dot" style="background:var(--c4)"></span>' + esc(t('cat.goals')), fmt(n.goals)) +
      stat('<span class="dot k-rose"></span>' + esc(t('cat.rituals')), fmt(n.rituals)) +
      stat('<span class="dot k-sea"></span>' + esc(t('cat.everyday')), fmt(everyday)) + '</div>' +
      (over ? '<p class="err" style="margin:0">' + esc(t('plan.over', { amt: fmt(n.total - s.paySelf) })) + '</p>' : ''));

    function billLines(cat) {
      var list = state.bills.filter(function (b) { return (b.category === 'ritual') === (cat === 'ritual'); });
      if (!list.length) return '<p class="muted small">' + esc(t('plan.none')) + '</p>';
      return '<div class="lines">' + list.map(function (b) {
        return '<div class="line"><div class="nm"><b>' + esc(b.name) + '</b><span>' + esc(fmt(b.amount) + ' ' + t('per.' + (FREQ.indexOf(b.freq) >= 0 ? b.freq : 'monthly')) + (b.day && b.freq === 'monthly' ? ' · ' + t('plan.onDay', { n: b.day, ord: ordinal(b.day) }) : '')) + '</span></div><span class="num">' + fmt(E.billMonthly(b)) + '<span class="small muted">' + esc(t('per.mo')) + '</span></span><button class="btn sm ghost" data-act="edit-bill" data-id="' + esc(b.id) + '">' + esc(t('btn.edit')) + '</button></div>';
      }).join('') + '</div>';
    }
    var essentials = card(esc(t('cat.essentials')), esc(fmt(n.essentials) + t('per.mo')), billLines('essential') + '<div class="row"><button class="btn ghost" data-act="add-bill" data-v="essential">' + esc(t('btn.addEssential')) + '</button></div>');
    var rituals = card(esc(t('cat.rituals')), esc(t('plan.ritualsLabel')), '<p class="small muted" style="margin:0">' + esc(t('plan.ritualsBody')) + '</p>' + billLines('ritual') + '<div class="row"><button class="btn ghost" data-act="add-bill" data-v="ritual">' + esc(t('btn.addRitual')) + '</button></div>');

    var goals = state.goals.map(function (g) {
      var f = g.target > 0 ? g.saved / g.target : 0, left = Math.max(0, g.target - g.saved);
      var months = g.monthly > 0 ? Math.ceil(left / g.monthly) : null;
      var eta = months != null && left > 0 ? E.addMonths(E.monthKey(today), months) : null;
      return '<div class="stream"><div class="spread"><strong>' + esc(g.name) + '</strong>' + (left <= 0 ? pill('flow', t('goal.done')) : '') + '</div><b class="num">' + fmt(g.saved) + ' <span class="small muted">' + esc(t('goal.of', { amt: fmt(g.target) })) + '</span></b>' + meter(f) +
        '<span class="small muted">' + esc(left <= 0 ? t('goal.funded') : fmt(g.monthly) + t('per.mo') + ' · ' + (eta ? t('goal.eta', { month: mName(eta, true), year: eta.slice(0, 4) }) : t('goal.setMonthly'))) + '</span>' +
        '<div class="row"><button class="btn sm" data-act="goal-add" data-id="' + esc(g.id) + '">' + esc(t('btn.addMoney')) + '</button><button class="btn sm ghost" data-act="edit-goal" data-id="' + esc(g.id) + '">' + esc(t('btn.edit')) + '</button></div></div>';
    }).join('');
    var goalsCard = card(esc(t('cat.goals')), esc(fmt(n.goals) + t('per.mo')), (goals ? '<div class="streams">' + goals + '</div>' : '<div class="empty"><b>' + esc(t('goal.none')) + '</b><span>' + esc(t('goal.noneSub')) + '</span></div>') + '<div class="row"><button class="btn ghost" data-act="add-goal">' + esc(t('btn.addGoal')) + '</button></div>');

    var r = state.settings.flowRules;
    var flow = card(esc(t('flowc.title')), esc(t('flowc.label')),
      '<p class="small muted" style="margin:0">' + esc(t('flowc.body', { n: Number(state.settings.bufferMonths) })) + '</p>' +
      '<div class="fields">' +
      fieldHTML({ key: 'flow_future', label: t('flowc.future'), type: 'number', value: r.future, max: 100 }) +
      fieldHTML({ key: 'flow_goals', label: t('flowc.goals'), type: 'number', value: r.goals, max: 100 }) +
      fieldHTML({ key: 'flow_joy', label: t('flowc.joy'), type: 'number', value: r.joy, max: 100 }) +
      fieldHTML({ key: 'buffer_months', label: t('flowc.buffer'), type: 'number', value: state.settings.bufferMonths, step: 1, min: 1, max: 24 }) +
      '</div><p class="small muted" style="margin:0" id="flow_note">' + esc(flowNote(r)) + '</p>');

    return '<div class="grid"><div class="c12">' + overview + '</div><div class="c6">' + essentials + '</div><div class="c6">' + rituals + '</div><div class="c7">' + goalsCard + '</div><div class="c5">' + flow + '</div></div>';
  }
  function flowNote(r) {
    var tot = (Number(r.future) || 0) + (Number(r.goals) || 0) + (Number(r.joy) || 0);
    return tot === 100 ? t('flowc.ok') : t('flowc.scaled', { n: tot });
  }
  function ordinal(n) { n = +n; if (lang === 'de') return n + '.'; var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  // ---------- SETTINGS ----------
  function countryMeta(code) {
    var C = E.Countries.get(code), tr = I18N.make(lang, code, E.yearFor({ settings: { country: code } }, today).offset);
    return tr.t('term.YEAR') + ' · ' + C.currency + (C.salesTax.threshold ? ' · ' + tr.t('term.VAT') + ' ' + (C.salesTax.metaRate || Math.round(C.salesTax.rate * 100) + '%') : '');
  }
  function currencyPicker() {
    var cur = currencyCode(), names = null;
    try { names = new Intl.DisplayNames([loc], { type: 'currency' }); } catch (e) { /* older browser */ }
    var options = CURRENCIES.map(function (c) { return [c, c + (names ? ' · ' + names.of(c) : '')]; });
    return '<div class="fields">' + fieldHTML({ key: 'set_currency', label: t('cur.label'), type: 'select', value: cur, full: true, options: options, hint: cur === P.currency ? t('cur.hint') : t('cur.mismatch', { c: t('country.' + P.code), home: P.currency, cur: cur }) }) + '</div>';
  }
  function countryPicker() {
    return '<div class="countries" role="radiogroup" aria-label="' + esc(t('place.country')) + '">' + E.Countries.codes.map(function (code) {
      var on = state.settings.country === code;
      return '<button type="button" role="radio" aria-checked="' + on + '" class="country' + (on ? ' on' : '') + '" data-act="set-country" data-v="' + code + '">' +
        '<span class="cn">' + esc(t('country.' + code)) + '</span><span class="cm">' + esc(countryMeta(code)) + '</span></button>';
    }).join('') + '</div>';
  }
  function langPicker() {
    return '<div class="seg" role="group" aria-labelledby="lang-l">' +
      [['en', 'English'], ['de', 'Deutsch']].map(function (l) { return '<button data-act="set-lang" data-v="' + l[0] + '" lang="' + l[0] + '" aria-pressed="' + (lang === l[0]) + '">' + l[1] + '</button>'; }).join('') + '</div>';
  }
  function renderWelcome() {
    return '<section class="welcome" aria-labelledby="welcome-h">' +
      '<h2 id="welcome-h">' + esc(t('ob.title')) + '</h2><p class="welcome-sub">' + esc(t('ob.sub')) + '</p>' +
      '<div class="welcome-part"><h3 id="lang-l">' + esc(t('place.language')) + '</h3>' + langPicker() + '</div>' +
      '<div class="welcome-part"><h3>' + esc(t('ob.country')) + '</h3><p class="small muted">' + esc(t('ob.countryHint')) + '</p>' + countryPicker() + '</div>' +
      '<div class="welcome-part">' + currencyPicker() + '</div>' +
      '<div class="welcome-acts"><button class="btn" data-act="ob-start">' + esc(t('ob.start')) + '</button>' +
      '<button class="btn ghost" data-act="ob-sample">' + esc(t('ob.sample')) + '</button>' +
      '<button class="btn ghost" data-act="import">' + esc(t('btn.restore')) + '</button></div></section>';
  }
  function renderSetup() {
    var st = state.settings, b = state.balances;
    var naming = card(esc(t('name.title')), esc(t('name.label')),
      '<div class="fields">' + fieldHTML({ key: 'plan_name', label: t('name.field'), type: 'text', value: st.planName, full: true, maxlength: 60, placeholder: t('name.ph'), hint: t('name.hint', { generic: GENERIC_NAME }) }) + '</div>');
    var place = card(esc(t('place.title')), esc(t('place.label')),
      countryPicker() +
      '<div class="lang-row"><span class="label" id="lang-l">' + esc(t('place.language')) + '</span>' + langPicker() + '</div>' +
      currencyPicker() +
      '<p class="small muted" style="margin:0">' + esc(t('place.note')) + '</p>');
    var balances = card(esc(t('bal.title')), esc(t('bal.label')),
      '<div class="fields">' +
      fieldHTML({ key: 'bal_reservoir', label: t('bal.reservoir'), type: 'number', value: b.reservoir, hint: t('bal.reservoirHint') }) +
      fieldHTML({ key: 'bal_taxVault', label: t('bal.vault'), type: 'number', value: b.taxVault, hint: t('bal.vaultHint') }) +
      fieldHTML({ key: 'bal_taxPaid', label: t('bal.paid'), type: 'number', value: b.taxPaid, hint: t('bal.paidHint') }) +
      '</div>');
    var countryFields = '';
    if (P.regions) {
      countryFields += fieldHTML({ key: 'set_region', label: t('set.region'), type: 'select', value: st.region, full: true, options: P.regions.map(function (r) { return [r, t('region.' + P.code + '.' + r)]; }) });
      if (st.region === 'OTHER') countryFields += fieldHTML({ key: 'set_regionrate', label: t('set.regionRate'), type: 'number', value: st.regionRate, max: 15, step: 0.1, hint: t('set.regionRateHint') });
    }
    if (P.settings.indexOf('privateHospital') >= 0) countryFields += fieldHTML({ key: 'set_private', label: t('set.private'), type: 'checkbox', value: st.privateHospital });
    if (P.settings.indexOf('churchTax') >= 0) countryFields += fieldHTML({ key: 'set_church', label: t('set.church'), type: 'select', value: st.churchTax, options: [['none', t('set.church.none')], ['8', t('set.church.8')], ['9', t('set.church.9')]], full: true });
    if (P.settings.indexOf('hasChildren') >= 0) countryFields += fieldHTML({ key: 'set_children', label: t('set.children'), type: 'checkbox', value: st.hasChildren });
    if (P.settings.indexOf('scotland') >= 0) countryFields += fieldHTML({ key: 'set_scotland', label: t('set.scotland'), type: 'checkbox', value: st.scotland });
    var tax = card(esc(t('set.title')), esc(t('term.YEAR')),
      '<div class="fields">' +
      (P.salesTax.threshold ? fieldHTML({ key: 'set_gst', label: t('set.vat'), type: 'checkbox', value: st.gstRegistered }) : '') +
      countryFields +
      fieldHTML({ key: 'set_super', label: t('set.ret'), type: 'number', value: st.superTopUpPct, max: 50, hint: t('set.retHint') }) +
      fieldHTML({ key: 'set_exp', label: t('set.exp'), type: 'number', value: st.businessExpenses, hint: t('set.expHint') }) +
      '</div>');
    var data = card(esc(t('data.title')), esc(state.sample ? t('data.sample') : t('data.own')),
      '<p class="small" style="margin:0">' + esc(Store.mode === 'cloud' ? t('data.cloud') : t('data.local')) + '</p>' +
      '<div class="row">' +
      '<button class="btn" data-act="start-fresh">' + esc(state.sample ? t('btn.clearExample') : t('btn.startOver')) + '</button>' +
      (state.sample ? '' : '<button class="btn ghost" data-act="load-sample">' + esc(t('btn.loadExample')) + '</button>') +
      '<button class="btn ghost" data-act="tour-start">' + esc(t('tour.replay')) + '</button>' +
      '<button class="btn ghost" data-act="export">' + esc(t('btn.backup')) + '</button><button class="btn ghost" data-act="import">' + esc(t('btn.restore')) + '</button></div>' +
      '<div class="row"><button class="btn ghost" data-act="dl-xlsx">' + esc(t('btn.excel')) + '</button><button class="btn ghost" data-act="dl-csv">' + esc(t('btn.csv')) + '</button></div>');
    var about = card(esc(t('about.title')), esc(t('about.label')),
      '<ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">' +
      ['about.rates', 'about.reserve', 'about.steady', 'about.late', 'about.limits'].map(function (k) { return '<li>' + esc(t(k)) + '</li>'; }).join('') + '</ul>');
    return '<div class="grid"><div class="c12">' + naming + '</div><div class="c12">' + place + '</div><div class="c6">' + tax + '</div><div class="c6">' + balances + '</div><div class="c6">' + data + '</div><div class="c6">' + about + '</div></div>';
  }

  // ---------- render ----------
  function render() {
    today = localToday();
    setLocale();
    // A new tax year starts the "paid so far" count again; the vault itself is left for you to settle.
    var yearId = P.code + ':' + Y.start, seen = state.balances.taxPaidYear;
    if (seen !== yearId) {
      if (seen && seen.split(':')[0] === P.code) state.balances.taxPaid = 0;
      state.balances.taxPaidYear = yearId;
    }
    var focusId = document.activeElement && document.activeElement.id && !document.activeElement.closest('.modal') ? document.activeElement.id : null;
    var focusAct = !focusId && document.activeElement && document.activeElement.dataset && document.activeElement.dataset.act ? [document.activeElement.dataset.act, document.activeElement.dataset.v] : null;
    var html, c;
    try {
      c = E.computeAll(state, today);
      var welcoming = needsWelcome(state);
      document.body.classList.toggle('welcoming', welcoming);
      html = welcoming ? renderWelcome() : view === 'income' ? renderIncome(c) : view === 'vault' ? renderVault(c) : view === 'plan' ? renderPlan(c) : view === 'setup' ? renderSetup(c) : renderToday(c);
    } catch (e) {
      console.error(e);
      html = '<div class="empty"><b>' + esc(t('err.render')) + '</b><span>' + esc(e.message) + '</span><button class="btn" data-act="export">' + esc(t('btn.backup')) + '</button></div>';
    }
    document.getElementById('view').innerHTML = html;
    settleNext = false;
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); }
    else if (focusAct) { var fa = document.querySelector('[data-act="' + focusAct[0] + '"]' + (focusAct[1] ? '[data-v="' + focusAct[1] + '"]' : '')); if (fa) fa.focus({ preventScroll: true }); }
    document.getElementById('banner').innerHTML = needsWelcome(state) ? '' : (Y.stale ? '<p class="stale-note">' + esc(t('rates.stale', { base: baseYear() })) + '</p>' : '') + (state.sample
      && !noteHidden() ? '<aside class="note" aria-labelledby="note-h"><div class="note-in"><h2 id="note-h">' + esc(t('note.title')) + '</h2>' +
        '<p>' + esc(t('note.body')) + '</p>' +
        '<div class="acts"><button class="btn sm" data-act="start-fresh">' + esc(t('btn.startOwn')) + '</button><button type="button" class="hide" data-act="hide-note">' + ICON_X + esc(t('btn.hide')) + '</button></div></div></aside>' : '');
    var sn = document.querySelector('[data-act="show-note"]'); if (sn) sn.hidden = !(state.sample && noteHidden());
    // Static chrome: tabs, tagline, footer and the masthead language switch.
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('.mast-lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === lang)); });
    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      var on = b.dataset.tab === view;
      b.setAttribute('aria-selected', String(on));
      if (on && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = b.offsetLeft - (b.parentNode.clientWidth - b.offsetWidth) / 2;
    });
    document.getElementById('mast-date').innerHTML = esc(dfmt(today, { weekday: 'long', day: 'numeric', month: 'short' })) + '<span class="yr"> · ' + esc(t('term.YEAR')) + '</span>';
    document.getElementById('footer-rates').textContent = t('foot.rates', { YEAR: baseYear() });
    showName(state.settings.planName);
    setStatus();
    if (typeof tabEdges === 'function' && tabsEl) tabEdges();
  }
  // The name at the top: the one set in Settings, or the generic one. Long names step down a size.
  function showName(name) {
    name = String(name || '').trim() || GENERIC_NAME;
    var plate = document.querySelector('.nameplate');
    plate.innerHTML = name === GENERIC_NAME ? 'Irregular Income <em>Budget</em>' : esc(name); // the generic name sets "Budget" in italic
    plate.classList.toggle('long', name.length > 24);
    document.querySelector('.rail-mark').textContent = name;
    document.title = name;
    maybeTour();
  }

  function baseYear() { return I18N.make(lang, P.code, 0).t('term.YEAR'); }
  // ---------- guided walkthrough ----------
  var tourStep = null;
  function tourSteps() {
    return [
      { key: 'tabs', tab: 'today', sel: 'nav.tabs' },
      { key: 'streams', tab: 'income', sel: '[data-act="add-stream"]', card: 1 },
      { key: 'work', tab: 'income', sel: '[data-act="add-entry"]', card: 1 },
      { key: 'vault', tab: 'vault', sel: '.hero-main' },
      { key: 'bills', tab: 'plan', sel: '[data-act="add-bill"]', card: 1 },
      { key: 'goals', tab: 'plan', sel: '[data-act="add-goal"]', card: 1 },
      { key: 'place', tab: 'setup', sel: '.countries', card: 1 },
      { key: 'data', tab: 'setup', sel: '[data-act="dl-xlsx"]', card: 1 },
      { key: state.sample ? 'homeSample' : 'home', tab: 'today', sel: '.steps, .statement' }
    ];
  }
  function tourTarget(step) {
    var el = document.querySelector(step.sel);
    if (el && step.card) el = el.closest('.card') || el;
    return el || document.querySelector('nav.tabs');
  }
  function placeTour(scroll) {
    var root = document.getElementById('tour-root'); if (tourStep === null || !root.firstChild) return;
    var el = tourTarget(tourSteps()[tourStep]), rail = document.getElementById('rail');
    if (scroll && el !== document.querySelector('nav.tabs')) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - rail.offsetHeight - 16, behavior: 'instant' });
    else if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
    var r = el.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth, pad = 6;
    var top = Math.max(0, r.top - pad), bottom = Math.min(vh, r.bottom + pad);
    var hole = root.querySelector('.tour-hole'), box = root.querySelector('.tour-card');
    hole.style.cssText = 'top:' + top + 'px;left:' + Math.max(0, r.left - pad) + 'px;width:' + Math.min(vw, r.width + pad * 2) + 'px;height:' + Math.max(0, bottom - top) + 'px';
    var h = box.offsetHeight, w = box.offsetWidth, gap = 14, y;
    if (vh - bottom >= h + gap * 2) y = bottom + gap;
    else if (top >= h + gap * 2) y = top - h - gap;
    else y = vh - h - 16; // no room either side: rest it on the lower part of a tall card
    box.style.top = y + 'px';
    box.style.left = Math.max(16, Math.min(vw - w - 16, r.left)) + 'px';
  }
  function showTour(i) {
    var steps = tourSteps(), step = steps[i], last = i === steps.length - 1;
    tourStep = i;
    if (view !== step.tab) go(step.tab);
    document.getElementById('tour-root').innerHTML = '<div class="tour"><div class="tour-hole"></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-h" aria-describedby="tour-b" tabindex="-1">' +
      '<span class="label">' + esc(t('tour.count', { i: i + 1, n: steps.length })) + '</span>' +
      '<h2 id="tour-h">' + esc(t('tour.' + step.key)) + '</h2><p id="tour-b">' + esc(t('tour.' + step.key + 'Body')) + '</p>' +
      '<div class="tour-acts">' + (last ? '<span></span>' : '<button type="button" class="hide" data-act="tour-end">' + esc(t('tour.skip')) + '</button>') + '<div>' +
      (i > 0 ? '<button type="button" class="btn ghost sm" data-act="tour-prev">' + esc(t('tour.back')) + '</button>' : '') +
      '<button type="button" class="btn sm" data-act="tour-next">' + esc(last ? t('tour.finish') : t('tour.next')) + '</button></div></div></div></div>';
    placeTour(true);
    document.querySelector('.tour-card [data-act="tour-next"]').focus({ preventScroll: true });
  }
  function startTour() { closeModal(); showTour(0); }
  function endTour() {
    tourStep = null;
    document.getElementById('tour-root').innerHTML = '';
    state.settings.toured = true;
    view = 'today';
    try { history.replaceState(null, '', '#today'); } catch (e) { /* ignore */ }
    commit('', true); window.scrollTo(0, 0);
    var first = document.querySelector('.steps .next button'); if (first) first.focus({ preventScroll: true });
  }
  // First time, or after a full reset: runs once the welcome screen has been answered.
  function maybeTour() {
    var st = state.settings;
    if (tourStep !== null || modalState || !st.onboarded || st.toured || needsWelcome(state)) return;
    tourStep = 0; setTimeout(function () { if (tourStep === 0) showTour(0); }, 60);
  }
  document.addEventListener('keydown', function (ev) {
    if (tourStep === null) return;
    if (ev.key === 'Escape') { endTour(); return; }
    if (ev.key === 'ArrowRight') { handlers['tour-next'](); return; }
    if (ev.key === 'ArrowLeft') { handlers['tour-prev'](); return; }
    if (ev.key === 'Tab') { // keep focus on the walkthrough's own buttons
      var f = [].slice.call(document.querySelectorAll('.tour-card button')), at = f.indexOf(document.activeElement);
      ev.preventDefault(); f[(at + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  window.addEventListener('resize', function () { placeTour(true); });

  function go(tab) {
    if (TABS.indexOf(tab) < 0) tab = 'today';
    if (tab === 'today' && view !== 'today') settleNext = true;
    view = tab;
    try { history.replaceState(null, '', '#' + tab); } catch (e) { /* ignore */ }
    render(); window.scrollTo(0, 0);
  }

  // ---------- actions ----------
  function findEntry(id) { return state.entries.find(function (e) { return e.id === id; }); }
  function streamOptions(includeSalary) {
    return state.streams.filter(function (s) { return includeSalary || s.kind !== 'salary'; }).map(function (s) { return [s.id, s.name]; });
  }
  function addDays(iso, n) { return E.toISO(new Date(E.parseISO(iso).getTime() + n * 86400000)); }

  // What a payment put into the accounts is remembered on the entry, so edits and deletes can undo it exactly.
  function applyCredit(e, toVault, toRes) {
    var x = E.splitPayment(e.amount, splitOpts()), b = state.balances, c = { res: 0, vault: 0, ret: 0 };
    if (toVault) { c.vault = E.round2(x.tax + x.gst); b.taxVault = E.round2(Number(b.taxVault) + c.vault); e.vaulted = true; }
    if (toRes) {
      c.res = E.round2(toVault ? x.yours + x.super : x.amount);
      b.reservoir = E.round2(Number(b.reservoir) + c.res);
      c.ret = x.super; b.retHeld = E.round2(Number(b.retHeld) + c.ret);
    }
    e.credit = c;
    return x;
  }
  function undoCredit(e) {
    var c = e.credit, b = state.balances; if (!c) return false;
    b.reservoir = E.round2(Number(b.reservoir) - c.res);
    b.taxVault = E.round2(Math.max(0, Number(b.taxVault) - c.vault));
    b.retHeld = E.round2(Math.max(0, Number(b.retHeld) - c.ret));
    e.credit = null; e.vaulted = false;
    return true;
  }
  function entryForm(e) {
    var isNew = !e;
    var opts = streamOptions(false);
    if (!opts.length) { toast(t('toast.sideFirst')); return streamForm(null, 'abn'); }
    e = e || { streamId: opts[0][0], stage: 'invoiced', issued: today, due: addDays(today, 14), probability: 70 };
    openForm({
      title: isNew ? t('entry.newTitle') : (e.client || t('entry.entry')),
      fields: [
        { key: 'streamId', label: t('entry.stream'), type: 'select', options: opts, value: e.streamId, full: true },
        { key: 'client', label: t('entry.client'), type: 'text', value: e.client, required: true, full: true, placeholder: t('entry.clientPh') },
        { key: 'amount', label: state.settings.gstRegistered ? t('entry.amountVat') : t('entry.amount'), type: 'money', value: e.amount, required: true },
        { key: 'stage', label: t('entry.stage'), type: 'select', value: e.stage, options: [['pipeline', t('entry.st.pipeline')], ['invoiced', t('entry.st.invoiced')], ['paid', t('entry.st.paid')]] },
        { key: 'issued', label: t('entry.issued'), type: 'date', value: e.issued },
        { key: 'due', label: t('entry.due'), type: 'date', value: e.due },
        { key: 'paid', label: t('entry.paid'), type: 'date', value: e.paid || '', hint: t('entry.paidHint') },
        { key: 'probability', label: t('entry.chance'), type: 'number', value: e.probability != null ? e.probability : 70, max: 100, step: 5, hint: t('entry.chanceHint') }
      ],
      onSave: function (v) {
        if (v.stage === 'paid' && !v.paid) v.paid = today;
        if (v.stage === 'paid' && v.paid > today) return t('err.paidFuture');
        var rec = isNew ? { id: uid('e') } : e, wasPaid = !isNew && e.stage === 'paid', had = wasPaid && e.credit ? { v: e.credit.vault > 0, r: e.credit.res > 0 } : null;
        if (had && (v.stage !== 'paid' || v.amount !== e.amount)) undoCredit(e); else had = null;
        var newlyPaid = v.stage === 'paid' && !wasPaid, paidOn = v.paid;
        if (newlyPaid) v.stage = 'invoiced';
        rec.streamId = v.streamId; rec.client = v.client; rec.amount = v.amount || 0; rec.stage = v.stage;
        rec.issued = v.issued || ''; rec.due = v.due || ''; rec.paid = v.stage === 'paid' ? v.paid : '';
        rec.probability = v.probability == null ? 70 : v.probability;
        if (v.stage !== 'paid') rec.vaulted = false;
        if (isNew) state.entries.push(rec);
        if (had && rec.stage === 'paid') applyCredit(rec, had.v, had.r);
        commit(isNew ? t('toast.logged', { what: rec.client }) : t('toast.saved'));
        // Money that has landed goes through the same split as "Mark as paid", so balances stay right.
        if (newlyPaid) setTimeout(function () { markPaid(rec, paidOn); }, 60);
      },
      onDelete: isNew ? null : function () { undoCredit(e); state.entries = state.entries.filter(function (x) { return x.id !== e.id; }); commit(t('toast.removed')); }
    });
  }

  function markPaid(e, on) {
    var sp = E.splitPayment(e.amount, splitOpts());
    var fields = [
      { key: 'paid', label: t('paid.on'), type: 'date', value: on || today },
      { key: 'amount', label: t('paid.amount'), type: 'money', value: e.amount, required: true },
      { key: 'toVault', label: t('paid.toVault', { amt: fmt(sp.tax + sp.gst) }), type: 'checkbox', value: true },
      { key: 'toRes', label: t('paid.toRes', { amt: fmt(sp.yours + sp.super) }), type: 'checkbox', value: true }
    ];
    openForm({
      title: e.client || t('paid.payment'), submit: t('paid.submit'),
      intro: esc(t('paid.intro')),
      extra: '<div style="margin-top:14px" id="paid_split">' + splitHTML(sp) + '</div>',
      fields: fields,
      onInput: function () {
        var a = Math.max(0, parseNum((document.getElementById('f_amount') || {}).value) || 0), x = E.splitPayment(a, splitOpts());
        var el = document.getElementById('paid_split'); if (el) el.innerHTML = splitHTML(x);
        var tv = document.getElementById('f_toVault'), tr = document.getElementById('f_toRes');
        tv.nextElementSibling.textContent = t('paid.toVault', { amt: fmt(x.tax + x.gst) });
        tr.nextElementSibling.textContent = t('paid.toRes', { amt: fmt(tv.checked ? x.yours + x.super : x.amount) });
      },
      onSave: function (v) {
        if (!v.paid) return t('err.paidDate');
        if (v.paid > today) return t('err.future');
        if (!(v.amount >= 0)) return t('err.min', { f: t('paid.amount'), n: 0 });
        e.amount = v.amount; e.stage = 'paid'; e.paid = v.paid;
        var x = applyCredit(e, v.toVault, v.toRes);
        commit(t('toast.paid', { amt: fmt(x.yours) }));
      }
    });
  }

  function streamForm(s, kind) {
    var isNew = !s;
    s = s || { kind: kind || 'abn', color: COLORS[state.streams.length % COLORS.length], expectedMonthly: 0, annualGross: 0 };
    var used = state.entries.filter(function (e) { return !isNew && e.streamId === s.id; }).length;
    var fields = [
      { key: 'kind', label: t('stream.q'), type: 'choice', value: s.kind, options: [['salary', t('stream.k.salary'), t('stream.k.salarySub')], ['abn', t('stream.k.abn'), t('stream.k.abnSub')], ['other', t('stream.k.other'), t('stream.k.otherSub')]] },
      { key: 'name', label: t('stream.name'), type: 'text', value: s.name, required: true, full: true },
      { key: 'annualGross', label: t('stream.gross'), type: 'money', value: s.annualGross || '', full: true, placeholder: fmt(90000), hint: t('stream.grossHint') },
      { key: 'expectedMonthly', label: t('stream.typical'), type: 'money', value: s.expectedMonthly || '', full: true, placeholder: fmt(2000), hint: t('stream.typicalHint') }
    ];
    if (!isNew) fields.push({ key: 'active', label: t('stream.active'), type: 'checkbox', value: s.active !== false });
    // Only the amount that fits the chosen kind of income is shown.
    var fit = function () {
      var ch = document.querySelector('input[name="f_kind"]:checked'), k = ch ? ch.value : 'abn';
      var g = document.querySelector('[data-field="annualGross"]'), m = document.querySelector('[data-field="expectedMonthly"]'), n = document.getElementById('f_name');
      if (g) g.hidden = k !== 'salary';
      if (m) m.hidden = k === 'salary';
      if (n) n.placeholder = t('stream.namePh.' + k);
    };
    openForm({
      title: isNew ? t('stream.newTitle') : s.name, submit: isNew ? t('stream.add') : t('btn.save'),
      fields: fields, onInput: fit,
      onSave: function (v) {
        if (v.kind === 'salary' && !(v.annualGross > 0)) return t('err.needed', { f: t('stream.gross') });
        var rec = isNew ? { id: uid('s'), color: s.color } : s;
        rec.name = v.name; rec.kind = v.kind; rec.active = isNew ? true : v.active;
        rec.annualGross = v.kind === 'salary' ? v.annualGross : 0;
        rec.expectedMonthly = v.kind === 'salary' ? 0 : (v.expectedMonthly || 0);
        if (isNew) state.streams.push(rec);
        commit(isNew ? t('toast.added', { what: rec.name }) : t('toast.saved'));
      },
      deleteLabel: used ? t('stream.deleteWith', { n: used }) : t('btn.delete'),
      onDelete: isNew ? null : function () {
        state.streams = state.streams.filter(function (x) { return x.id !== s.id; });
        state.entries = state.entries.filter(function (e) { if (e.streamId !== s.id) return true; undoCredit(e); return false; });
        commit(t('toast.removedWhat', { what: s.name }));
      }
    });
    fit();
    var nameBox = document.getElementById('f_name'); if (nameBox && !s.name && kind) nameBox.focus();
  }

  function billForm(b, cat) {
    var isNew = !b;
    b = b || { category: cat || 'essential', freq: 'monthly' };
    openForm({
      title: isNew ? (b.category === 'ritual' ? t('bill.newRitual') : t('bill.newEssential')) : b.name,
      fields: [
        { key: 'name', label: t('stream.name'), type: 'text', value: b.name, required: true, full: true },
        { key: 'amount', label: t('entry.amount'), type: 'money', value: b.amount, required: true },
        { key: 'freq', label: t('bill.freq'), type: 'select', value: b.freq, options: FREQ.map(function (f) { return [f, t('freq.' + f)]; }) },
        { key: 'category', label: t('bill.kind'), type: 'select', value: b.category, options: [['essential', t('cat.essential')], ['ritual', t('cat.ritual')]] },
        { key: 'day', label: t('bill.day'), type: 'number', value: b.day || '', step: 1, min: 1, max: 31, hint: t('bill.dayHint') }
      ],
      onSave: function (v) {
        var rec = isNew ? { id: uid('b') } : b;
        rec.name = v.name; rec.amount = v.amount || 0; rec.freq = v.freq; rec.category = v.category; rec.day = v.day ? Math.round(v.day) : null;
        if (isNew) state.bills.push(rec);
        commit(t('toast.saved'));
      },
      onDelete: isNew ? null : function () { state.bills = state.bills.filter(function (x) { return x.id !== b.id; }); commit(t('toast.removed')); }
    });
  }

  function goalForm(g) {
    var isNew = !g; g = g || {};
    openForm({
      title: isNew ? t('goal.newTitle') : g.name,
      fields: [
        { key: 'name', label: t('stream.name'), type: 'text', value: g.name, required: true, full: true, placeholder: t('goal.namePh') },
        { key: 'target', label: t('goal.target'), type: 'money', value: g.target, required: true },
        { key: 'saved', label: t('goal.saved'), type: 'money', value: g.saved || 0 },
        { key: 'monthly', label: t('goal.monthly'), type: 'money', value: g.monthly || 0 }
      ],
      onSave: function (v) {
        var rec = isNew ? { id: uid('g') } : g;
        rec.name = v.name; rec.target = v.target || 0; rec.saved = v.saved || 0; rec.monthly = v.monthly || 0;
        if (isNew) state.goals.push(rec);
        commit(t('toast.saved'));
      },
      onDelete: isNew ? null : function () { state.goals = state.goals.filter(function (x) { return x.id !== g.id; }); commit(t('toast.removed')); }
    });
  }

  function chase(e) {
    var first = (e.client || '').split(/[\s,]/)[0] || t('chase.there');
    var text = t('chase.text', { name: first, amt: fmt(e.amount), date: dLong(e.due) });
    openModal('<div class="mh"><h3>' + esc(t('chase.title', { client: e.client || t('chase.thisInvoice') })) + '</h3>' + closeBtn() + '</div>' +
      '<p class="small muted" style="margin:0">' + esc(t('chase.note')) + '</p>' +
      '<textarea id="chase_text">' + esc(text) + '</textarea>' +
      '<div class="row end"><button class="btn ghost" data-close>' + esc(t('btn.close')) + '</button><button class="btn" data-act="copy" data-target="chase_text">' + esc(t('btn.copy')) + '</button></div>');
  }

  // Spreadsheet download: the viewer's save prompt when the page is hosted, a plain browser download otherwise.
  function exportSheets() {
    return window.SwellExport.buildSheets(state, E.computeAll(state, today), { t: t, E: E, today: today, split: splitOpts(),
      name: state.settings.planName || GENERIC_NAME, country: P.code, currency: currencyCode() });
  }
  function saveFile(filename, data, mime) {
    var label = filename.split('.').pop().toUpperCase();
    var plain = function () {
      var url = URL.createObjectURL(new Blob([data], { type: mime })), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast(t('toast.downloaded', { what: label }));
    };
    var host = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads') : Promise.resolve(null);
    return host.then(function (dl) {
      if (!dl) return plain();
      return dl.save({ filename: filename, data: new Blob([data], { type: mime }) }).then(function () { toast(t('toast.downloaded', { what: label })); });
    }).catch(function (e) {
      if (e && e.code === 'declined') return;
      console.warn('Download failed', e && e.code);
      toast(t('toast.dlFailed'));
    });
  }
  function exportName(ext) { return (state.settings.planName || GENERIC_NAME).replace(/[\\\/:*?"<>|]/g, ' ').trim() + ' ' + today + '.' + ext; }

  function copyFrom(id) {
    var el = document.getElementById(id); if (!el) return;
    var done = function () { toast(t('toast.copied')); };
    var fallback = function () { el.focus(); el.select(); toast(t('toast.selected')); };
    try { navigator.clipboard.writeText(el.value).then(done, fallback); } catch (e) { fallback(); }
  }

  // Switching country or language: the example follows along; your own figures keep their numbers.
  function sampleKeepingName(code, l) {
    var name = state.settings.planName, next = E.normalise(window.SwellSample(code, l, today));
    next.settings.planName = name;
    next.settings.onboarded = state.settings.onboarded;
    next.settings.toured = state.settings.toured;
    next.settings.currency = code === state.settings.country ? state.settings.currency : '';
    return next;
  }
  function setCountry(code) {
    if (code === state.settings.country) return;
    if (needsWelcome(state)) { state.settings.country = code; state.settings.region = ''; state.settings.currency = ''; state = E.normalise(state); commit('', true); return; }
    if (state.sample && !state.edited) { state = sampleKeepingName(code, lang); commit(t('toast.country', { c: t('country.' + code) }), true); return; }
    var C = E.Countries.get(code), tr = I18N.make(lang, code);
    openForm({
      title: t('place.confirmTitle', { c: t('country.' + code) }), submit: t('place.confirmGo'),
      intro: esc(t('place.confirmBody', { cur: C.currency, year: tr.t('term.YEAR'), c: t('country.' + code) })), fields: [],
      onSave: function () { state.settings.country = code; state.settings.region = ''; state.settings.currency = ''; state = E.normalise(state); commit(t('toast.country', { c: t('country.' + code) })); }
    });
  }
  function setLang(l) {
    if (l === lang) return;
    if (state.sample && !state.edited) { var region = state.settings.region; state = sampleKeepingName(state.settings.country, l); state.settings.region = region; }
    else state.settings.lang = l;
    commit('', true);
  }

  var handlers = {
    'smoothing': function (b) { state.settings.smoothing = b.dataset.v; commit('', true); },
    'pay-self': function () {
      var c = E.computeAll(state, today), amt = c.sts.sideSmoothed;
      state.balances.reservoir = E.round2(Number(state.balances.reservoir) - amt);
      state.settings.lastDraw = E.monthKey(today);
      commit(t('toast.paySelf', { amt: fmt(amt) }));
    },
    'contribute': function () {
      var held = Number(state.balances.retHeld) || 0;
      openForm({ title: t('ret.logTitle'), submit: t('btn.logPayment'), intro: esc(t('ret.logIntro')), fields: [{ key: 'amt', label: t('pay.amount'), type: 'money', value: held, required: true }],
        onSave: function (v) {
          state.balances.reservoir = E.round2(Number(state.balances.reservoir) - v.amt);
          state.balances.retHeld = E.round2(Math.max(0, held - v.amt));
          commit(t('toast.logged', { what: fmt(v.amt) }));
        } });
    },
    'inv-filter': function (b) { invoiceFilter = b.dataset.v; render(); },
    'set-country': function (b) { setCountry(b.dataset.v); },
    'set-lang': function (b) { setLang(b.dataset.v); },
    'ob-start': function () { state.settings.onboarded = true; view = 'today'; commit('', true); window.scrollTo(0, 0); },
    'hide-steps': function () { state.settings.stepsHidden = true; commit('', true); },
    'tour-start': function () { startTour(); },
    'tour-next': function () { if (tourStep >= tourSteps().length - 1) endTour(); else showTour(tourStep + 1); },
    'tour-prev': function () { if (tourStep > 0) showTour(tourStep - 1); },
    'tour-end': function () { endTour(); },
    'ob-sample': function () { state.settings.onboarded = true; state = sampleKeepingName(state.settings.country, lang); view = 'today'; commit('', true); window.scrollTo(0, 0); },
    'add-entry': function () { entryForm(null); },
    'edit-entry': function (b) { var e = findEntry(b.dataset.id); if (e) entryForm(e); },
    'mark-paid': function (b) { var e = findEntry(b.dataset.id); if (e) markPaid(e); },
    'to-invoice': function (b) {
      var e = findEntry(b.dataset.id); if (!e) return;
      e.stage = 'invoiced'; e.issued = today;
      if (!e.due || e.due < today) e.due = addDays(today, 14);
      commit(t('toast.invoiced', { date: dShort(e.due) }));
    },
    'vault-entry': function (b) {
      var e = findEntry(b.dataset.id); if (!e) return;
      var x = E.splitPayment(e.amount, splitOpts()), amt = E.round2(x.tax + x.gst), cr = e.credit || { res: 0, vault: 0, ret: 0 };
      state.balances.taxVault = E.round2(Number(state.balances.taxVault) + amt); e.vaulted = true;
      if (cr.res > 0 && !cr.vault) { // the whole payment went to the reservoir; this is the tax moving out of it
        state.balances.reservoir = E.round2(Number(state.balances.reservoir) - amt); cr.res = E.round2(cr.res - amt);
      }
      cr.vault = amt; e.credit = cr;
      commit(t('toast.vault', { amt: fmt(amt) }));
    },
    'chase': function (b) { var e = findEntry(b.dataset.id); if (e) chase(e); },
    'copy': function (b) { copyFrom(b.dataset.target); },
    'add-stream': function () { streamForm(null); },
    'edit-stream': function (b) { var s = E.streamById(state, b.dataset.id); if (s) streamForm(s); },
    'add-bill': function (b) { billForm(null, b.dataset.v); },
    'edit-bill': function (b) { var x = state.bills.find(function (y) { return y.id === b.dataset.id; }); if (x) billForm(x); },
    'add-goal': function () { goalForm(null); },
    'edit-goal': function (b) { var g = state.goals.find(function (y) { return y.id === b.dataset.id; }); if (g) goalForm(g); },
    'goal-add': function (b) {
      var g = state.goals.find(function (y) { return y.id === b.dataset.id; }); if (!g) return;
      openForm({ title: g.name, submit: t('btn.add'), fields: [{ key: 'amt', label: t('entry.amount'), type: 'money', value: g.monthly || '', required: true }],
        onSave: function (v) { g.saved = E.round2((Number(g.saved) || 0) + v.amt); commit(t('toast.goalAdd', { amt: fmt(v.amt), what: g.name })); } });
    },
    'del-spend': function (b) { state.spends = state.spends.filter(function (p) { return p.id !== b.dataset.id; }); commit(t('toast.removed')); },
    'edit-balances': function () {
      openForm({ title: t('bal.formTitle'), fields: [
        { key: 'reservoir', label: t('bal.reservoir'), type: 'money', value: state.balances.reservoir, min: -1e9 },
        { key: 'taxVault', label: t('bal.vault'), type: 'money', value: state.balances.taxVault },
        { key: 'taxPaid', label: t('bal.paid'), type: 'money', value: state.balances.taxPaid }],
        onSave: function (v) { state.balances.reservoir = v.reservoir || 0; state.balances.taxVault = v.taxVault || 0; state.balances.taxPaid = v.taxPaid || 0; state.settings.balancesSet = true; commit(t('toast.balances')); } });
    },
    'pay-tax': function () {
      var c = E.taxPlan(state, today);
      openForm({ title: t('pay.title'), submit: t('btn.logPayment'),
        intro: esc(t('pay.intro')),
        fields: [{ key: 'amt', label: t('pay.amount'), type: 'money', value: c.quarterlyInstalment, required: true }, { key: 'fromVault', label: t('pay.fromVault'), type: 'checkbox', value: true }],
        onSave: function (v) {
          state.balances.taxPaid = E.round2(Number(state.balances.taxPaid) + v.amt);
          if (v.fromVault) state.balances.taxVault = E.round2(Math.max(0, Number(state.balances.taxVault) - v.amt));
          commit(t('toast.taxPaid', { amt: fmt(v.amt) }));
        } });
    },
    'move-surplus': function () {
      var c = E.computeAll(state, today), r = c.res;
      if (r.surplus <= 0) { toast(t('toast.noSurplus')); return; }
      var open = state.goals.filter(function (g) { return Number(g.saved) < Number(g.target); });
      // Goals only take what they still need; anything over goes to Future, and the sheet shows that up front.
      var room = open.reduce(function (t0, g) { return t0 + Math.max(0, g.target - g.saved); }, 0);
      var toGoals = Math.min(r.split.goals, room), toFuture = E.round2(r.split.future + r.split.goals - toGoals);
      openForm({ title: t('surplus.title', { amt: fmt(r.surplus) }), submit: t('surplus.submit'),
        intro: esc(t('surplus.intro')),
        extra: '<div class="stats" style="margin-top:14px">' + stat(esc(t('flow.future')), fmt(toFuture), esc(t('surplus.future'))) +
          stat(esc(t('flow.goals')), fmt(toGoals), esc(open.length ? t('surplus.goalsN', { n: open.length }) : t('surplus.goalsNone'))) +
          stat(esc(t('flow.joy')), fmt(r.split.joy), esc(t('surplus.joy'))) + '</div>',
        fields: [],
        onSave: function () {
          state.balances.reservoir = E.round2(Number(state.balances.reservoir) - r.surplus);
          if (open.length) { // share across open goals, never past a goal's target; any remainder goes to future
            var pool = toGoals;
            open.slice().sort(function (a, b) { return (a.target - a.saved) - (b.target - b.saved); }).forEach(function (g, i, arr) {
              var share = pool / (arr.length - i), give = Math.min(share, Math.max(0, g.target - g.saved));
              g.saved = E.round2(Number(g.saved) + give); pool -= give;
            });
          }
          commit(t('toast.surplus', { amt: fmt(r.split.joy) }));
        } });
    },
    'hide-note': function (btn) {
      var n = btn.closest('.note'); setNoteHidden(true);
      var done = function () { render(); var sn = document.querySelector('[data-act="show-note"]'); if (sn) sn.focus({ preventScroll: true }); };
      if (!n || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
      n.classList.add('closing'); setTimeout(done, 440);
    },
    'show-note': function () { setNoteHidden(false); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    'start-fresh': function () {
      openForm({ title: state.sample ? t('fresh.titleSample') : t('fresh.title'), submit: state.sample ? t('fresh.submitSample') : t('fresh.submit'),
        intro: esc(state.sample ? t('fresh.introSample') : t('fresh.intro')),
        fields: [],
        onSave: function () {
          var wasSample = state.sample;
          var keep = { country: state.settings.country, currency: state.settings.currency, onboarded: wasSample, toured: wasSample && state.settings.toured, lang: state.settings.lang, planName: state.settings.planName, region: state.settings.region };
          state = E.normalise({ v: 1, sample: false, settings: keep }); view = 'today'; commit(t('toast.fresh'));
        } });
    },
    'load-sample': function () {
      openForm({ title: t('sample.title'), submit: t('sample.submit'), intro: esc(t('sample.intro')), fields: [],
        onSave: function () { state = sampleKeepingName(state.settings.country, lang); commit(t('toast.sample'), true); } });
    },
    'dl-xlsx': function () { saveFile(exportName('xlsx'), window.SwellExport.toXLSX(exportSheets()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); },
    'dl-csv': function () { saveFile(exportName('csv'), window.SwellExport.toCSV(exportSheets(), { german: lang === 'de' }), 'text/csv;charset=utf-8'); },
    'export': function () {
      openModal('<div class="mh"><h3>' + esc(t('export.title')) + '</h3>' + closeBtn() + '</div>' +
        '<p class="small muted" style="margin:0">' + esc(t('export.note')) + '</p>' +
        '<textarea id="export_text" readonly>' + esc(JSON.stringify(state)) + '</textarea>' +
        '<div class="row end"><button class="btn ghost" data-close>' + esc(t('btn.close')) + '</button><button class="btn" data-act="copy" data-target="export_text">' + esc(t('btn.copy')) + '</button></div>');
    },
    'import': function () {
      openForm({ title: t('import.title'), submit: t('import.submit'), intro: esc(t('import.intro')), fields: [{ key: 'json', label: t('import.label'), type: 'textarea', full: true, required: true }],
        onSave: function (v) {
          var s;
          try { s = JSON.parse(v.json); } catch (e) { return t('import.bad'); }
          if (!s || typeof s !== 'object' || !Array.isArray(s.streams) || !Array.isArray(s.entries) || !s.settings || typeof s.settings !== 'object') return t('import.bad');
          s = E.normalise(s);
          var errs = E.validateState(s);
          if (errs.length) return t('import.problems', { list: errs.slice(0, 3).join(', ') });
          state = s; commit(t('toast.restored'));
        } });
    }
  };

  // ---------- events ----------
  document.addEventListener('click', function (ev) {
    var tg0 = ev.target;
    var tab = tg0.closest('[data-tab]'); if (tab) { go(tab.dataset.tab); return; }
    var tg = tg0.closest('[data-tab-go]'); if (tg) { go(tg.dataset.tabGo); return; }
    if (tg0.closest('[data-close]') || (tg0.hasAttribute && tg0.hasAttribute('data-scrim') && downOnScrim)) { closeModal(); return; }
    var del = tg0.closest('[data-del]'); if (del && modalState && modalState.del) { modalState.del(del); return; }
    var a = tg0.closest('[data-act]');
    if (a && handlers[a.dataset.act]) { ev.preventDefault(); handlers[a.dataset.act](a); }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (f.matches('[data-form]')) { ev.preventDefault(); if (modalState && modalState.submit) modalState.submit(); return; }
    if (f.matches('[data-form-inline="spend"]')) {
      ev.preventDefault();
      var amt = parseNum(document.getElementById('sp_amt').value), err = document.getElementById('sp_err');
      if (!(amt > 0)) { err.textContent = t('err.spend', { amt: fmt(0) }); err.hidden = false; return; }
      state.spends.push({ id: uid('p'), date: today, amount: E.round2(amt), label: document.getElementById('sp_label').value.trim(), kind: document.getElementById('sp_kind').value });
      commit(t('toast.logged', { what: fmt(amt) }));
      var n = document.getElementById('sp_amt'); if (n) n.focus();
    }
  });
  document.addEventListener('mousedown', function (ev) { downOnScrim = !!(ev.target.hasAttribute && ev.target.hasAttribute('data-scrim')); });
  document.addEventListener('keydown', function (ev) {
    if (!modalState) return;
    if (ev.key === 'Escape') { closeModal(); return; }
    if (ev.key === 'Tab') { // keep focus inside the dialog
      var f = [].slice.call(document.querySelectorAll('.modal button, .modal input, .modal select, .modal textarea')).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
  function flushNow() { if (Store.mode === 'cloud' && Store.timer) { clearTimeout(Store.timer); Store.timer = null; flushCloud(); } }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushNow(); });
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (modalState && modalState.input && el.closest('.modal')) { modalState.input(); return; }
    if (el.id === 'f_plan_name') { showName(el.value); return; }
    if (el.id === 'split_amt') {
      splitAmount = Math.max(0, parseNum(el.value) || 0);
      var out = document.getElementById('split_out'); if (out) out.innerHTML = splitHTML(E.splitPayment(splitAmount, splitOpts()));
      return;
    }
    if (/^f_flow_/.test(el.id)) {
      var note = document.getElementById('flow_note');
      if (note) note.textContent = flowNote({ future: val('f_flow_future'), goals: val('f_flow_goals'), joy: val('f_flow_joy') });
    }
  });
  function val(id) { var el = document.getElementById(id); return el ? Math.max(0, parseNum(el.value) || 0) : 0; }
  // Settings fields save on change (not on every keystroke).
  document.addEventListener('change', function (ev) {
    var el = ev.target, id = el.id;
    if (el.closest('.modal')) return;
    if (el.hasAttribute('data-num') && !isFinite(parseNum(el.value))) { render(); toast(t('toast.leftAsIs')); return; }
    if (id === 'f_set_currency') { state.settings.currency = el.value === E.profile(state).currency ? '' : el.value; commit(needsWelcome(state) ? '' : t('toast.saved'), true); return; }
    var n = function () { return parseNum(el.value); };
    var map = {
      f_bal_reservoir: function () { state.balances.reservoir = n(); },
      f_bal_taxVault: function () { state.balances.taxVault = Math.max(0, n()); },
      f_bal_taxPaid: function () { state.balances.taxPaid = Math.max(0, n()); },
      f_plan_name: function () { state.settings.planName = el.value.trim().slice(0, 60); },
      f_set_gst: function () { state.settings.gstRegistered = el.checked; },
      f_set_private: function () { state.settings.privateHospital = el.checked; },
      f_set_church: function () { state.settings.churchTax = el.value; },
      f_set_children: function () { state.settings.hasChildren = el.checked; },
      f_set_scotland: function () { state.settings.scotland = el.checked; },
      f_set_region: function () { state.settings.region = el.value; },
      f_set_regionrate: function () { state.settings.regionRate = Math.min(15, Math.max(0, n())); },
      f_set_super: function () { state.settings.superTopUpPct = Math.min(50, Math.max(0, n())); },
      f_set_exp: function () { state.settings.businessExpenses = Math.max(0, n()); },
      f_flow_future: function () { state.settings.flowRules.future = Math.min(100, Math.max(0, n())); },
      f_flow_goals: function () { state.settings.flowRules.goals = Math.min(100, Math.max(0, n())); },
      f_flow_joy: function () { state.settings.flowRules.joy = Math.min(100, Math.max(0, n())); },
      f_buffer_months: function () { state.settings.bufferMonths = Math.min(24, Math.max(1, Math.round(n()) || 1)); }
    };
    if (map[id]) { map[id](); commit(t('toast.saved'), id === 'f_plan_name' || id === 'f_set_region'); }
  });

  // ---------- boot ----------
  // First visit: start in the visitor's own language and the closest supported country.
  function firstRun() {
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    var l = /^de\b/i.test(nav) ? 'de' : 'en';
    var region = (nav.split('-')[1] || '').toUpperCase(), tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* older browser */ }
    var known = { AU: 'AU', NZ: 'AU', US: 'US', CA: 'CA', GB: 'GB', UK: 'GB', IE: 'GB', DE: 'DE', CH: 'DE', AT: 'AT' };
    var country = known[region] || (l === 'de' ? 'DE' : /^Australia/.test(tz) ? 'AU' : /^Europe\/London/.test(tz) ? 'GB' : /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|Montreal)/.test(tz) ? 'CA' : /^America/.test(tz) ? 'US' : 'AU');
    return E.normalise({ v: 1, sample: false, settings: { country: country, lang: l } });
  }
  state = loadLocal();
  if (!state) state = firstRun();
  else if (state.sample && !state.edited) { // an untouched example always shows this month
    var was = state.settings, nextS = E.normalise(window.SwellSample(was.country, was.lang, today));
    nextS.settings.planName = was.planName; nextS.settings.region = was.region || nextS.settings.region;
    nextS.settings.currency = was.currency; nextS.settings.onboarded = was.onboarded; nextS.settings.toured = was.toured;
    state = nextS;
  }
  var h = (location.hash || '').replace('#', '');
  if (TABS.indexOf(h) >= 0) view = h;
  var tabsEl = document.querySelector('nav.tabs');
  // On narrow screens the tab row scrolls; fade whichever edge still hides tabs.
  function tabEdges() {
    tabsEl.classList.toggle('from-left', tabsEl.scrollLeft > 2);
    tabsEl.classList.toggle('at-end', tabsEl.scrollLeft + tabsEl.clientWidth >= tabsEl.scrollWidth - 2);
  }
  render();
  window.addEventListener('hashchange', function () { var x = (location.hash || '').replace('#', ''); if (TABS.indexOf(x) >= 0 && x !== view) go(x); });
  tabsEl.addEventListener('scroll', tabEdges, { passive: true });
  window.addEventListener('resize', tabEdges);
  // Once the nameplate scrolls away, the rail darkens its rule and carries a small wordmark.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { document.getElementById('rail').classList.toggle('stuck', !en[0].isIntersecting); })
      .observe(document.querySelector('.mast'));
  }
  initCloud();
})();
