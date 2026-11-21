// Builds a WorldState from the bundled real data + labelled estimates.
import { WORLD, countryNeighbors } from './geo';
import type { Country, GovType, Party, Policy, Sector, SectorState, Tag, Territory, WorldState, Org, Company, Commodity } from './types';
import { SECTORS, isDemocracy } from './types';
import { clamp, hashStr, seeded } from './util';
import {
  AGRI_PRODUCERS, COMMODITIES, COMPANIES, DEFENSE_PACTS, EUROZONE, FX_REF, GDP_ESTIMATES, GOV, GOV_TAG, MIL_PCT, MIL_TAG, MINERAL_PRODUCERS,
  NUCLEAR, ORGS, ORG_TAG, RESERVE_CCY, STATE_OWNED, VERIFIED_LEADERS, BUILD_DATE,
} from '../data/reference';

// Public debt % GDP — IMF WEO 2024 order of magnitude (estimate).
const DEBT_PCT: Record<string, number> = {
  USA: 121, JPN: 236, ITA: 137, FRA: 113, GBR: 101, DEU: 63, CHN: 90, IND: 83, BRA: 87, CAN: 107, ESP: 102, GRC: 154, RUS: 20, SAU: 26, KOR: 53,
  AUS: 50, MEX: 58, TUR: 25, ARG: 85, ZAF: 75, IDN: 40, NLD: 45, CHE: 38, SWE: 33, NOR: 42, POL: 55, BEL: 105, PRT: 95, EGY: 90, PAK: 70, NGA: 50,
  UKR: 90, ISR: 68, IRN: 30, SGP: 170, BHR: 125, LBN: 150, VEN: 150, SDN: 250, LKA: 100, ZMB: 110, GHA: 80, KEN: 70, THA: 63, MYS: 69, PHL: 60,
  VNM: 35, CHL: 41, COL: 55, PER: 34, IRL: 43, DNK: 30, FIN: 82, AUT: 79, HUN: 74, ROU: 54, CZE: 44, NZL: 46, ARE: 30, QAT: 42, KWT: 7, KAZ: 23,
};
const DEBT_TAG: Tag = { prov: 'estimate', src: 'IMF World Economic Outlook 2024 (order of magnitude)', date: '2024' };
const MODEL_TAG: Tag = { prov: 'estimate', src: 'Model-derived from real GDP per capita (no bundled source)' };

// Political-map colours: national-colour conventions for major countries (as in grand-strategy games),
// vivid generated hues elsewhere, then nudged so neighbours never look alike.
export const NATIONAL_COLORS: Record<string, string> = {
  USA: '#4f7fe0', CAN: '#e0484f', MEX: '#2fae6e', BRA: '#3cc45a', ARG: '#76c2ef', CHL: '#d64534', COL: '#f5c431', PER: '#e8677a', VEN: '#f0a03a', BOL: '#9ccc3d', ECU: '#f7d64a', CUB: '#3d6fd6',
  GBR: '#d81e3c', IRL: '#3fbf6a', FRA: '#2453c9', DEU: '#5f6b7a', ITA: '#36b05f', ESP: '#f2b51f', PRT: '#2f9a55', NLD: '#f6862a', BEL: '#f0cf48', CHE: '#e5484d', AUT: '#ef8f8f', POL: '#e94b6b',
  CZE: '#3f7be0', SVK: '#5aa0e8', HUN: '#5bb478', ROU: '#f5cb2a', BGR: '#4fbf85', GRC: '#5ab7ef', SRB: '#c25454', HRV: '#e2665a', SWE: '#4c9bf0', NOR: '#e0525c', FIN: '#a6ccf5', DNK: '#f0505a', ISL: '#7aa7e8',
  UKR: '#ffd13c', BLR: '#86b86f', RUS: '#3f9a55', KAZ: '#4cc7e0', UZB: '#5fd0a8', TUR: '#eb5a3c', IRN: '#73b84f', IRQ: '#b89c5a', SYR: '#9a84d6', ISR: '#5a9bf5', SAU: '#1e9a5c', ARE: '#c9a227', EGY: '#e0bb4f',
  LBY: '#4ea36a', DZA: '#43a876', MAR: '#cf3f35', TUN: '#ef6b5b', NGA: '#41b36c', ETH: '#f5ce2f', KEN: '#b85c3a', ZAF: '#f0a23c', COD: '#4bb4e8', AGO: '#d9534f', SDN: '#c4a35a', TZA: '#3fb0a0',
  CHN: '#d8363a', JPN: '#f3b4c1', KOR: '#5a8ff0', PRK: '#a83a3a', TWN: '#61b5f0', MNG: '#4a7fe0', IND: '#f5973a', PAK: '#1f8f50', BGD: '#3fd17a', AFG: '#8e9aa6', IDN: '#e05c5c', MYS: '#f6a91f',
  THA: '#7c6cf0', VNM: '#f0603f', PHL: '#3a8ff0', MMR: '#dcb317', AUS: '#2fb3a8', NZL: '#22c6a0', PNG: '#e0703a',
};
function hslHex(h: number, s: number, l: number) {
  s /= 100; l /= 100; const k = (n: number) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return '#' + f(0) + f(8) + f(4);
}
const hexHue = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
export function colorFor(iso: string, avoid: string[] = []) {
  if (NATIONAL_COLORS[iso]) return NATIONAL_COLORS[iso];
  const h = hashStr(iso); let hue = h % 360;
  const taken = avoid.map(hexHue);
  for (let tries = 0; tries < 12 && taken.some((x) => Math.min(Math.abs(x - hue), 360 - Math.abs(x - hue)) < 28); tries++) hue = (hue + 47) % 360;
  return hslHex(hue, 58 + ((h >> 9) % 14), 50 + ((h >> 17) % 10));
}

