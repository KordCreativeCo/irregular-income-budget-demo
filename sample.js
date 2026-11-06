/* Example data so the planner opens in a working state. Marked sample:true; one tap clears it.
   The same persona in each country: amounts scaled to local pay, places and labels localised. */
var SwellSample = function (country, lang, today) {
  country = { DE: 'DE', AT: 'AT', GB: 'GB', US: 'US', CA: 'CA' }[country] || 'AU';
  var de = lang === 'de';
  var place = {
    AU: { city: 'Sydney', hood: 'Bondi', transit: de ? 'Opal & Fahrdienste' : 'Opal & rideshare', grocer: 'Harris Farm', club: de ? 'Dinner im Pool Club' : 'Dinner at the pool club', surf: 'Bondi Surf Co.', skin: 'Saltbush Skincare', studio: 'Coogee Pilates Co.', gallery: 'Darlinghurst Gallery' },
    DE: { city: 'Berlin', hood: 'Prenzlauer Berg', transit: de ? 'BVG-Abo & Taxi' : 'BVG pass & taxis', grocer: 'Bio Company', club: de ? 'Dinner im Grill Royal' : 'Dinner at Grill Royal', surf: 'Spreeufer Studios', skin: 'Saltbush Skincare', studio: 'Mitte Pilates', gallery: 'Galerie Kreuzberg' },
    AT: { city: 'Wien', hood: 'Neubau', transit: de ? 'Wiener Linien & Taxi' : 'Wiener Linien & taxis', grocer: 'Meinl am Graben', club: de ? 'Dinner im Steirereck' : 'Dinner at Steirereck', surf: 'Donaukanal Studio', skin: 'Saltbush Skincare', studio: 'Pilates Loft Wien', gallery: 'Galerie Neubau' },
    US: { city: 'Los Angeles', hood: 'Venice', transit: de ? 'Metro & Fahrdienste' : 'Metro & rideshare', grocer: 'Erewhon', club: de ? 'Dinner im Hotel Figueroa' : 'Dinner at Hotel Figueroa', surf: 'Abbot Kinney Surf Co.', skin: 'Sagebrush Skincare', studio: 'Silver Lake Pilates', gallery: 'Arts District Gallery', region: 'CA' },
    CA: { city: 'Toronto', hood: 'Queen West', transit: de ? 'TTC & Fahrdienste' : 'TTC & rideshare', grocer: 'Pusateri’s', club: de ? 'Dinner im Soho House' : 'Dinner at Soho House', surf: 'Ossington Studio', skin: 'Saltbush Skincare', studio: 'Leslieville Pilates', gallery: 'Junction Gallery', region: 'ON' },
    GB: { city: 'London', hood: 'Hackney', transit: de ? 'Oyster & Taxi' : 'Oyster & cabs', grocer: 'Daylesford', club: de ? 'Dinner im Soho House' : 'Dinner at Soho House', surf: 'Hackney Wick Studios', skin: 'Saltbush Skincare', studio: 'Hackney Pilates Co.', gallery: 'Bermondsey Gallery' }
  }[country];
  // Rough local equivalent of the same life: pay, rent and clients' budgets.
  var k = { AU: 1, DE: 0.6, AT: 0.6, GB: 0.52, US: 1.45, CA: 0.88 }[country];
  var r = function (n, step) { step = step || 10; return Math.round(n * k / step) * step; };
  var L = de ? {
    job: 'Head of Marketing, 3 Tage', studio: 'Studio: Markenidentität', contract: 'Art-Direction-Aufträge', teach: 'Workshops & Vorträge',
    rent: 'Miete, ' + place.hood, energy: 'Strom & Internet', phone: 'Handy', health: 'Private Krankenversicherung', adobe: 'Adobe Creative Cloud',
    pilates: 'Reformer Pilates', hair: 'Friseur & Brauen', fragrance: 'Parfum-Nachfüllungen', streaming: 'Streaming & Apps',
    trip: 'Amalfi', deposit: 'Eigenkapital Wohnung', g1: 'Lebensmittel & ' + place.grocer, g2: 'Lebensmittel, Woche 2 & 3', gift: 'Geburtstagsgeschenk', coffee: 'Lebensmittel & Kaffee', flowers: 'Blumen vom Markt', pharmacy: 'Apotheke',
    workshop: 'Sommer-Designworkshop', retainer: 'Wren & Co Agency, Q1-Retainer', rebrand: place.surf + ' Rebrand', collective: 'Design Collective ' + place.city
  } : {
    job: 'Head of Marketing, 3 days', studio: 'Studio: brand identity', contract: 'Art direction contracts', teach: 'Workshops & talks',
    rent: 'Rent, ' + place.hood, energy: 'Energy & internet', phone: 'Phone', health: 'Private health (hospital)', adobe: 'Adobe Creative Cloud',
    pilates: 'Reformer pilates', hair: 'Hair & brows', fragrance: 'Fragrance refills', streaming: 'Streaming & apps',
    trip: 'Amalfi', deposit: 'Apartment deposit', g1: 'Groceries & ' + place.grocer, g2: 'Groceries, week 2 & 3', gift: 'Birthday gift', coffee: 'Groceries & coffee', flowers: 'Flowers from the market', pharmacy: 'Pharmacy',
    workshop: 'Summer design workshop', retainer: 'Wren & Co Agency, Q1 retainer', rebrand: place.surf + ' rebrand', collective: 'Design Collective ' + place.city
  };
  var bills = [
    { id: 'b1', name: L.rent, amount: r(850), freq: 'weekly', category: 'essential' },
    { id: 'b2', name: L.energy, amount: r(140), freq: 'monthly', category: 'essential', day: 18 },
    { id: 'b3', name: L.phone, amount: r(75, 5), freq: 'monthly', category: 'essential', day: 3 },
    { id: 'b6', name: place.transit, amount: r(45, 5), freq: 'weekly', category: 'essential' },
    { id: 'b7', name: L.pilates, amount: r(320), freq: 'monthly', category: 'ritual', day: 5 },
    { id: 'b8', name: L.hair, amount: r(180), freq: 'monthly', category: 'ritual' },
    { id: 'b9', name: L.fragrance, amount: r(480), freq: 'annual', category: 'ritual' },
    { id: 'b10', name: L.streaming, amount: r(35, 5), freq: 'monthly', category: 'ritual', day: 22 }
  ];
  // Health cover is its own bill only where it isn't already taken from the salary.
  if (country === 'AU') bills.splice(3, 0, { id: 'b4', name: L.health, amount: 210, freq: 'monthly', category: 'essential', day: 1 });
  var plan = {
    v: 1,
    sample: true,
    streams: [
      { id: 's_sal', name: L.job, kind: 'salary', annualGross: r(126000, 1000), payFreq: 'fortnightly', color: 'ink' },
      { id: 's_studio', name: L.studio, kind: 'abn', expectedMonthly: r(3200, 50), color: 'sea' },
      { id: 's_contract', name: L.contract, kind: 'abn', expectedMonthly: r(1500, 50), color: 'sand' },
      { id: 's_teach', name: L.teach, kind: 'other', expectedMonthly: r(300, 50), color: 'rose' }
    ],
    entries: [
      { id: 'e0', streamId: 's_contract', client: 'Wren & Co Agency', amount: r(3300, 50), stage: 'paid', issued: '2026-03-20', due: '2026-04-03', paid: '2026-04-24', vaulted: true },
      { id: 'e1', streamId: 's_studio', client: place.skin, amount: r(4200, 50), stage: 'paid', issued: '2026-04-20', due: '2026-05-10', paid: '2026-05-12', vaulted: true },
      { id: 'e2', streamId: 's_teach', client: L.collective, amount: r(350, 50), stage: 'paid', issued: '2026-05-15', due: '2026-05-20', paid: '2026-05-20', vaulted: true },
      { id: 'e3', streamId: 's_studio', client: 'Atelier Nine', amount: r(2600, 50), stage: 'paid', issued: '2026-05-30', due: '2026-06-14', paid: '2026-06-18', vaulted: true },
      { id: 'e4', streamId: 's_contract', client: 'Wren & Co Agency', amount: r(5500, 50), stage: 'paid', issued: '2026-06-21', due: '2026-07-05', paid: '2026-07-26', vaulted: true },
      { id: 'e5', streamId: 's_studio', client: place.skin, amount: r(1800, 50), stage: 'paid', issued: '2026-07-10', due: '2026-07-24', paid: '2026-07-29', vaulted: true },
      { id: 'e6', streamId: 's_studio', client: place.studio, amount: r(3400, 50), stage: 'paid', issued: '2026-07-31', due: '2026-08-14', paid: '2026-08-14', vaulted: true },
      { id: 'e7', streamId: 's_teach', client: L.collective, amount: r(600, 50), stage: 'paid', issued: '2026-08-15', due: '2026-08-22', paid: '2026-08-22', vaulted: true },
      { id: 'e8', streamId: 's_contract', client: 'Wren & Co Agency', amount: r(6600, 50), stage: 'paid', issued: '2026-08-18', due: '2026-09-01', paid: '2026-09-23', vaulted: true },
      { id: 'e9', streamId: 's_studio', client: place.gallery, amount: r(2900, 50), stage: 'paid', issued: '2026-09-16', due: '2026-09-30', paid: '2026-09-30', vaulted: true },
      { id: 'e10', streamId: 's_studio', client: 'Atelier Nine', amount: r(1500, 50), stage: 'paid', issued: '2026-09-25', due: '2026-10-09', paid: '2026-10-09', vaulted: false },
      { id: 'e11', streamId: 's_contract', client: 'Wren & Co Agency', amount: r(4400, 50), stage: 'invoiced', issued: '2026-10-01', due: '2026-10-15' },
      { id: 'e12', streamId: 's_studio', client: place.skin, amount: r(3850, 50), stage: 'invoiced', issued: '2026-10-12', due: '2026-11-11' },
      { id: 'e13', streamId: 's_studio', client: place.studio, amount: r(2200, 50), stage: 'invoiced', issued: '2026-10-20', due: '2026-11-20' },
      { id: 'e14', streamId: 's_studio', client: L.rebrand, amount: r(9000, 50), stage: 'pipeline', probability: 60, due: '2026-12-15' },
      { id: 'e15', streamId: 's_teach', client: L.workshop, amount: r(800, 50), stage: 'pipeline', probability: 80, due: '2027-01-20' },
      { id: 'e16', streamId: 's_contract', client: L.retainer, amount: r(2500, 50), stage: 'pipeline', probability: 40, due: '2027-02-10' }
    ],
    bills: bills,
    goals: [
      { id: 'g1', name: L.trip, target: r(9000, 100), saved: r(3100, 100), monthly: r(900, 50) },
      { id: 'g2', name: L.deposit, target: r(120000, 1000), saved: r(38000, 1000), monthly: r(1500, 50) }
    ],
    spends: [
      { id: 'p1', date: '2026-10-03', amount: r(186, 1), label: L.g1, kind: 'everyday' },
      { id: 'p2', date: '2026-10-08', amount: r(240, 1), label: place.club, kind: 'ritual' },
      { id: 'p3', date: '2026-10-11', amount: r(412, 1), label: L.g2, kind: 'everyday' },
      { id: 'p4', date: '2026-10-19', amount: r(129, 1), label: L.gift, kind: 'everyday' },
      { id: 'p5', date: '2026-10-24', amount: r(168, 1), label: L.coffee, kind: 'everyday' },
      { id: 'p6', date: '2026-10-14', amount: r(65, 1), label: L.flowers, kind: 'ritual' },
      { id: 'p7', date: '2026-10-27', amount: r(48, 1), label: L.pharmacy, kind: 'everyday' }
    ],
    balances: { reservoir: r(14200, 100), taxVault: r(9800, 100), taxPaid: 0 },
    settings: {
      country: country, lang: de ? 'de' : 'en', region: place.region || '',
      gstRegistered: false, privateHospital: true, superTopUpPct: 10, bufferMonths: 3,
      smoothing: 'steady', businessExpenses: r(4800, 100), flowRules: { future: 50, goals: 30, joy: 20 },
      lastDraw: '2026-10'
    }
  };
  return today ? moveToToday(plan, today) : plan;
};
// Keep the example current: slide its dates so "this month" is always the month you open it.
function moveToToday(plan, today) {
  var months = (+today.slice(0, 4) - 2026) * 12 + (+today.slice(5, 7) - 10);
  function move(iso) {
    if (!iso) return iso;
    var total = +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1) + months, y = Math.floor(total / 12), m = total % 12;
    var day = Math.min(+iso.slice(8, 10), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  plan.entries.forEach(function (e) {
    e.issued = move(e.issued); e.due = move(e.due); e.paid = move(e.paid);
    if (e.paid && e.paid > today) e.paid = today;
    if (e.issued && e.issued > today) e.issued = today;
  });
  var dayNow = +today.slice(8, 10);
  plan.spends = plan.spends.map(function (p) { p.date = today.slice(0, 8) + String(Math.max(1, Math.round(+p.date.slice(8, 10) / 31 * dayNow))).padStart(2, '0'); return p; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  plan.settings.lastDraw = today.slice(0, 7);
  return plan;
}
if (typeof module !== 'undefined' && module.exports) module.exports = SwellSample;
