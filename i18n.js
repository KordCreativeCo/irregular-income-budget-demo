/* Swell strings. Lookup order: "key@COUNTRY" in the language, then "key", then English.
   {name} placeholders take params; {VAT}, {AUTH}, {RET}, {INST}, {YEAR}… take the country's own terms.
   A value can be { one, other } and is chosen by params.n. HTML is allowed only in strings used with th(). */
var SwellI18n = (function () {
  'use strict';

  var terms = {
    en: {
      AU: { VAT: 'GST', AUTH: 'the ATO', AUTHN: 'ATO', RET: 'super', RETC: 'Super', INST: 'PAYG instalments', INSTC: 'PAYG instalments', INST1: 'PAYG instalment', YEAR: 'FY2026-27', YEARW: 'financial year', SAL: 'PAYG salary', SELF: 'ABN · freelance' },
      DE: { VAT: 'VAT', AUTH: 'the Finanzamt', AUTHN: 'Finanzamt', RET: 'Rürup pension', RETC: 'Pension', INST: 'tax prepayments', INSTC: 'Tax prepayments', INST1: 'Tax prepayment', YEAR: 'Tax year 2026', YEARW: 'tax year', SAL: 'Employed salary', SELF: 'Freelance (Freiberuf)' },
      AT: { VAT: 'VAT', AUTH: 'the Finanzamt', AUTHN: 'Finanzamt', RET: 'pension savings', RETC: 'Pension', INST: 'tax prepayments', INSTC: 'Tax prepayments', INST1: 'Tax prepayment', YEAR: 'Tax year 2026', YEARW: 'tax year', SAL: 'Employed salary', SELF: 'Neue Selbständige' },
      GB: { VAT: 'VAT', AUTH: 'HMRC', AUTHN: 'HMRC', RET: 'pension', RETC: 'Pension', INST: 'payments on account', INSTC: 'Payments on account', INST1: 'Payment on account', YEAR: 'Tax year 2026/27', YEARW: 'tax year', SAL: 'PAYE salary', SELF: 'Self-employed' },
      US: { VAT: 'Sales tax', AUTH: 'the IRS', AUTHN: 'IRS', RET: 'SEP-IRA', RETC: 'Retirement', INST: 'estimated tax payments', INSTC: 'Estimated taxes', INST1: 'Estimated tax payment', YEAR: 'Tax year 2026', YEARW: 'tax year', SAL: 'W-2 salary', SELF: '1099 · self-employed' },
      CA: { VAT: 'GST/HST', AUTH: 'the CRA', AUTHN: 'CRA', RET: 'RRSP', RETC: 'RRSP', INST: 'tax instalments', INSTC: 'Tax instalments', INST1: 'Tax instalment', YEAR: 'Tax year 2026', YEARW: 'tax year', SAL: 'T4 salary', SELF: 'Self-employed' }
    },
    de: {
      AU: { VAT: 'GST', AUTH: 'das ATO', AUTHN: 'ATO', RET: 'Super', RETC: 'Super', INST: 'PAYG-Vorauszahlungen', INSTC: 'PAYG-Vorauszahlungen', INST1: 'PAYG-Vorauszahlung', YEAR: 'Steuerjahr 2026/27', YEARW: 'Steuerjahr', SAL: 'Gehalt (PAYG)', SELF: 'ABN · freiberuflich' },
      DE: { VAT: 'USt', AUTH: 'das Finanzamt', AUTHN: 'Finanzamt', RET: 'Rürup-Rente', RETC: 'Vorsorge', INST: 'Vorauszahlungen', INSTC: 'Vorauszahlungen', INST1: 'Vorauszahlung', YEAR: 'Steuerjahr 2026', YEARW: 'Steuerjahr', SAL: 'Angestellt', SELF: 'Freiberuflich' },
      AT: { VAT: 'USt', AUTH: 'das Finanzamt', AUTHN: 'Finanzamt', RET: 'Zukunftsvorsorge', RETC: 'Vorsorge', INST: 'Vorauszahlungen', INSTC: 'Vorauszahlungen', INST1: 'Vorauszahlung', YEAR: 'Steuerjahr 2026', YEARW: 'Steuerjahr', SAL: 'Angestellt', SELF: 'Neue Selbständige' },
      GB: { VAT: 'VAT', AUTH: 'HMRC', AUTHN: 'HMRC', RET: 'Pension', RETC: 'Pension', INST: 'Vorauszahlungen (payments on account)', INSTC: 'Vorauszahlungen', INST1: 'Vorauszahlung', YEAR: 'Steuerjahr 2026/27', YEARW: 'Steuerjahr', SAL: 'Angestellt (PAYE)', SELF: 'Selbständig' },
      US: { VAT: 'Sales Tax', AUTH: 'der IRS', AUTHN: 'IRS', RET: 'SEP-IRA', RETC: 'Vorsorge', INST: 'Vorauszahlungen (estimated taxes)', INSTC: 'Vorauszahlungen', INST1: 'Vorauszahlung', YEAR: 'Steuerjahr 2026', YEARW: 'Steuerjahr', SAL: 'Angestellt (W-2)', SELF: 'Selbständig (1099)' },
      CA: { VAT: 'GST/HST', AUTH: 'die CRA', AUTHN: 'CRA', RET: 'RRSP', RETC: 'RRSP', INST: 'Vorauszahlungen (instalments)', INSTC: 'Vorauszahlungen', INST1: 'Vorauszahlung', YEAR: 'Steuerjahr 2026', YEARW: 'Steuerjahr', SAL: 'Angestellt (T4)', SELF: 'Selbständig' }
    }
  };

  var dict = { en: {
    'tagline': 'steady money, irregular income',
    'tab.today': 'Today', 'tab.income': 'Money in', 'tab.vault': 'Tax vault', 'tab.plan': 'Spending', 'tab.setup': 'Settings',
    'foot.rates': '{YEAR} rates · planning tool, not tax advice',
    'foot.maker': 'A Kord Creative Co. product', 'foot.showNote': 'Example figures · show note',
    'store.failed': 'Couldn’t reach your private space · saved in this browser', 'store.cloud': 'Saved to your private space', 'store.local': 'Saved in this browser',
    'country.AU': 'Australia', 'country.DE': 'Germany', 'country.AT': 'Austria', 'country.GB': 'United Kingdom', 'country.US': 'United States', 'country.CA': 'Canada',
    'term.VAT': '{VAT}', 'term.RETC': '{RETC}', 'term.INSTC': '{INSTC}', 'term.YEAR': '{YEAR}',

    'when.today': 'today', 'when.tomorrow': 'tomorrow', 'when.ago': { one: '{n} day ago', other: '{n} days ago' }, 'when.in': { one: 'in {n} day', other: 'in {n} days' },
    'kind.salary': '{SAL}', 'kind.abn': '{SELF}', 'kind.other': 'Other income',
    'stage.pipeline': 'Likely', 'stage.invoiced': 'Invoiced', 'stage.overdue': 'Overdue', 'stage.paid': 'Paid',
    'mood.lean': 'Lean', 'mood.steady': 'Steady', 'mood.flow': 'Flow',
    'pill.tax': 'Tax', 'pill.action': 'Action', 'pill.heads': 'Heads up', 'pill.surplus': 'Surplus',
    'upk.tax': 'tax', 'upk.super': '{RET}', 'upk.overdue': 'overdue', 'upk.invoice': 'money in', 'upk.bill': 'bill',
    'cat.essential': 'Essential', 'cat.essentials': 'Essentials', 'cat.ritual': 'Ritual', 'cat.rituals': 'Rituals', 'cat.everyday': 'Everyday', 'cat.goals': 'Goals',
    'freq.weekly': 'Weekly', 'freq.fortnightly': 'Fortnightly', 'freq.monthly': 'Monthly', 'freq.quarterly': 'Quarterly', 'freq.annual': 'Yearly',
    'per.weekly': 'a week', 'per.fortnightly': 'a fortnight', 'per.monthly': 'a month', 'per.quarterly': 'a quarter', 'per.annual': 'a year', 'per.mo': '/mo',
    'colour.ink': 'Ink', 'colour.sea': 'Sea', 'colour.sand': 'Sand', 'colour.rose': 'Rose',
    'misc.unassigned': 'Unassigned', 'misc.aPayment': 'a payment', 'misc.anInvoice': 'An invoice', 'misc.invoice': 'Invoice', 'misc.untitled': 'Untitled',

    'btn.close': 'Close', 'btn.cancel': 'Cancel', 'btn.save': 'Save', 'btn.delete': 'Delete', 'btn.deleteAgain': 'Tap again to delete', 'btn.done': 'Done',
    'btn.nudgeLong': 'Write a nudge', 'btn.nudge': 'Nudge', 'btn.logPayment': 'Log payment', 'btn.update': 'Update', 'btn.why': 'See why', 'btn.details': 'Details',
    'btn.forecast': 'Forecast', 'btn.splitIt': 'Split it', 'btn.addStream': 'Add an income stream', 'btn.addStreamShort': 'Add a stream', 'btn.updateBalance': 'Update balance',
    'btn.splitSurplus': 'Split the surplus', 'btn.log': 'Log', 'btn.edit': 'Edit', 'btn.paid': 'Paid', 'btn.invoiced': 'Invoiced', 'btn.logWork': 'Log work or a payment',
    'btn.logTax': 'Log a tax payment', 'btn.editBalances': 'Edit balances', 'btn.addEssential': 'Add an essential', 'btn.addRitual': 'Add a ritual', 'btn.addMoney': 'Add money',
    'btn.addGoal': 'Add a goal', 'btn.clearExample': 'Clear the example and start mine', 'btn.startOver': 'Start over', 'btn.loadExample': 'Load the example',
    'btn.backup': 'Copy a backup', 'btn.restore': 'Restore a backup', 'btn.startOwn': 'Start with my own', 'btn.hide': 'Hide', 'btn.copy': 'Copy', 'btn.add': 'Add',

    'err.needed': '{f} is needed.', 'err.min': '{f} must be {n} or more.', 'err.max': '{f} must be {n} or less.', 'err.date': '{f} isn’t a valid date.',
    'err.render': 'Something in your data couldn’t be shown.', 'err.paidFuture': 'A paid date can’t be in the future.', 'err.paidDate': 'Add the date it landed.',
    'err.future': 'That date is in the future.', 'err.spend': 'Add an amount above {amt}.',

    'note.title': 'Example planner', 'note.body': 'These figures are made up to show how this planner works: a part-time marketing director with three side streams.',
    'hello.morning': 'Good morning', 'hello.afternoon': 'Good afternoon', 'hello.evening': 'Good evening', 'hello.accent': 'Steady money, whatever the month brings.',
    'empty.start': 'Start with what you earn.', 'empty.startSub': 'Add your salary and each side income stream. This planner works out a steady monthly pay, your personal tax set-aside, and a six-month forecast from there.',

    'sts.left': { one: '<b>{amt}</b> left for the rest of {month}, {n} day. Rituals have {rituals} of their own still set aside.', other: '<b>{amt}</b> left for the rest of {month}, {n} days. Rituals have {rituals} of their own still set aside.' },
    'sts.over': 'You’re <b>{amt}</b> past this month’s plan. The reservoir can cover it, or ease off until the 1st.',
    'sts.estimate': 'Estimated from your expected income (less 30%) until there are 3 months of history.',
    'sts.note.steady': 'Balanced pays you {amt} a month. It sits between your typical month ({avg}) and your worst ({low}) from {from}–{to}.', 'sts.note.average': 'Typical month pays you {amt} a month, your average from {from}–{to} ({avg}). A run of quiet months can dip into your reservoir.', 'sts.note.floor': 'Safest pays you {amt} a month, what your worst month from {from}–{to} earned ({low}). You could keep this up even through a quiet stretch.', 'sts.note.costs': 'Your business costs of {costs} a month are already taken off.',
    'sts.overPlan': 'Over plan', 'sts.low': 'Running low', 'sts.onPlan': 'On plan', 'sts.safe': 'safe to spend this week', 'sts.hold': 'hold spending this week',
    'sts.perDay': '{amt} a day', 'sts.salary': 'Salary', 'sts.salarySub': 'after tax', 'sts.side': 'Side pay', 'sts.sideSub': 'steady, monthly', 'sts.earn': 'You earn', 'sts.earnSub': 'a month, together',
    'sts.salarySub@DE': 'after tax & social', 'sts.salarySub@AT': 'after tax & social', 'sts.salarySub@GB': 'after tax & NI',
    'sts.q': 'How much should you pay yourself each month?', 'sts.m.steady': 'Balanced', 'sts.m.average': 'Typical month', 'sts.m.floor': 'Safest',

    'res.title': 'Reservoir', 'res.label': 'Where side income lands', 'res.bufferN': '{n}-month', 'res.buffer': 'buffer', 'res.toGo': '{amt} to go', 'res.surplus': 'Surplus',
    'res.aria': 'Reservoir holds {held} months of steady side pay against a {n}-month buffer', 'res.ariaSurplus': ', with {amt} surplus', 'res.more': 'and {n} months more',
    'res.months': '{n} months', 'res.monthsSub': 'of steady side pay, with no new work', 'res.noSide': 'Add side income to see how long this lasts',
    'res.covers': 'Your salary covers essentials on its own.', 'res.coversPct': 'Your salary covers {pct} of essentials.',
    'flow.future': 'Future', 'flow.goals': 'Goals', 'flow.joy': 'Joy',

    'todo.title': 'Needs you', 'todo.count': { one: '{n} item', other: '{n} items' }, 'todo.clear': 'All clear.', 'todo.clearSub': 'Nothing needs you right now.',
    'todo.vault': 'Move {amt} to your Tax Vault', 'todo.vaultSub': 'From {client} ({amt}, paid {date})',
    'todo.overdue': { one: '{client} is {n} day overdue', other: '{client} is {n} days overdue' }, 'todo.overdueSub': '{amt} was due {date}', 'todo.usuallyLate': { one: 'they usually pay {n} day late', other: 'they usually pay {n} days late' },
    'todo.inst': '{INST1} due {when}', 'todo.instSub': 'Estimate {amt} at this year’s pace (use {AUTH}’s figure if it differs) · vault holds {vault}',
    'todo.short': 'Tax Vault is {amt} short', 'todo.shortSub': 'Based on side income paid this {YEARW} at your {rate} rate',
    'todo.register': 'Register for {VAT}', 'todo.registerSub': 'Your side income is on track for {amt}, past the {line} line. Register within 21 days of crossing it.',
    'todo.register@DE': 'Kleinunternehmer limit passed', 'todo.registerSub@DE': 'Your side turnover is on track for {amt}, past the {line} line. From 1 January you add 19% VAT to invoices.',
    'todo.register@AT': 'Kleinunternehmer limit passed', 'todo.registerSub@AT': 'Your side turnover is on track for {amt}, past the {line} line. Beyond the 10% tolerance, 20% VAT applies from the invoice that crosses it.',
    'todo.registerSub@GB': 'Your side turnover is on track for {amt}, past the {line} line. Register within 30 days of passing it.',
    'todo.approach': 'Heads up: {pct} of the {VAT} threshold', 'todo.approach@DE': 'Heads up: {pct} of the Kleinunternehmer limit', 'todo.approach@AT': 'Heads up: {pct} of the Kleinunternehmer limit', 'todo.approachSub': 'Projected {amt} this year. At {line} you’ll add {rate} to invoices.',
    'todo.book': 'Book {amt} of work for {month}', 'todo.bookSub': 'That keeps your steady side pay without dipping into the reservoir. It’s counted as take-home, after tax and {RET}.',
    'todo.surplus': 'Flow surplus: {amt} to put to work', 'todo.surplusSub': 'Your reservoir is past its {n}-month buffer.',

    'up.title': 'Coming up', 'up.label': 'Next 60 days', 'up.none': 'Nothing in the next 60 days.',
    'up.overdue': { one: '{client} is {n} day overdue', other: '{client} is {n} days overdue' }, 'up.due': '{client} due', 'up.dueLate': { one: '{client} due (usually lands {n} day late)', other: '{client} due (usually lands {n} days late)' },

    'spend.title': '{month} spending', 'spend.label': 'Rituals are budgeted, not judged', 'spend.amount': '{sym} amount', 'spend.amountAria': 'Amount',
    'spend.what': 'What was it? e.g. Dinner with friends', 'spend.whatAria': 'What was it', 'spend.kind': 'Kind', 'spend.of': 'of {amt}', 'spend.ofRituals': 'of {amt} extra, beyond regulars',
    'spend.spending': 'Spending', 'spend.remove': 'Remove {what}', 'spend.none': 'Log the odd purchase if you like. It never needs every coffee.',

    'fc.title': 'Six-month outlook', 'fc.label': 'Take-home after tax & {RET}',
    'fc.intro': 'Booked work (solid) and likely work weighted by its odds (hatched), against the <b>{amt}</b> you pay yourself from side income each month (the fine line). Invoices are placed where each client usually pays, not on the due date.',
    'fc.k.booked': 'Booked', 'fc.k.likely': 'Likely', 'fc.k.steady': 'Steady side pay', 'fc.k.gap': 'Work to book',
    'fc.foot': 'Under each month: how it looks, and your reservoir at month end. Only work you’ve logged is counted; new work you win fills the gaps.',
    'fc.book': 'Book {amt}', 'fc.soFar': '{amt} so far', 'fc.covered': 'Covered', 'fc.now': 'now',
    'fc.aria': 'Side income over the next six months against {amt} steady side pay a month.', 'fc.ariaLean': { one: '{n} month needs more work booked.', other: '{n} months need more work booked.' }, 'fc.ariaOk': 'Every month is covered.',

    'inc.salarySub': 'a year before tax · {amt} a month after', 'inc.sideSub': 'paid this {YEARW} · expecting about {amt}/mo', 'inc.paused': 'paused',
    'inc.salarySub@AT': 'a year before tax, across 14 payments · {amt} a month after',
    'inc.streams': 'Income streams', 'inc.streamsN': { one: '{n} stream', other: '{n} streams' }, 'inc.noStreams': 'No streams yet.', 'inc.noStreamsSub': 'Add your salary first, then each side income.',
    'inv.title': 'Invoices & work', 'inv.filter': 'Filter', 'inv.f.open': 'Open', 'inv.f.paid': 'Paid', 'inv.f.all': 'All',
    'inv.h.client': 'Client', 'inv.h.amount': 'Amount', 'inv.h.when': 'When', 'inv.h.status': 'Status', 'inv.h.actions': 'Actions',
    'inv.paidOn': 'Paid {date}', 'inv.around': 'Around {date}', 'inv.due': 'Due {date}', 'inv.likely': 'likely {date}', 'inv.yours': '{amt} yours',
    'inv.empty': 'Nothing here.', 'inv.emptySub': 'Log a quote you’re waiting on, an invoice you’ve sent, or a payment that’s landed.',
    'late.title': 'How clients pay', 'late.label': 'Learned from paid invoices', 'late.invoices': { one: '{n} invoice', other: '{n} invoices' },
    'late.days': { one: '{n} day late', other: '{n} days late' }, 'late.onTime': 'On time', 'late.slow': 'slow', 'late.bit': 'a little late', 'late.reliable': 'reliable',
    'late.none': 'Mark a few invoices paid and the planner will learn who pays when.',

    'vault.setAside': 'Set aside', 'vault.every': 'of every side payment', 'vault.everyExVat': 'of every side payment, ex {VAT}',
    'vault.why': 'Your side income sits on top of a <b>{salary}</b> salary, so it’s taxed from your top bracket up, not from zero. On a projected <b>{side}</b> of side profit this year, that’s <b>{tax}</b> your employer isn’t withholding.',
    'vault.why@AT': 'Your side income sits on top of a <b>{salary}</b> salary, so it’s taxed from your top bracket up, not from zero. On a projected <b>{side}</b> of side profit this year, that’s <b>{tax}</b> of income tax and SVS contributions nobody is withholding.',
    'vault.why@GB': 'Your side income sits on top of a <b>{salary}</b> salary, so it’s taxed from your top band up, not from zero. On a projected <b>{side}</b> of side profit this year, that’s <b>{tax}</b> of income tax and Class 4 NI PAYE isn’t collecting.',
    'vault.rule': 'The usual “put aside 25%” rule would leave you about <b>{amt}</b> short.',
    'vault.kSalary': 'Salary {amt}', 'vault.kSide': 'Side profit {amt}', 'vault.stackAria': 'Your salary and side income stacked across the tax brackets',
    'vault.marginal': 'Top marginal rate incl. Medicare: {rate}', 'vault.marginal@DE': 'Marginal rate incl. Soli: {rate}', 'vault.marginal@AT': 'Marginal rate incl. SVS: {rate}', 'vault.marginal@GB': 'Marginal rate incl. Class 4 NI: {rate}',
    'splitc.title': 'Split a payment', 'splitc.label': 'Type any amount', 'splitc.amount': 'Payment received',
    'splitc.note': 'Tax is reserved on the full payment, so business expenses come back to you at tax time as a smaller bill. {RETC} is your {pct} top-up, changeable in Settings.',
    'split.tax': 'Tax', 'split.taxTo': 'to Tax Vault', 'split.retTo': 'future you', 'split.yours': 'Yours', 'split.yoursTo': 'to the reservoir',
    'split.vatTo': 'to {AUTH} each quarter', 'split.vatTo@GB': 'to HMRC each quarter', 'split.vatNone': 'not registered', 'split.vatNone@DE': 'Kleinunternehmer', 'split.vatNone@AT': 'Kleinunternehmer',
    'vc.title': 'The vault', 'vc.label': 'Should hold what you owe so far', 'vc.in': 'In the vault', 'vc.owed': 'Owed so far', 'vc.owedSub': 'on side income paid since {date}, less {paid} already paid',
    'vc.status': 'Status', 'vc.onTrack': 'On track', 'vc.short': '{amt} short', 'vc.ahead': '{amt} ahead',
    'inst.likely': 'Likely for you', 'inst.notYet': 'Probably not yet', 'inst.year': 'Tax on side income this year', 'inst.each4': 'About each quarter', 'inst.each2': 'About each payment',
    'inst.bodyLikely@AU': 'Once your return shows $4,000+ of business income and $1,000+ owing, the ATO usually moves you to quarterly instalments. You then pay this year’s tax as you go, in the same year you might be settling last year’s. If the ATO sends its own instalment amount, use that.',
    'inst.bodyNot@AU': 'Instalments start once you have $4,000+ of business income and $1,000+ owing on your return. Keep filling the vault so the first notice isn’t a shock.',
    'inst.bodyLikely@DE': 'Once an assessment shows €400 or more a year owing, the Finanzamt sets quarterly prepayments, due 10 March, June, September and December. The first notice often asks for last year’s balance at the same time. Once you have the Finanzamt’s figure, use it.',
    'inst.bodyNot@DE': 'The Finanzamt only sets prepayments once at least €400 a year is owing. Side profit over €410 still means filing a return, so keep filling the vault.',
    'inst.bodyLikely@AT': 'After your first assessment, the Finanzamt sets quarterly prepayments due 15 February, May, August and November. SVS contributions arrive separately and are recalculated once your final income is known, often with a top-up bill years later. Keep a little extra in the vault for that.',
    'inst.bodyNot@AT': 'Prepayments start once your assessment shows tax owing. Side income over €730 next to a salary means filing a return, and SVS starts once profit passes €6,613.20 a year.',
    'inst.bodyLikely@GB': 'If your Self Assessment bill is over £1,000 and less than 80% was collected through PAYE, HMRC asks for two payments on account, 31 January and 31 July, each half of last year’s bill. The first January also carries the balancing payment, so year one is the heavy one.',
    'inst.bodyNot@GB': 'Payments on account start once your Self Assessment bill passes £1,000. Side income over the £1,000 trading allowance means registering for Self Assessment by 5 October after the tax year.',
    'inst.mtd': 'Making Tax Digital quarterly updates apply once self-employed turnover passes £50,000 (from April 2026), £30,000 (from April 2027) or £20,000 (from April 2028).',
    'vat.title': '{VAT} threshold', 'vat.title@DE': 'Kleinunternehmer limit', 'vat.title@AT': 'Kleinunternehmer limit', 'vat.registered': 'Registered', 'vat.registered@DE': 'Not a Kleinunternehmer', 'vat.registered@AT': 'Not a Kleinunternehmer', 'vat.line': '{amt} a year',
    'vat.regBody': 'You’re registered, so the planner carves the {rate} {VAT} share out of each payment before anything else.',
    'vat.lv.register': 'register now', 'vat.lv.approaching': 'approaching', 'vat.lv.clear': 'clear',
    'vat.lv.register@DE': 'limit passed', 'vat.lv.register@AT': 'limit passed',
    'vat.body@AU': 'Last 12 months: {last}. This financial year, projected: {proj}. You must register within 21 days of expecting to reach {line}. From then on, add 10% to invoices. It’s the client’s cost, not yours, but it changes your quotes.',
    'vat.body@DE': 'Last 12 months: {last}. This year, projected: {proj}. As a Kleinunternehmer you charge no VAT while last year’s turnover stayed under {line} and this year’s stays under {cap}. Pass {line} this year and you add 19% from 1 January; pass {cap} and it starts at once.',
    'vat.body@AT': 'Last 12 months: {last}. This year, projected: {proj}. Kleinunternehmer charge no VAT up to {line} gross a year. Go over by up to 10% and the exemption lasts to year end; beyond that, 20% applies from the invoice that crosses the line.',
    'vat.body@GB': 'Last 12 months: {last}. This tax year, projected: {proj}. Register within 30 days once your rolling 12-month turnover passes {line}, or straight away if you expect to pass it in the next 30 days alone. Then add 20% to invoices.',
    'ret.title': 'Super on side income', 'ret.title@DE': 'Rürup pension on side income', 'ret.title@AT': 'Pension savings on side income', 'ret.title@GB': 'Pension on side income',
    'ret.label': 'Concessional cap {cap}', 'ret.label@DE': 'Deductible up to {cap}', 'ret.label@AT': 'State premium on up to {cap}', 'ret.label@GB': 'Annual allowance {cap}',
    'ret.employer': 'Employer pays', 'ret.employerSub': '{pct} of salary', 'ret.topup': 'Your top-up', 'ret.topupSub': '{pct} of side income', 'ret.room': 'Cap room left', 'ret.overCap': 'Over cap', 'ret.premium': 'State premium',
    'ret.body@AU': 'No one pays super on freelance work. An employer would have paid about <b>{missed}</b> on yours. If you claim your top-up as a deduction (lodge a notice of intent with your fund first), it’s taxed at 15% instead of your {rate}, saving roughly <b>{saving}</b>.',
    'ret.body@DE': 'No one pays into a pension for freelance work. Your statutory pension contributions (<b>{used}</b> with your employer’s share) already count towards the {cap} Basisrente limit. Rürup contributions are fully deductible, so your top-up saves roughly <b>{saving}</b> at your {rate} marginal rate. The money stays locked until retirement.',
    'ret.body@AT': 'Once profit passes €6,613.20, SVS takes 18.5% for your state pension, so side work already builds one. On top of that, prämienbegünstigte Zukunftsvorsorge adds a 4.25% state premium on up to {cap} a year: about <b>{saving}</b> on your top-up.',
    'ret.body@GB': 'No employer pays into a pension on freelance work. Personal contributions get tax relief at your top rates, so your top-up saves roughly <b>{saving}</b> in income tax. Your provider adds basic-rate relief; claim the rest through Self Assessment.',
    'dates.title': 'Tax calendar', 'dates.past': 'past',

    'date.au_q1': 'Q1 PAYG instalment / BAS due', 'date.au_q2': 'Q2 PAYG instalment / BAS due', 'date.au_q3': 'Q3 PAYG instalment / BAS due', 'date.au_q4': 'Q4 PAYG instalment / BAS due',
    'date.au_return': 'FY25-26 tax return due (self-lodged)', 'date.au_super': 'Personal super contribution: send by mid-June so it lands before 30 June', 'date.au_eofy': 'End of financial year',
    'date.de_vz': 'Income tax prepayment due', 'date.de_return25': '2025 tax return due (without an adviser)', 'date.de_ruerup': 'Rürup contributions: pay by year end to count for 2026',
    'date.de_yearend': 'End of tax year 2026', 'date.de_return26': '2026 tax return due (without an adviser)',
    'date.at_vz': 'Income tax prepayment due', 'date.at_return25': '2025 return due via FinanzOnline', 'date.at_yearend': 'End of tax year 2026', 'date.at_return26': '2026 return due via FinanzOnline',
    'date.gb_poa2_prev': 'Second payment on account for 2025/26', 'date.gb_register': 'Register for Self Assessment if you started trading in 2025/26',
    'date.gb_jan': '2025/26 return and balancing payment, plus first payment on account for 2026/27', 'date.gb_yearend': 'End of the 2026/27 tax year',
    'date.gb_pension': 'Pension contributions: pay by 5 April to count for 2026/27', 'date.gb_poa2': 'Second payment on account for 2026/27',

    'plan.title': 'Where your pay goes', 'plan.label': '{amt} a month', 'plan.over': 'Your plan asks for {amt} more than you pay yourself. Trim a ritual, slow a goal, or switch your monthly pay to Typical month if your history supports it.',
    'plan.none': 'None yet.', 'plan.onDay': 'on the {ord}', 'plan.ritualsLabel': 'The good stuff, planned',
    'plan.ritualsBody': 'The things that make the week feel like yours: reformer, fragrance, long lunches. They get their own money, so enjoying them never eats into rent or tax.',
    'goal.done': 'done', 'goal.of': 'of {amt}', 'goal.funded': 'Fully funded.', 'goal.eta': 'there by {month} {year}', 'goal.setMonthly': 'set a monthly amount',
    'goal.none': 'Nothing saved for yet.', 'goal.noneSub': 'A trip, a deposit, a sabbatical. Give it a number and a monthly amount.',
    'goal.newTitle': 'A goal', 'goal.namePh': 'e.g. Amalfi, June 2027', 'goal.target': 'Target', 'goal.saved': 'Saved so far', 'goal.monthly': 'Put in each month',
    'flowc.title': 'Flow-month rules', 'flowc.label': 'When the reservoir overflows',
    'flowc.body': 'Once the reservoir holds {n} months of steady side pay, any surplus splits like this. The planner suggests the split; you move the money.',
    'flowc.future': 'Future ({RET}, investing) %', 'flowc.goals': 'Goals %', 'flowc.joy': 'Joy, guilt-free %', 'flowc.buffer': 'Buffer size (months)',
    'flowc.ok': 'Adds up to 100%.', 'flowc.scaled': 'Adds up to {n}%. It’s scaled to 100%.',

    'place.title': 'Country, language & currency', 'place.label': 'Tax rules follow the country', 'place.country': 'Country', 'place.language': 'Language',
    'place.note': 'Your country sets the tax maths, deadlines and terms. Language only changes the words, so you can plan German taxes in English or the other way round.',
    'place.confirmTitle': 'Switch to {c}?', 'place.confirmGo': 'Switch country',
    'place.confirmBody': 'Your figures keep their numbers and will be read as {cur}. Tax, deadlines and thresholds follow {c} from here ({year}).',
    'bal.title': 'Balances', 'bal.label': 'Update whenever you check the bank', 'bal.formTitle': 'What the bank says',
    'bal.reservoir': 'Reservoir account', 'bal.reservoirHint': 'Where side income lands before you pay yourself.',
    'bal.vault': 'Tax Vault account', 'bal.vaultHint': 'Tax and {VAT} you’ve set aside.',
    'bal.paid': 'Tax paid to {AUTH} this {YEARW}', 'bal.paidHint': '{INSTC} or bills on this year’s side income.',
    'set.title': 'Tax details', 'set.vat': 'I’m registered for {VAT}', 'set.vat@DE': 'I charge VAT (not a Kleinunternehmer)', 'set.vat@AT': 'I charge VAT (not a Kleinunternehmer)',
    'set.private': 'I have private hospital cover (no Medicare levy surcharge)',
    'set.church': 'Church tax', 'set.church.none': 'Not a church member', 'set.church.8': '8% (Bavaria, Baden-Württemberg)', 'set.church.9': '9% (all other states)',
    'set.children': 'I have children (lower long-term care contribution)', 'set.scotland': 'I live in Scotland (Scottish income tax bands)',
    'set.ret': '{RETC} top-up on side income %', 'set.retHint': '12% matches what an employer would pay.', 'set.retHint@DE': 'Paid into a Rürup (Basisrente) plan, fully deductible.', 'set.retHint@AT': 'Saved into prämienbegünstigte Zukunftsvorsorge.', 'set.retHint@GB': 'Paid into a personal pension with tax relief.',
    'set.exp': 'Business expenses this {YEARW}', 'set.expHint': 'Software, equipment, studio costs. Lowers your tax and comes out of your side pay, so don’t add these as bills too.',
    'data.title': 'Your data', 'data.sample': 'Showing example data', 'data.own': 'Your own figures',
    'data.cloud': 'Saved to your private space on this planner. Only you can see it, even if you share the link.',
    'data.local': 'Saved in this browser, on this device. Copy a backup to keep it safe or move it to another device.',
    'about.title': 'About the maths', 'about.label': 'So you can trust it',
    'about.rates@AU': 'Tax uses FY2026-27 resident rates (15% / 30% / 37% / 45%), the 2% Medicare levy, LITO, and the Medicare levy surcharge if you don’t hold hospital cover.',
    'about.rates@DE': 'Tax uses the 2026 §32a EStG tariff for a single filer (Grundfreibetrag €12,348), Soli, church tax if chosen, and 2026 employee social insurance. Freelance side profit carries no social insurance while your job is the main one.',
    'about.rates@AT': 'Tax uses the 2026 brackets (0% to €13,539, then 20–55%), 14 salary payments with the 13th and 14th at 6%, the Verkehrsabsetzbetrag, SVS for Neue Selbständige above €6,613.20 and the 15% Gewinnfreibetrag.',
    'about.rates@GB': 'Tax uses 2026/27 bands (personal allowance £12,570, tapering above £100,000), Scottish bands if chosen, Class 1 NI on salary and Class 4 NI on side profit, and the £1,000 trading allowance.',
    'about.reserve': 'Your set-aside rate is the extra tax and contributions from stacking side profit on top of salary, spread over side income. It updates as you log work.',
    'about.steady': 'Steady side pay looks at the last six complete months of take-home. “Balanced” sits halfway between your average and your three leanest months.',
    'about.late': 'Forecasts move each open invoice by that client’s average lateness.',
    'about.limits@AU': 'It doesn’t cover HELP repayments, Division 293 tax, capital gains, rental income or family situations. This is a planning tool, not tax advice.',
    'about.limits@DE': 'It doesn’t cover joint filing, Gewerbesteuer, the Übungsleiterpauschale, capital gains or rental income. This is a planning tool, not tax advice.',
    'about.limits@AT': 'It doesn’t cover family credits, Basispauschalierung, capital gains or rental income, and SVS is estimated before its final assessment. This is a planning tool, not tax advice.',
    'about.limits@GB': 'It doesn’t cover student loans, dividends, capital gains or rental income, and Class 4 NI is shown before any annual-maximum refund, so it can run a little high. This is a planning tool, not tax advice.',

    // ---- United States and Canada ----
    'region.US.CA': 'California', 'region.US.NY': 'New York', 'region.US.TX': 'Texas', 'region.US.FL': 'Florida', 'region.US.WA': 'Washington', 'region.US.IL': 'Illinois', 'region.US.MA': 'Massachusetts', 'region.US.OTHER': 'Another state',
    'region.CA.ON': 'Ontario', 'region.CA.BC': 'British Columbia', 'region.CA.AB': 'Alberta', 'region.CA.QC': 'Québec', 'region.CA.OTHER': 'Another province',
    'set.region': 'State', 'set.region@CA': 'Province', 'set.regionRate': 'State income tax rate %', 'set.regionRate@CA': 'Provincial income tax rate %',
    'set.regionRateHint': 'Your state’s rough top rate on your income. It’s applied to taxable income.', 'set.regionRateHint@CA': 'Your province’s rough rate on your income. It’s applied to taxable income.',
    'sts.salarySub@US': 'after tax & FICA', 'sts.salarySub@CA': 'after tax, CPP & EI',
    'stream.grossHint@US': 'Gross W-2 salary before tax and FICA.', 'stream.grossHint@CA': 'Gross T4 salary before tax, CPP and EI.',
    'vault.why@US': 'Your side income sits on top of a <b>{salary}</b> salary, so it’s taxed from your top bracket up, not from zero. On a projected <b>{side}</b> of side profit this year, that’s <b>{tax}</b> of federal, state and self-employment tax nobody is withholding.',
    'vault.why@CA': 'Your side income sits on top of a <b>{salary}</b> salary, so it’s taxed from your top bracket up, not from zero. On a projected <b>{side}</b> of side profit this year, that’s <b>{tax}</b> of federal and provincial tax, plus any CPP room your salary leaves, that nobody is withholding.',
    'vault.marginal@US': 'Marginal rate incl. state and SE tax: {rate}', 'vault.marginal@CA': 'Marginal rate incl. province and CPP: {rate}',
    'split.vatTo@US': 'to your state',
    'split.vatTo@CA': 'to the CRA with your return',
    'inst.bodyLikely@US': 'Owe $1,000 or more after withholding and the IRS expects quarterly estimated payments: April 15, June 15, September 15 and January 15. You avoid a penalty by paying 100% of last year’s tax (110% above $150,000 of income) or 90% of this year’s. Raising your W-4 withholding at your job works too, and counts as paid evenly across the year.',
    'inst.bodyNot@US': 'Estimated payments start once you’ll owe $1,000 or more after withholding. Net earnings of $400 or more (about $433 of profit) already mean self-employment tax, so keep filling the vault.',
    'inst.bodyLikely@CA': 'Once your net tax owing passes $3,000 ($1,800 in Québec) this year and in one of the two years before, the CRA asks for instalments on March 15, June 15, September 15 and December 15. Its reminder shows the amount to pay; use that once you have it.',
    'inst.bodyNot@CA': 'Instalments start once net tax owing passes $3,000 ($1,800 in Québec) this year and in either of the two years before. Until then the balance is due April 30, even though self-employed returns aren’t due until June 15.',
    'vat.title@US': 'Sales tax', 'vat.title@CA': 'GST/HST small supplier',
    'vat.body@CA': 'Last 12 months: {last}. This year, projected: {proj}. Once your side revenue passes {line} over four consecutive quarters, you stop being a small supplier at the end of the following month and start charging {rate} ({VAT}, plus QST in Québec); pass it within a single quarter and it starts with that sale. Register within 29 days.',
    'todo.registerSub@CA': 'Your side revenue is on track for {amt}, past the {line} small supplier line. Register for {VAT} within 29 days and add {rate} to invoices from then on.',
    'vat.body@US': 'Design and marketing services rarely carry sales tax.',
    'se.title': 'Self-employment tax', 'se.label': '15.3% on 92.35% of profit',
    'se.body': 'Side profit carries Social Security (12.4%, until your wages and profit reach $184,500) and Medicare (2.9%) on 92.35% of it. Half of that is deductible, and the 20% QBI deduction lowers income tax on the rest. All in, your next dollar of side profit costs about <b>{rate}</b>. Sales tax rarely applies to design and marketing services.',
    'ret.title@US': 'SEP-IRA on side income', 'ret.title@CA': 'RRSP on side income',
    'ret.label@US': 'Up to {cap}', 'ret.label@CA': 'Dollar limit {cap}',
    'ret.body@US': 'No employer puts anything aside on 1099 work. A SEP-IRA takes up to 20% of your net self-employment earnings and lowers your income tax (not SE tax), so your top-up saves roughly <b>{saving}</b>. You can open and fund it until your return is due, April 15, 2027, or later with an extension.',
    'ret.body@CA': 'Nobody contributes on self-employed income. RRSP room is 18% of last year’s earned income, side profit included, up to {cap}. Contributions come off your taxable income, so your top-up saves roughly <b>{saving}</b>. Contribute by March 1, 2027 to count for 2026.',
    'set.retHint@US': 'Paid into a SEP-IRA or Solo 401(k).', 'set.retHint@CA': 'Paid into your RRSP.',
    'about.rates@US': 'Tax uses 2026 federal brackets and the $16,100 standard deduction (single), FICA on salary, self-employment tax on side profit with half deductible, the 20% QBI deduction, and your state’s income tax (California uses its 2025 tables until 2026 is published).',
    'about.rates@CA': 'Tax uses 2026 federal brackets (14% bottom rate) and your province’s brackets and basic personal amount, CPP/QPP and EI on salary, both CPP halves on side profit within the room your salary leaves, and Ontario’s surtax and Health Premium.',
    'about.limits@US': 'It doesn’t cover NYC or other local tax, Washington’s B&O tax, itemized deductions, credits for children, health insurance premiums or capital gains. This is a planning tool, not tax advice.',
    'about.limits@CA': 'It doesn’t cover EI for the self-employed, family credits, the Québec work deduction, GST/HST input credits or capital gains, and Québec’s QPIP and Health Services Fund are estimates. This is a planning tool, not tax advice.',
    'date.us_apr': '2025 return due, and first 2026 estimated payment', 'date.us_q2': 'Second 2026 estimated payment', 'date.us_q3': 'Third 2026 estimated payment',
    'date.us_solo': 'Solo 401(k): set it up by your return date to defer for 2026 (the limit is shared with your job’s 401(k))', 'date.us_q4': 'Last 2026 estimated payment', 'date.us_return': '2026 return due; SEP-IRA funding deadline unless you extend',
    'date.ca_inst': 'Tax instalment due', 'date.ca_balance25': '2025 balance due', 'date.ca_file25': '2025 return due (self-employed)', 'date.ca_rrsp': 'RRSP deadline for 2026', 'date.ca_balance26': '2026 balance due',
    'name.title': 'Budget name', 'name.label': 'Shown at the top of every page', 'name.field': 'Name', 'name.ph': 'e.g. Alex’s Budget', 'name.hint': 'Leave it blank to use {generic}.',
    'store.none': 'Not saved: this browser is blocking storage. Copy a backup before you leave.',
    'rates.stale': 'These figures still use {base} rates, the latest in this version. Treat them as an estimate for {YEAR}, and check dates and thresholds with {AUTH}. Your vault may still hold last year’s tax until you’ve paid it.',
    'pill.pay': 'Pay day', 'todo.draw': 'Pay yourself {amt} for {month}', 'todo.drawSub': 'Move your steady side pay from the reservoir to your everyday account, then confirm here.',
    'btn.paySelf': 'I’ve paid myself', 'toast.paySelf': '{amt} moved out of the reservoir', 'toast.synced': 'Loaded your latest copy from your private space',
    'res.held': 'Includes {amt} set aside for {RET}, not counted in the buffer.', 'ret.held': '{amt} waiting in the reservoir to contribute', 'btn.contribute': 'Log a contribution',
    'ret.logTitle': 'Log a contribution', 'ret.logIntro': 'Moves this out of the reservoir once you’ve paid it into your {RET}.',
    'vault.whyNoSalary': 'With no salary logged, your side income is taxed from the bottom up. On a projected <b>{side}</b> of side profit this year, that’s <b>{tax}</b> nobody is withholding.',
    'import.intro': 'This replaces everything in this planner with the backup.',
    'xp.s.summary': 'Summary', 'xp.s.streams': 'Income streams', 'xp.s.invoices': 'Invoices and work', 'xp.s.bills': 'Bills', 'xp.s.goals': 'Goals', 'xp.s.spending': 'Spending', 'xp.s.forecast': 'Six-month outlook', 'xp.s.dates': 'Tax calendar',
    'xp.item': 'Item', 'xp.value': 'Value', 'xp.budget': 'Budget', 'xp.country': 'Country', 'xp.year': 'Tax year', 'xp.currency': 'Currency', 'xp.exported': 'Exported on',
    'xp.salaryNet': 'Salary after deductions, per month', 'xp.sidePay': 'Monthly pay from side income', 'xp.monthlyPay': 'Total monthly pay', 'xp.leftMonth': 'Left to spend this month', 'xp.perWeek': 'Safe to spend this week',
    'xp.reserveRate': 'Set-aside rate', 'xp.sideProfit': 'Projected side profit this year', 'xp.sideTax': 'Tax on side income this year', 'xp.reservoir': 'Reservoir balance', 'xp.heldRetirement': 'Of which for retirement', 'xp.bufferTarget': 'Buffer target', 'xp.surplus': 'Surplus',
    'xp.vault': 'Tax vault balance', 'xp.owed': 'Tax owed so far', 'xp.taxPaid': 'Tax paid this year', 'xp.essentials': 'Essentials per month', 'xp.rituals': 'Rituals per month', 'xp.goals': 'Goals per month',
    'xp.name': 'Name', 'xp.type': 'Type', 'xp.grossYear': 'Salary before tax, per year', 'xp.expectedMonth': 'Typical month', 'xp.paidYear': 'Paid this year', 'xp.active': 'Active', 'xp.yes': 'Yes', 'xp.no': 'No',
    'xp.client': 'Client', 'xp.stream': 'Stream', 'xp.status': 'Status', 'xp.amount': 'Amount', 'xp.yours': 'Yours', 'xp.chance': 'Chance', 'xp.issued': 'Invoice sent', 'xp.due': 'Due', 'xp.paid': 'Paid on',
    'xp.category': 'Category', 'xp.frequency': 'How often', 'xp.perMonth': 'Per month', 'xp.day': 'Day of month', 'xp.target': 'Target', 'xp.saved': 'Saved so far', 'xp.date': 'Date', 'xp.what': 'What',
    'xp.month': 'Month', 'xp.booked': 'Booked', 'xp.likely': 'Likely', 'xp.draw': 'Your pay', 'xp.reservoirEnd': 'Reservoir at month end', 'xp.toBook': 'Work to book', 'xp.outlook': 'Outlook',
    'btn.excel': 'Download Excel', 'btn.csv': 'Download CSV', 'toast.downloaded': 'Downloaded {what}', 'toast.dlFailed': 'That download didn’t work here. Try again, or copy a backup instead.',
    'stream.q': 'What kind of income is this?', 'stream.add': 'Add income', 'stream.k.salarySub': 'Tax is taken out before you’re paid', 'stream.k.abnSub': 'You invoice, and set aside your own tax', 'stream.k.otherSub': 'Workshops, royalties, the odd sale', 'stream.namePh.salary': 'e.g. Head of Marketing', 'stream.namePh.abn': 'e.g. Branding clients', 'stream.namePh.other': 'e.g. Workshops',
    'ob.title': 'Set up your budget', 'ob.sub': 'Three quick choices. You can change any of them later in Settings.', 'ob.country': 'Where do you pay tax?', 'ob.countryHint': 'This sets your tax rates, deadlines and terms.', 'ob.start': 'Start my budget', 'ob.sample': 'See an example first', 'cur.label': 'Currency', 'cur.hint': 'Suggested by your country. Change it if you’d rather see another.', 'cur.mismatch': 'Amounts show in {cur}, with nothing converted. {c} tax limits are set in {home}, so tax estimates are only reliable if you enter figures in {home}.',
    'next.title': 'What to do next', 'next.count': '{done} of {n} done', 'next.done': 'Done', 'next.hide': 'Hide these steps', 'next.intro': 'Fill these in, in order, and this page starts giving you real answers.', 'next.income': 'Add what you earn', 'next.incomeWhy': 'Your salary and each client or side income. This sets your tax and your steady monthly pay.', 'next.bills': 'Add your regular bills', 'next.billsWhy': 'Rent, insurance, subscriptions. Until these are in, “safe to spend” reads too high.', 'next.billsBtn': 'Add a bill', 'next.work': 'Log your client work', 'next.workWhy': 'Invoices and jobs you expect. These build your six-month outlook and show what to set aside for tax.', 'next.money': 'Enter what you hold now', 'next.moneyWhy': 'What you’ve already saved from side income and for tax. Enter 0 if you’re starting from nothing.', 'next.moneyBtn': 'Enter balances', 'sts.noBills': 'Bills not added yet',
    'tour.replay': 'Take the tour', 'tour.count': 'Step {i} of {n}', 'tour.skip': 'Skip tour', 'tour.back': 'Back', 'tour.next': 'Next', 'tour.finish': 'Get started', 'tour.tabs': 'Five tabs, one planner', 'tour.tabsBody': 'Everything lives under these tabs. This takes about a minute, and you can skip it at any point.', 'tour.streams': 'Your income', 'tour.streamsBody': 'On Money in, add your salary and each client or side income. You can edit or pause them any time.', 'tour.work': 'Work and invoices', 'tour.workBody': 'Log each job as likely, invoiced or paid. When money lands, the planner splits it for tax and for you. Your six-month outlook is on this tab too.', 'tour.vault': 'What to set aside', 'tour.vaultBody': 'The Tax vault shows how much of each payment to keep for tax and why, what you’ve set aside so far, and your deadlines.', 'tour.bills': 'Your bills', 'tour.billsBody': 'On Spending, add rent, insurance and subscriptions. They come out before anything counts as safe to spend.', 'tour.goals': 'Your goals', 'tour.goalsBody': 'Give each goal a target and a monthly amount. That amount is set aside from your pay as well.', 'tour.place': 'Country, language and currency', 'tour.placeBody': 'Settings is where you change these, along with your tax details and the name of your budget.', 'tour.data': 'Your data', 'tour.dataBody': 'Copy a backup, download Excel or CSV, or start over. You can also replay this tour from here.', 'tour.home': 'Start here', 'tour.homeBody': 'Today is your home page. Work through these steps and it will show what’s safe to spend, what to do this week and what’s coming up.', 'tour.homeSample': 'Today is your home page', 'tour.homeSampleBody': 'This shows what’s safe to spend, with what to do this week and what’s coming up further down. When you’re ready, clear the example and add your own.',
    'toast.sideFirst': 'Add a side income stream first', 'toast.logged': 'Logged {what}', 'toast.saved': 'Saved', 'toast.removed': 'Removed', 'toast.removedWhat': 'Removed {what}',
    'toast.added': 'Added {what}', 'toast.paid': 'Paid. {amt} is yours.', 'toast.invoiced': 'Moved to invoiced. Due {date}', 'toast.vault': 'Vault +{amt}',
    'toast.copied': 'Copied', 'toast.selected': 'Selected. Press Copy on your keyboard.', 'toast.goalAdd': '{amt} added to {what}', 'toast.balances': 'Balances updated',
    'toast.taxPaid': 'Logged {amt} to {AUTH}', 'toast.noSurplus': 'No surplus right now', 'toast.surplus': 'Surplus split. Enjoy the {amt}.', 'toast.fresh': 'Fresh start',
    'toast.sample': 'Example loaded', 'toast.restored': 'Restored', 'toast.leftAsIs': 'Left as it was. Type 0 to clear it.', 'toast.country': 'Now planning for {c}',

    'entry.newTitle': 'Work or a payment', 'entry.entry': 'Entry', 'entry.stream': 'Stream', 'entry.client': 'Client or job', 'entry.clientPh': 'e.g. Saltbush Skincare',
    'entry.amount': 'Amount', 'entry.amountVat': 'Amount incl. {VAT}', 'entry.stage': 'Where is it at?',
    'entry.st.pipeline': 'Likely (quoted, not confirmed)', 'entry.st.invoiced': 'Invoiced, waiting', 'entry.st.paid': 'Paid, money landed',
    'entry.issued': 'Invoice sent', 'entry.due': 'Due (or expected)', 'entry.paid': 'Paid on', 'entry.paidHint': 'Only for paid.', 'entry.chance': 'Chance it happens %', 'entry.chanceHint': 'Only for likely work.',
    'paid.on': 'Landed on', 'paid.amount': 'Amount received', 'paid.toVault': 'I’ve moved {amt} to my Tax Vault (adds it to the vault balance)',
    'paid.toRes': 'The rest is in my reservoir account (adds {amt} to it)', 'paid.payment': 'Payment', 'paid.submit': 'Mark as paid',
    'paid.intro': 'Here’s how this payment splits. {RETC} stays in the reservoir until you contribute it.',
    'stream.newTitle': 'New income', 'stream.name': 'Give it a name', 'stream.namePh': 'e.g. Studio: brand identity', 'stream.type': 'Type',
    'stream.k.salary': 'A job with a salary', 'stream.k.abn': 'Client or freelance work', 'stream.k.other': 'Other side income', 'stream.colour': 'Colour',
    'stream.gross': 'Salary before tax, per year', 'stream.grossHint': 'Salary only. Excludes super.', 'stream.grossHint@DE': 'Gross salary (Bruttojahresgehalt).', 'stream.grossHint@AT': 'All 14 payments together (Jahresbrutto).', 'stream.grossHint@GB': 'Gross salary before tax and NI.',
    'stream.typical': 'In a typical month, roughly how much?', 'stream.typicalHint': 'A rough guess is fine. It only fills in months you haven’t logged yet.', 'stream.active': 'Still earning from this (untick to pause it)',
    'stream.deleteWith': { one: 'Delete with {n} entry', other: 'Delete with {n} entries' },
    'bill.newRitual': 'A ritual', 'bill.newEssential': 'An essential', 'bill.freq': 'How often', 'bill.kind': 'Kind', 'bill.day': 'Day of month (monthly only)', 'bill.dayHint': 'Optional. Shows it in Coming up.',
    'chase.there': 'there', 'chase.thisInvoice': 'this invoice', 'chase.title': 'A nudge for {client}', 'chase.note': 'Warm, short, no apology. Copy it into your email and add your name.',
    'chase.text': 'Hi {name} team,\n\nHope the week’s treating you well. Just a gentle nudge on my invoice for {amt}, which was due on {date}. Could you let me know when it’s scheduled for payment?\n\nHappy to resend it if it’s gone astray.\n\nThanks so much,',
    'pay.title': 'Paid {AUTHN}', 'pay.intro': 'Logging a payment moves it out of the vault and counts it against this year’s tax.', 'pay.amount': 'Amount paid', 'pay.fromVault': 'Paid from the Tax Vault',
    'surplus.title': '{amt} to put to work', 'surplus.submit': 'I’ve moved it', 'surplus.intro': 'Suggested from your flow rules. Move the money in your bank, then confirm here.',
    'surplus.future': '{RET} or investing', 'surplus.goalsN': { one: 'shared across {n} goal', other: 'shared across {n} goals' }, 'surplus.goalsNone': 'no open goals, goes to future', 'surplus.joy': 'spend it, no guilt',
    'fresh.titleSample': 'Clear the example?', 'fresh.title': 'Erase everything?', 'fresh.submitSample': 'Clear and start', 'fresh.submit': 'Erase and start over',
    'fresh.introSample': 'The example data goes, and you start with an empty planner. Today will show you what to fill in.',
    'fresh.intro': 'This removes all your streams, invoices, bills and goals from this planner. Copy a backup first if you might want them.',
    'sample.title': 'Replace your data with the example?', 'sample.submit': 'Load example', 'sample.intro': 'Your own figures will be replaced. Copy a backup first.',
    'export.title': 'Copy your planner', 'export.note': 'Paste this into a note or file somewhere safe. Restore it from Settings any time.',
    'import.title': 'Paste a backup', 'import.submit': 'Restore', 'import.label': 'Backup text',
    'import.bad': 'That doesn’t look like a backup from this planner. Copy the whole thing, including the { and }.', 'import.problems': 'Backup has problems: {list}.'
  } };

  function lookup(lang, country, key) {
    var order = [dict[lang], dict.en];
    for (var i = 0; i < order.length; i++) {
      var d = order[i]; if (!d) continue;
      if (d[key + '@' + country] != null) return d[key + '@' + country];
      if (d[key] != null) return d[key];
    }
    return key;
  }
  function shiftYears(text, n) {
    return text.replace(/FY(\d\d)-(\d\d)|(20\d\d)([-\/])(\d\d)\b|\b20\d\d\b/g, function (m, a, b, y, sep, yy) {
      if (a) return 'FY' + (+a + n) + '-' + (+b + n);
      if (y) return (+y + n) + sep + (+yy + n);
      return String(+m + n);
    });
  }
  function make(lang, country, offset) {
    lang = dict[lang] ? lang : 'en';
    var tm = (terms[lang] || terms.en)[country] || terms.en.AU;
    if (offset) { tm = Object.assign({}, tm); tm.YEAR = shiftYears(tm.YEAR, offset); }
    function fill(v, params, escape, key) {
      params = params || {};
      if (v && typeof v === 'object') v = params.n === 1 && v.one ? v.one : v.other;
      v = String(v);
      // After the built-in tax year ends, its calendar and deadlines roll forward; statements about rates don't.
      if (offset && key && /^(date\.|ret\.body)/.test(key)) v = shiftYears(v, offset);
      return v.replace(/\{(\w+)\}/g, function (m, k) {
        if (Object.prototype.hasOwnProperty.call(params, k)) return escape ? escape(String(params[k])) : String(params[k]);
        if (Object.prototype.hasOwnProperty.call(tm, k)) return tm[k];
        return m;
      });
    }
    function htmlEsc(s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    return {
      t: function (key, params) { return fill(lookup(lang, country, key), params, null, key); },
      th: function (key, params) { return fill(lookup(lang, country, key), params, htmlEsc, key); }
    };
  }
  return { dict: dict, terms: terms, make: make, langs: ['en', 'de'] };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SwellI18n;
