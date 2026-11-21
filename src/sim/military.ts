// Abstract strategic war model: power projection, front pressure, occupation, alliances, exhaustion, peace.
import type { War, WorldState } from './types';
import { clamp, rand, randn, uid } from './util';
import { addRel, allies, atWar, getRel, power, remember, invalidate } from './relations';
import { countryNeighbors, T_NEIGHBORS } from './geo';
import { news } from './events';
import { transferTerritory } from './borders';

export function projection(w: WorldState, from: string, to: string) {
  if (countryNeighbors(w, from).has(to)) return 1;
  const c = w.countries[from];
  // Blue-water reach grows with tech and size of military capital
  return clamp(0.15 + c.mil.tech / 250 + Math.log10(Math.max(1, c.mil.capital)) / 25, 0.15, 0.75);
}
export function sidePower(w: WorldState, side: string[], enemy: string[]) {
  return side.reduce((s, a) => { const c = w.countries[a]; if (!c?.alive) return s; const proj = Math.max(...enemy.map((e) => projection(w, a, e))); return s + power(c) * proj; }, 0);
}

export function canDeclare(w: WorldState, a: string, b: string): { ok: boolean; reason?: string } {
  if (a === b || !w.countries[a]?.alive || !w.countries[b]?.alive) return { ok: false, reason: 'err.invalid' };
  if (atWar(w, a, b)) return { ok: false, reason: 'err.alreadyWar' };
  if (w.treaties.some((t) => (t.type === 'nap' || t.type === 'ceasefire' || t.type === 'peace') && ((t.a === a && t.b === b) || (t.a === b && t.b === a)) && (t.until ?? 1e9) > w.t)) return { ok: false, reason: 'err.treatyBlocks' };
  return { ok: true };
}

export function declareWar(w: WorldState, a: string, b: string, goals?: number[]): War | null {
  const chk = canDeclare(w, a, b); if (!chk.ok) return null;
  // default goal: target territories bordering the attacker (or all of target's core if none border)
  let g = goals && goals.length ? goals : w.territories.filter((t) => t.owner === b && T_NEIGHBORS[t.i].some((j) => w.territories[j].owner === a)).map((t) => t.i);
  if (!g.length) g = w.territories.filter((t) => t.owner === b).slice(0, 1).map((t) => t.i);
  const war: War = { id: uid(w, 'war'), attackers: [a], defenders: [b], start: w.t, score: 0, goals: g, occupied: [], casualties: 0 };
  // Defensive obligations
  for (const ally of allies(w, b)) {
    if (ally === a || allies(w, a).includes(ally)) continue;
    const rel = getRel(w, ally, b);
    const mandatory = w.orgs.some((o) => o.kind === 'military' && o.members.includes(ally) && o.members.includes(b)) || w.treaties.some((t) => t.type === 'defense' || t.type === 'alliance' ? (t.a === ally && t.b === b) || (t.b === ally && t.a === b) : false);
    if (ally !== w.player && (mandatory ? rand(w) < 0.85 : rand(w) < rel / 150)) war.defenders.push(ally);
  }
  for (const ally of allies(w, a)) if (ally !== w.player && !war.defenders.includes(ally) && getRel(w, ally, b) < -40 && rand(w) < 0.4) war.attackers.push(ally);
  w.wars.push(war);
  for (const d of war.defenders) { addRel(w, a, d, -60); remember(w, d, a, 'war_declared', -40); }
  // Global reaction
  for (const c of Object.values(w.countries)) if (c.alive && c.iso !== a && !war.attackers.includes(c.iso)) { addRel(w, c.iso, a, -8); }
  w.global.risk += 6;
  invalidate();
  news(w, 'conflict', 'ev.war', { a, b, n: war.defenders.length - 1 }, [a, b], 3, ['cause.hostility'], ['eff.marketsDown', 'eff.oilUp'], 'simulated', { kind: 'war', id: war.id });
  return war;
}