const BLOCS = [
  { bloc: 'left', econ: -0.7, auth: 0.3 }, { bloc: 'green', econ: -0.4, auth: 0.15 }, { bloc: 'centre_left', econ: -0.25, auth: 0.3 },
  { bloc: 'centre', econ: 0.05, auth: 0.35 }, { bloc: 'centre_right', econ: 0.4, auth: 0.45 }, { bloc: 'nationalist', econ: 0.3, auth: 0.8 },
];
export function makeParties(iso: string, gov: GovType, rnd: () => number): Party[] {
  if (!isDemocracy(gov)) {
    return [
      { id: 'regime', bloc: 'regime', econ: gov === 'one_party' ? -0.2 : 0.2, auth: 0.9, support: 0.75, seats: 100, inGov: true },
      { id: 'opposition', bloc: 'opposition', econ: 0, auth: 0.3, support: 0.25, seats: 0, inGov: false },
    ];
  }
  const raw = BLOCS.map((b) => ({ ...b, w: 0.3 + rnd() * (b.bloc === 'green' ? 0.6 : 1.4) }));
  const tot = raw.reduce((s, x) => s + x.w, 0);
  const ps: Party[] = raw.map((b) => ({ id: b.bloc, bloc: b.bloc, econ: b.econ, auth: b.auth, support: b.w / tot, seats: 0, inGov: false }));
  allocateSeats(ps); formCoalition(ps); return ps;
}
export function allocateSeats(ps: Party[], seats = 100) {
  const elig = ps.filter((p) => p.support >= 0.05);
  const tot = elig.reduce((s, p) => s + p.support, 0) || 1;
  ps.forEach((p) => (p.seats = 0));
  const quotas = elig.map((p) => ({ p, q: (p.support / tot) * seats }));
  let used = 0; quotas.forEach((x) => { x.p.seats = Math.floor(x.q); used += x.p.seats; });
  quotas.sort((a, b) => (b.q % 1) - (a.q % 1)).slice(0, seats - used).forEach((x) => x.p.seats++);
}
export function formCoalition(ps: Party[]) {
  ps.forEach((p) => (p.inGov = false));
  const sorted = [...ps].sort((a, b) => b.seats - a.seats);
  const lead = sorted[0]; lead.inGov = true; let seats = lead.seats;
  const rest = sorted.slice(1).filter((p) => p.seats > 0).sort((a, b) => Math.abs(a.econ - lead.econ) - Math.abs(b.econ - lead.econ));
  for (const p of rest) { if (seats > 50) break; p.inGov = true; seats += p.seats; }
}
export const govEcon = (c: Country) => {
  const g = c.gov.parties.filter((p) => p.inGov); const s = g.reduce((a, p) => a + p.seats + p.support, 0) || 1;
  return g.reduce((a, p) => a + p.econ * (p.seats + p.support), 0) / s;
};

