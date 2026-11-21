// Dynamic territorial system: transfers, secession, new countries, dissolution.
import type { WorldState } from './types';
import { WORLD } from './geo';
import { makeCountry } from './init';
import { invalidate } from './relations';
import { news } from './events';

export function territoryWeight(w: WorldState, i: number) {
  const t = w.territories[i];
  if (t.baseGdp > 0) return t.baseGdp;
  const owned = w.territories.filter((x) => x.owner === t.owner).length;
  return owned === 1 ? 1 : Math.max(1, t.area / 1000);
}
function ownerWeight(w: WorldState, iso: string) { return w.territories.filter((t) => t.owner === iso).reduce((s, t) => s + territoryWeight(w, t.i), 0); }

export function transferTerritory(w: WorldState, i: number, to: string, reason = 'treaty', addEcon = true) {
  const t = w.territories[i]; const from = t.owner;
  if (from === to) return;
  const A = w.countries[from];
  const tw = territoryWeight(w, i), aw = ownerWeight(w, from) || 1;
  const fr = Math.min(1, tw / aw);
  if (!w.countries[to] || !w.countries[to].alive) { if (w.countries[to]) delete w.countries[to]; createCountry(w, to, [i]); addEcon = false; }
  const B = w.countries[to];
  if (A) {
    const g = A.econ.gdp * fr, p = A.soc.pop * fr, d = A.econ.debt * fr;
    A.econ.gdp -= g; A.soc.pop -= p; A.econ.debt -= d;
    if (addEcon) { B.econ.gdp += g; B.soc.pop += p; B.econ.debt += d * 0.3; B.econ.tradeK = 0; }
    A.econ.tradeK = 0; A.area -= t.area; if (A.area < 0) A.area = 0;
  }
  B.area += t.area;
  t.owner = to; t.controller = to;
  t.unrest = B.core.includes(i) ? 0 : 35;
  invalidate();
  if (A && !w.territories.some((x) => x.owner === from)) dissolve(w, from, to);
  if (reason !== 'silent') news(w, 'borders', 'ev.transfer', { t: t.name, from, to }, [from, to].filter((x) => w.countries[x]), 2, ['cause.' + reason], ['eff.bordersChanged'], 'simulated', { kind: 'country', id: to });
}

export function createCountry(w: WorldState, iso: string, tis: number[], name?: string) {
  const base = WORLD.countries[iso];
  const gdp = Math.max(100, tis.reduce((s, i) => { const t = w.territories[i]; const o = w.countries[t.owner]; return s + (o ? o.econ.gdp * Math.min(1, territoryWeight(w, i) / (ownerWeight(w, t.owner) || 1)) : t.baseGdp); }, 0));
  const pop = Math.max(1000, tis.reduce((s, i) => { const t = w.territories[i]; const o = w.countries[t.owner]; return s + (o ? o.soc.pop * Math.min(1, territoryWeight(w, i) / (ownerWeight(w, t.owner) || 1)) : t.basePop); }, 0));
  const c = makeCountry(iso, { gdp, pop, name: name || base?.name || iso, nameFr: name || base?.nameFr || iso, flag: base?.flag || '🏳️' }, w);
  c.custom = !base; c.area = 0; c.core = [...tis];
  c.gov.leaderTag = { prov: 'simulated', src: 'Created in simulation' }; c.gov.headOfState = null; c.gov.headOfGov = null;
  for (const k of Object.keys(c.tags)) if (!['capital', 'area'].includes(k)) c.tags[k] = { prov: 'simulated', src: 'Derived when the country formed in-game' };
  w.countries[iso] = c;
  const un = w.orgs.find((o) => o.id === 'UN'); if (un && !un.members.includes(iso) && base) un.members.push(iso);
  invalidate();
  return c;
}

// Make a set of territories independent (secession / release / new state).
export function secede(w: WorldState, tis: number[], iso?: string, name?: string) {
  const first = w.territories[tis[0]];
  let id = iso || (first.iso && !w.countries[first.iso]?.alive && first.iso !== first.owner ? first.iso : undefined);
  if (!id) { let k = 1; while (w.countries['X' + String(k).padStart(2, '0')]) k++; id = 'X' + String(k).padStart(2, '0'); }
  const from = first.owner;
  if (w.countries[id] && !w.countries[id].alive) delete w.countries[id];
  createCountry(w, id, tis, name || (id.startsWith('X') ? first.name : undefined));
  for (const i of tis) transferTerritory(w, i, id, 'silent', false);
  news(w, 'borders', 'ev.independence', { c: id, from }, [id, from], 3, ['cause.separatism'], ['eff.newState'], 'simulated', { kind: 'country', id });
  return id;
}

export function dissolve(w: WorldState, iso: string, by?: string) {
  const c = w.countries[iso]; if (!c) return;
  c.alive = false;
  for (const o of w.orgs) o.members = o.members.filter((m) => m !== iso);
  w.treaties = w.treaties.filter((t) => t.a !== iso && t.b !== iso);
  w.sanctions = w.sanctions.filter((s) => s.from !== iso && s.to !== iso);
  for (const war of w.wars) { war.attackers = war.attackers.filter((x) => x !== iso); war.defenders = war.defenders.filter((x) => x !== iso); if (!war.attackers.length || !war.defenders.length) war.ceasefire = true; }
  w.wars = w.wars.filter((x) => !x.ceasefire || x.attackers.length);
  for (const co of w.companies) if (co.hq === iso && by) co.hq = by;
  invalidate();
  news(w, 'borders', 'ev.dissolved', { c: iso, by: by || '' }, [iso], 3, ['cause.conquest'], ['eff.bordersChanged']);
  if (w.player === iso && by) w.player = by;
}