export function warTick(w: WorldState) {
  for (const war of w.wars) {
    if (war.ceasefire) continue;
    const A = sidePower(w, war.attackers, war.defenders), D = sidePower(w, war.defenders, war.attackers) * 1.35;
    const tot = A + D || 1;
    war.score = clamp(war.score + ((A - D) / tot) * 6 + randn(w) * 2.5, -100, 100);
    war.casualties += Math.round(Math.sqrt(tot) * 0.4);
    const lead = war.attackers[0];
    if (war.goals.length && war.score > 25 && rand(w) < (war.score - 15) / 220) {
      const next = war.goals.find((g) => !war.occupied.includes(g));
      if (next !== undefined) { war.occupied.push(next); w.territories[next].controller = lead; w.territories[next].unrest = 40; news(w, 'conflict', 'ev.occupied', { a: lead, t: w.territories[next].name }, [lead, w.territories[next].owner], 2, ['cause.offensive'], ['eff.occupation'], 'simulated', { kind: 'war', id: war.id }); }
    } else if (war.occupied.length && war.score < -10 && rand(w) < 0.12) {
      const ti = war.occupied.pop()!; const t = w.territories[ti]; t.controller = t.owner;
      news(w, 'conflict', 'ev.liberated', { d: t.owner, t: t.name }, [t.owner], 2, ['cause.counteroffensive'], ['eff.frontShift'], 'simulated', { kind: 'war', id: war.id });
    }
    // AI-to-AI war termination
    const att = w.countries[lead], def = w.countries[war.defenders[0]];
    if (!att || !def) { war.ceasefire = true; continue; }
    const humanInvolved = [...war.attackers, ...war.defenders].includes(w.player || '');
    if (!humanInvolved && w.t - war.start > 6) {
      if (att.mil.exhaustion > 75 && def.mil.exhaustion > 60 && rand(w) < 0.08) endWar(w, war, war.score > 30 ? 'cede' : 'ceasefire');
      else if (war.score > 80 && war.occupied.length === war.goals.length && war.goals.length && rand(w) < 0.15) endWar(w, war, 'cede');
      else if (war.score < -60 && rand(w) < 0.1) endWar(w, war, 'white');
      else if (!war.goals.length && war.score > 60 && w.t - war.start > 12 && rand(w) < 0.06) endWar(w, war, 'ceasefire');
      else if (w.t - war.start > 36 && att.mil.exhaustion > 55 && def.mil.exhaustion > 55 && rand(w) < 0.04) endWar(w, war, 'ceasefire');
    }
  }
  w.wars = w.wars.filter((x) => !x.ceasefire || w.t - x.start < 240);
}

export function warSide(war: War, iso: string) { return war.attackers.includes(iso) ? 'att' : war.defenders.includes(iso) ? 'def' : null; }

// AI acceptance of peace proposed by `from`.
export function peaceAcceptable(w: WorldState, war: War, from: string, terms: 'white' | 'cede' | 'ceasefire') {
  const side = warSide(war, from); if (!side) return false;
  const other = side === 'att' ? war.defenders[0] : war.attackers[0];
  const o = w.countries[other]; if (!o) return true;
  const scoreForOther = side === 'att' ? -war.score : war.score;
  if (terms === 'cede') return side === 'def' ? scoreForOther > -20 : scoreForOther < -45 || (o.mil.exhaustion > 80 && scoreForOther < 0);
  if (terms === 'white') return scoreForOther < 15 || o.mil.exhaustion > 65;
  return scoreForOther < 30 || o.mil.exhaustion > 55;
}

export function endWar(w: WorldState, war: War, terms: 'white' | 'cede' | 'ceasefire') {
  war.ceasefire = true;
  const lead = war.attackers[0];
  for (const ti of war.occupied) {
    const t = w.territories[ti];
    if (terms === 'cede') transferTerritory(w, ti, lead, 'conquest');
    else if (terms === 'white') t.controller = t.owner;
  }
  for (const a of war.attackers) for (const d of war.defenders) {
    w.treaties.push({ id: uid(w, 'tr'), type: terms === 'ceasefire' ? 'ceasefire' : 'peace', a, b: d, start: w.t, until: w.t + (terms === 'ceasefire' ? 24 : 120) });
    addRel(w, a, d, 15); remember(w, d, a, 'peace_' + terms, terms === 'cede' ? -30 : 10);
  }
  w.global.risk = Math.max(14, w.global.risk - 4);
  invalidate();
  news(w, 'conflict', 'ev.peace.' + terms, { a: lead, b: war.defenders[0] }, [lead, war.defenders[0]], 2, ['cause.exhaustion'], [terms === 'cede' ? 'eff.bordersChanged' : 'eff.stabilityUp'], 'simulated', { kind: 'war', id: war.id });
}
