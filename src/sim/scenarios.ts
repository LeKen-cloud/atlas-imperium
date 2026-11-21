// Scenario catalogue and scenario-editor operations.
import type { GovType, WorldState } from './types';
import { buildContemporary, startWorld, makeParties } from './init';
import { warmup } from './engine';
import { invalidate } from './relations';
import { WORLD } from './geo';
import { createCountry } from './borders';
import { seeded, hashStr } from './util';

export interface ScenarioDef { id: string; status: 'ready' | 'alt' | 'planned'; year: number }
export const SCENARIOS: ScenarioDef[] = [
  { id: 'contemporary', status: 'ready', year: 2026 },
  { id: 'sandbox', status: 'alt', year: 2026 },
  { id: 'ussr', status: 'alt', year: 2026 },
  { id: 'eurofed', status: 'alt', year: 2026 },
  { id: 'coldwar', status: 'planned', year: 1962 },
  { id: 'ww2', status: 'planned', year: 1939 },
  { id: 'ww1', status: 'planned', year: 1914 },
  { id: 'interwar', status: 'planned', year: 1925 },
];

export function mergeCountries(w: WorldState, into: string, list: string[], name?: string, nameFr?: string, flag?: string) {
  const H = w.countries[into];
  for (const iso of list) {
    if (iso === into) continue; const c = w.countries[iso]; if (!c?.alive) continue;
    H.econ.gdp += c.econ.gdp; H.soc.pop += c.soc.pop; H.econ.debt += c.econ.debt; H.mil.capital += c.mil.capital; H.mil.personnel += c.mil.personnel;
    H.fin.reserves += c.fin.reserves; H.area += c.area; H.resources.oil += c.resources.oil; H.resources.gas += c.resources.gas; H.resources.coal += c.resources.coal; H.energyUse += c.energyUse;
    for (const t of w.territories) if (t.owner === iso) { t.owner = into; t.controller = into; H.core.push(t.i); }
    c.alive = false;
    for (const o of w.orgs) o.members = o.members.filter((m) => m !== iso);
    w.treaties = w.treaties.filter((t) => t.a !== iso && t.b !== iso);
    w.sanctions = w.sanctions.filter((s) => s.from !== iso && s.to !== iso);
    for (const co of w.companies) if (co.hq === iso) co.hq = into;
    for (const war of w.wars) { war.attackers = war.attackers.filter((x) => x !== iso); war.defenders = war.defenders.filter((x) => x !== iso); }
  }
  w.wars = w.wars.filter((x) => x.attackers.length && x.defenders.length && !x.attackers.some((a) => x.defenders.includes(a)));
  if (name) { H.name = name; H.nameFr = nameFr || name; }
  if (flag) H.flag = flag;
  H.econ.tradeK = 0;
  for (const k of ['gdp', 'pop', 'debt', 'inflation']) H.tags[k] = { prov: 'simulated', src: 'Alternate-history merge of real country data' };
  invalidate();
}

export function setGovType(w: WorldState, iso: string, type: GovType) {
  const c = w.countries[iso]; c.gov.type = type; c.gov.parties = makeParties(iso, type, seeded(hashStr(iso + type)));
  c.gov.nextElection = type === 'full_democracy' || type === 'flawed_democracy' || type === 'hybrid' ? w.t + 12 : 9999;
  c.tags.gov = { prov: 'simulated', src: 'Set in scenario editor' };
}

export function buildScenario(id: string, seed = 2026): WorldState {
  const w = buildContemporary(seed);
  if (id === 'sandbox') {
    w.scenario = 'sandbox'; w.scenarioName = 'Sandbox'; w.wars = []; w.sanctions = []; w.diverged = true;
    for (const c of Object.values(w.countries)) c.mil.exhaustion = 0;
  }
  if (id === 'ussr') {
    w.scenario = 'ussr'; w.scenarioName = 'USSR endures'; w.diverged = true;
    mergeCountries(w, 'RUS', ['UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'KGZ', 'TJK', 'ARM', 'AZE', 'GEO', 'MDA', 'LTU', 'LVA', 'EST'], 'Soviet Union', 'Union soviétique', '☭');
    setGovType(w, 'RUS', 'one_party'); w.countries.RUS.gov.headOfState = null; w.countries.RUS.gov.leaderTag = { prov: 'simulated', src: 'Alternate history' };
    w.orgs.find((o) => o.id === 'NATO')!.members = w.orgs.find((o) => o.id === 'NATO')!.members;
  }
  if (id === 'eurofed') {
    w.scenario = 'eurofed'; w.scenarioName = 'European Federation'; w.diverged = true;
    const eu = [...w.orgs.find((o) => o.id === 'EU')!.members];
    mergeCountries(w, 'DEU', eu, 'European Federation', 'Fédération européenne', '🇪🇺');
    const D = w.countries.DEU; D.capital = 'Brussels'; D.capitalLL = WORLD.countries.BEL.capitalLL; D.currency = 'EUR'; D.currencyName = 'Euro'; D.gov.centralBank = true;
    w.orgs.find((o) => o.id === 'EU')!.members = ['DEU'];
  }
  invalidate();
  warmup(w);
  return w;
}
export function newGame(id: string, player: string | null, seed = 2026) { return startWorld(buildScenario(id, seed), player); }

// Editor: create a new country from selected territories
export function editorCreateCountry(w: WorldState, tis: number[], name: string, color?: string) {
  let k = 1; while (w.countries['N' + String(k).padStart(2, '0')]) k++;
  const iso = 'N' + String(k).padStart(2, '0');
  const c = createCountry(w, iso, tis, name);
  c.capitalLL = WORLD.countries[w.territories[tis[0]].owner]?.capitalLL || null;
  for (const i of tis) { const t = w.territories[i]; const o = w.countries[t.owner]; if (o) { const share = 1 / Math.max(1, w.territories.filter((x) => x.owner === o.iso).length); o.econ.gdp *= 1 - share * 0.5; } t.owner = iso; t.controller = iso; }
  if (color) c.color = color;
  w.diverged = true; invalidate();
  return iso;
}
export function editorAssign(w: WorldState, ti: number, to: string) {
  const t = w.territories[ti]; if (!w.countries[to]) return;
  t.owner = to; t.controller = to; w.countries[to].alive = true; w.diverged = true; invalidate();
  const prev = Object.values(w.countries).filter((c) => c.alive && !w.territories.some((x) => x.owner === c.iso) && c.iso !== 'ATA');
  for (const c of prev) c.alive = false;
}