function baseSectors(L: number, resShare: number, rnd: () => number, iso: string): Record<Sector, SectorState> {
  const agri = clamp(28 - (L - 2.7) * 11, 0.8, 30) * (AGRI_PRODUCERS[iso] ? 1.25 : 1);
  const mining = (MINERAL_PRODUCERS[iso] || 0) * 4 + resShare * 30;
  const energy = 2 + resShare * 70;
  const manuf = 13 + rnd() * 8;
  const tech = clamp(2 + (L - 3.5) * 4, 0.5, 12) + rnd() * 2;
  const fin = clamp(3 + (L - 3.5) * 3.5, 1.5, 12);
  const raw: Record<Sector, number> = {
    agriculture: agri, manufacturing: manuf, construction: 6 + rnd() * 2, technology: tech, finance: fin, energy, mining,
    transport: 4, telecom: 2.5 + (L - 3.5), tourism: 2 + rnd() * 4, health: clamp(3 + (L - 3) * 3, 2, 12), education: 4 + (L - 3) * 0.8,
    retail: 10, logistics: 4, realestate: clamp(5 + (L - 3) * 3, 4, 14),
  };
  const tot = SECTORS.reduce((s, k) => s + Math.max(0.3, raw[k]), 0);
  const out = {} as Record<Sector, SectorState>;
  SECTORS.forEach((k) => (out[k] = { share: Math.max(0.3, raw[k]) / tot, growth: 0, health: 60 }));
  return out;
}

export function makeCountry(iso: string, opts: { gdp: number; pop: number; name?: string; nameFr?: string; flag?: string; ownTag?: boolean }, w: WorldState): Country {
  const b = WORLD.countries[iso];
  const rnd = seeded(hashStr(iso) ^ w.seed);
  const gdp = Math.max(50, opts.gdp), pop = Math.max(1000, opts.pop);
  const gdppc = (gdp * 1e6) / pop; const L = Math.log10(Math.max(300, gdppc));
  const conv = clamp((L - 2.8) / 2.2, 0, 1);
  const eg = b?.real.energy || {};
  const oil = eg.oil_production?.v || 0, gas = eg.gas_production?.v || 0, coal = eg.coal_production?.v || 0;
  const resValue = oil * 47 * 1.4 + gas * 20 + coal * 10; // USD m/yr at start-of-game prices
  const resShare = clamp(resValue / gdp, 0, 0.55);
  const gov: GovType = GOV[iso] || (['Europe', 'Americas', 'Oceania'].includes(b?.region || '') ? 'flawed_democracy' : 'hybrid');
  const milPct = MIL_PCT[iso] ?? clamp(1.0 + rnd() * 0.8 + (gov === 'authoritarian' ? 0.8 : 0), 0.5, 4);
  const tax = clamp(14 + (L - 3) * 9 + (b?.region === 'Europe' ? 7 : 0) + resShare * 20 + rnd() * 3, 9, 47);
  const deficitTarget = 2 + rnd() * 2;
  const totalSpend = tax + deficitTarget;
  const s = (k: number) => +(totalSpend * k).toFixed(2);
  const policy: Policy = {
    taxBurden: +tax.toFixed(1), corpTax: Math.round(18 + rnd() * 12),
    spending: { health: s(0.16), education: s(0.13), infrastructure: s(0.1), defense: milPct, social: s(0.3) - milPct * 0.3, research: +(0.3 + conv * 2.2).toFixed(2), subsidies: s(0.04), admin: s(0.1) },
    policyRate: null, tariff: Math.round(clamp(12 - L * 2 + rnd() * 4, 1.5, 15)), fdiOpenness: clamp(0.35 + conv * 0.4 + (isDemocracy(gov) ? 0.1 : -0.1), 0.1, 0.95),
    regulation: clamp(0.35 + conv * 0.3, 0.2, 0.8), migration: 0.4, energy: 'balanced', strategic: [], cbIndependent: isDemocracy(gov) && L > 3.6, capitalControls: !isDemocracy(gov) && L < 4,
  };
  const euro = EUROZONE.includes(iso);
  const ccy = euro ? 'EUR' : b?.currency?.code || 'USD';
  const realInfl = b?.real.infl;
  const infl = realInfl ? clamp(realInfl.v, -2, 80) : 3 + (4 - L) * 2;
  const debtPct = DEBT_PCT[iso] ?? clamp(35 + (L - 3.5) * 18 + rnd() * 30, 12, 120);
  const unemp = clamp(4 + rnd() * 6 + (L < 3.3 ? 3 : 0), 2.5, 25);
  const edu = clamp(28 + (L - 2.7) * 27 + rnd() * 6, 10, 95), hlth = clamp(30 + (L - 2.7) * 26 + rnd() * 6, 10, 95);
  const corruption = clamp(85 - (L - 2.7) * 28 + (isDemocracy(gov) ? -8 : 10) + rnd() * 8, 8, 92);
  const real = b?.real; const lead = VERIFIED_LEADERS[iso];
  const tags: Record<string, Tag> = {
    gdp: opts.ownTag ? { prov: 'estimate', src: GDP_ESTIMATES[iso]?.note || 'derived' } : real?.gdp ? { prov: 'verified', src: 'World Bank WDI (GDP, current US$)', date: String(real.gdp.y) } : { prov: 'estimate', src: GDP_ESTIMATES[iso]?.note || 'estimate' },
    pop: real?.pop ? { prov: 'verified', src: 'World Bank WDI (population)', date: String(real.pop.y) } : { prov: 'estimate', src: 'estimate' },
    inflation: realInfl ? { prov: 'verified', src: 'World Bank WDI (CPI inflation)', date: String(realInfl.y) } : MODEL_TAG,
    debt: DEBT_PCT[iso] ? DEBT_TAG : MODEL_TAG, gov: GOV[iso] ? GOV_TAG : MODEL_TAG, defense: MIL_PCT[iso] ? MIL_TAG : MODEL_TAG,
    energy: b?.real.energy ? { prov: 'verified', src: 'Our World in Data energy dataset', date: String(eg.primary_energy_consumption?.y || eg.oil_production?.y || '') } : MODEL_TAG,
    fx: FX_REF[ccy] ? { prov: 'verified', src: 'Alpha Vantage FX', date: BUILD_DATE } : { prov: 'simulated', src: 'Index (no bundled reference rate)' },
    capital: { prov: 'verified', src: 'mledoze/countries + GeoNames' }, area: { prov: 'verified', src: 'mledoze/countries' },
    model: MODEL_TAG,
  };
  const fx = FX_REF[ccy] ?? 100;
  const c: Country = {
    iso, name: opts.name || b?.name || iso, nameFr: opts.nameFr || b?.nameFr || opts.name || iso, flag: opts.flag || b?.flag || '🏳️', color: colorFor(iso),
    capital: b?.capital || null, capitalLL: b?.capitalLL || null, region: b?.region || 'World', subregion: b?.subregion || '', currency: ccy,
    currencyName: euro ? 'Euro' : b?.currency?.name || null, languages: b?.languages || [], area: b?.area || 0, alive: true,
    econ: {
      gdp, gdpReal: 100, growth: 1.5 + conv * 0, potential: 2, gap: 0, inflation: infl, unemployment: unemp, nairu: unemp * 0.9,
      debt: (debtPct / 100) * gdp, privateDebt: clamp(40 + (L - 3) * 40, 15, 200), revenue: (tax / 100) * gdp, expenditure: (totalSpend / 100) * gdp, interest: 0,
      deficit: deficitTarget, exports: gdp * 0.25, imports: gdp * 0.25, fdiInflow: gdp * 0.02, productivity: 100,
      sectors: baseSectors(L, resShare, rnd, iso), consumption: clamp(70 - (L - 3) * 5, 45, 80), investment: clamp(20 + rnd() * 8, 12, 40), bankHealth: clamp(55 + (L - 3) * 10 + rnd() * 10, 30, 90),
      tradeK: 0, effRate: 3, policyRate: clamp(infl + 1.5, 0.5, 40),
    },
    fin: { fx, fxAnchor: fx, fxRef: !!FX_REF[ccy], equity: 1000, bond10y: 4, cds: 50, rating: 'BBB', reserves: gdp * (0.08 + resShare * 0.6 + rnd() * 0.08), vol: 16, reserveCurrency: RESERVE_CCY[ccy] || 0 },
    soc: {
      pop, popGrowth: clamp(2.6 - (L - 2.7) * 1.1 + rnd() * 0.4, -0.6, 3.2), urban: clamp(25 + (L - 2.7) * 25, 15, 98), education: edu, health: hlth,
      gini: clamp(42 - (L - 3) * 4 + rnd() * 10, 24, 63), cohesion: 55 + rnd() * 20, netMigration: L > 4.3 ? 3 : -1, medianAge: clamp(17 + (L - 2.7) * 11, 15, 49),
    },
    mil: { spendPct: milPct, capital: (milPct / 100) * gdp * 9, personnel: Math.round((pop / 1000) * (0.002 + milPct * 0.0015)), tech: clamp(20 + (L - 2.7) * 28 + rnd() * 8, 10, 98), readiness: 55 + rnd() * 20, nuclear: NUCLEAR.includes(iso), exhaustion: 0 },
    gov: {
      type: gov, headOfState: lead?.hos || null, headOfGov: lead?.hog || null,
      leaderTag: lead ? { prov: 'verified', src: lead.src, date: lead.date } : { prov: 'estimate', src: 'Not bundled — fetch live (Wikidata) when running locally' },
      approval: 42 + rnd() * 16, stability: clamp(45 + (L - 3) * 10 + rnd() * 15, 20, 90), legitimacy: 60 + rnd() * 15, corruption,
      nextElection: 1 + Math.floor(rnd() * 48), cycle: rnd() < 0.5 ? 4 : 5, parties: makeParties(iso, gov, rnd), centralBank: !euro, reforms: [], regionalAutonomy: 0.3,
    },
    policy, infra: clamp(25 + (L - 2.7) * 28 + rnd() * 6, 8, 96), tech: clamp(15 + (L - 2.7) * 30 + rnd() * 8, 5, 97), influence: 0, diploPoints: 30,
    resources: { oil, gas, coal, minerals: MINERAL_PRODUCERS[iso] || 0.05, agri: AGRI_PRODUCERS[iso] || 0.2 },
    energyUse: eg.primary_energy_consumption?.v || (gdp / 1000) * 1.5, renewables: eg.renewables_share_energy?.v ?? 10,
    ai: {
      aggression: clamp(rnd() * 0.5 + (gov === 'authoritarian' || gov === 'theocracy' ? 0.25 : 0) + (iso === 'RUS' ? 0.3 : 0), 0, 1),
      cooperation: clamp(0.3 + rnd() * 0.5 + (isDemocracy(gov) ? 0.15 : 0), 0, 1), ambition: rnd(), goals: [], longGoal: 'prosperity', memory: [], lastAct: 0,
    },
    tags, hist: { t: [], gdp: [], growth: [], infl: [], unemp: [], debt: [], approval: [], stability: [], fx: [], equity: [], bond: [] }, core: [],
  };
  if (c.gov.type !== 'full_democracy' && c.gov.type !== 'flawed_democracy') c.gov.nextElection = 9999;
  c.econ.growth = 1 + conv * 0; // replaced by first tick dynamics
  return c;
}

export interface ScenarioOptions { id: string; seed?: number }

export function buildContemporary(seed = 2026): WorldState {
  const w: WorldState = {
    version: 1, scenario: 'contemporary', scenarioName: 'Contemporary world', seed, rng: seed, t: 0, startYear: 2026, startMonth: 11, day: 0, player: null,
    countries: {}, territories: [], treaties: [], sanctions: [], wars: [], orgs: [], rel: {}, companies: [], commodities: {},
    global: { risk: 24, demand: 3, ecbRate: 2.0, usRate: 4.0, riskHist: [], climate: 1.3, pandemic: 0 }, news: [],
    portfolio: { cash: 0, holdings: [], history: [] }, watchlist: ['commodity:brent', 'commodity:gold', 'equity:USA', 'equity:CHN', 'bond:FRA'],
    settings: { aiEnabled: false, realDataMode: 'reference', difficulty: 1, autosaveMonths: 6, defenseMinister: true }, diverged: false, log: [], proposals: [], chats: {},
    turn: { n: 1, orders: [], maxOrders: 3, jump: 1 }, reports: [],
  };
  // Territories
  w.territories = WORLD.territories.map((t): Territory => ({ i: t.i, owner: t.owner, controller: t.owner, unrest: 0, baseGdp: t.gdp, basePop: t.pop, area: t.area, iso: t.iso, name: t.name, nameFr: t.nameFr }));
  // Countries = owners
  const owners = [...new Set(w.territories.map((t) => t.owner))];
  for (const iso of owners) {
    const b = WORLD.countries[iso]; if (!b) continue;
    const est = GDP_ESTIMATES[iso];
    let gdp = b.real.gdp?.v ?? est?.gdp ?? 1000; let pop = b.real.pop?.v ?? est?.pop ?? 100000;
    // add dependent territories (e.g. Greenland to Denmark), keeping their own real values
    for (const t of w.territories) if (t.owner === iso && t.iso && t.iso !== iso) { gdp += t.baseGdp; pop += t.basePop; }
    const c = makeCountry(iso, { gdp, pop, ownTag: !b.real.gdp && !!est }, w);
    if (iso === 'ATA') { c.alive = true; c.ai.aggression = 0; }
    w.countries[iso] = c;
  }
  w.territories.forEach((t) => { if (t.iso === t.owner || !t.iso) w.countries[t.owner]?.core.push(t.i); });
  for (const iso of owners) { const c = w.countries[iso]; if (c && !NATIONAL_COLORS[iso]) c.color = colorFor(iso, [...countryNeighbors(w, iso)].map((n) => w.countries[n]?.color).filter(Boolean) as string[]); }
  if (w.countries.ATA) w.countries.ATA.color = '#dfe8ee';
  // Organizations
  w.orgs = ORGS.map((o): Org => ({ id: o.id, name: o.name, nameFr: o.nameFr, kind: o.kind, members: o.members === 'UN' ? owners.filter((i) => WORLD.countries[i]?.unMember) : o.members.filter((m) => w.countries[m]), tag: ORG_TAG }));
  DEFENSE_PACTS.forEach(([a, b], k) => w.treaties.push({ id: `dp${k}`, type: 'defense', a, b, start: -120 }));
  // Sanctions in force at start (estimate of major regimes)
  const sanc = (from: string[], to: string, level: number) => from.forEach((f) => w.countries[f] && w.sanctions.push({ from: f, to, level, start: -24 }));
  const EU = ORGS.find((o) => o.id === 'EU')!.members as string[];
  sanc(['USA', 'GBR', 'CAN', 'JPN', 'AUS', 'NOR', 'CHE', ...EU], 'RUS', 3);
  sanc(['USA', 'GBR', 'CAN', ...EU], 'IRN', 3); sanc(['USA', 'JPN', 'KOR', 'GBR', ...EU], 'PRK', 3); sanc(['USA'], 'CUB', 3); sanc(['USA'], 'VEN', 2); sanc(['USA', ...EU], 'BLR', 2);
  // Wars in progress at start (verified context, see CONTEXT_SOURCES)
  const ukr = w.territories.find((t) => t.owner === 'UKR')!;
  w.wars.push({ id: 'ukr', attackers: ['RUS'], defenders: ['UKR'], start: -57, score: 8, goals: [ukr.i], occupied: [], casualties: 0 });
  w.wars.push({ id: 'irn', attackers: ['USA', 'ISR'], defenders: ['IRN'], start: -9, score: 15, goals: [], occupied: [], casualties: 0 });
  for (const iso of ['RUS', 'UKR', 'IRN', 'ISR']) w.countries[iso].mil.exhaustion = iso === 'UKR' || iso === 'RUS' ? 45 : 25;
  // Commodities
  for (const c of COMMODITIES) w.commodities[c.id] = { id: c.id, price: c.price, base: c.id === 'brent' ? 72 : c.id === 'gold' ? 2400 : 100, unit: c.unit, hist: [], ref: (c as any).ref } as Commodity;
  // Companies
  w.companies = COMPANIES.filter(([, hq]) => w.countries[hq]).map(([name, hq, sector], k): Company => {
    const c = w.countries[hq]; const rnd = seeded(hashStr(name));
    const share = 0.04 + rnd() * 0.12;
    const revenue = c.econ.gdp * c.econ.sectors[sector].share * share;
    const margin = 0.06 + rnd() * 0.14;
    return { id: 'co' + k, name, hq, sector, real: true, state: STATE_OWNED.has(name), revenue, margin, marketCap: revenue * margin * 18, employees: Math.round(revenue * 2.2), rd: 0.03 + rnd() * 0.1, share, alive: true, hist: [], intl: [] };
  });
  return w;
}

export function startWorld(w: WorldState, player: string | null) {
  w.player = player;
  if (player && w.countries[player]) w.portfolio.cash = Math.round(w.countries[player].econ.gdp * 0.02);
  return w;
}
