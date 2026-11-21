// Every change to the world from the player, the rule-based AI or the language model goes through here.
// Actions are validated against game rules; AI-controlled targets decide whether to accept proposals.
import type { Policy, Sector, TreatyType, WorldState } from './types';
import { SECTORS } from './types';
import { addRel, allies, atWar, getRel, hasTreaty, ideologyDistance, power, remember, sanctionLevel, shareOrg, trust, warsOf, invalidate } from './relations';
import { canDeclare, declareWar, endWar, peaceAcceptable, warSide } from './military';
import { news } from './events';
import { clamp, rand, uid } from './util';
import { exposure } from './trade';
import { secede, transferTerritory } from './borders';
import { hasMonetaryAuthority } from './economy';

export type Action =
  | { type: 'setPolicy'; patch: Partial<Policy> }
  | { type: 'setSpending'; key: keyof Policy['spending']; value: number }
  | { type: 'reform'; id: string }
  | { type: 'improveRelations'; target: string }
  | { type: 'denounce'; target: string }
  | { type: 'proposeTreaty'; target: string; treaty: TreatyType }
  | { type: 'cancelTreaty'; target: string; treaty: TreatyType }
  | { type: 'sanction'; target: string; level: number }
  | { type: 'liftSanctions'; target: string }
  | { type: 'declareWar'; target: string; goals?: number[] }
  | { type: 'proposePeace'; target: string; terms: 'white' | 'cede' | 'ceasefire' }
  | { type: 'joinOrg'; org: string } | { type: 'leaveOrg'; org: string }
  | { type: 'createOrg'; name: string; kind: 'military' | 'economic' | 'political'; invite: string[] }
  | { type: 'foreignAid'; target: string; amount: number }
  | { type: 'mediate'; a: string; b: string }
  | { type: 'summit'; invitees: string[] }
  | { type: 'releaseTerritory'; territory: number }
  | { type: 'cedeTerritory'; territory: number; to: string }
  | { type: 'nationalize'; company: string } | { type: 'privatize'; company: string } | { type: 'bailout'; company: string } | { type: 'subsidizeCompany'; company: string }
  | { type: 'strategicSector'; sector: Sector; on: boolean };

export interface Result { ok: boolean; key: string; params?: Record<string, string | number>; accepted?: boolean; reasons?: string[] }

export const REFORMS: Record<string, { months: number; cost: number; stab: number; effect: string }> = {
  anticorruption: { months: 36, cost: 0.3, stab: -3, effect: 'corruption' },
  education: { months: 60, cost: 0.6, stab: 0, effect: 'education' },
  labor: { months: 48, cost: 0, stab: -6, effect: 'potential' },
  pension: { months: 48, cost: -0.8, stab: -8, effect: 'deficit' },
  healthcare: { months: 48, cost: 0.8, stab: 3, effect: 'health' },
  digital: { months: 36, cost: 0.3, stab: 0, effect: 'tech' },
  cbIndependence: { months: 1, cost: 0, stab: 0, effect: 'cb' },
  democratize: { months: 1, cost: 0, stab: -12, effect: 'regime' },
  centralize: { months: 1, cost: 0, stab: -5, effect: 'regime' },
  decentralize: { months: 1, cost: 0, stab: 4, effect: 'autonomy' },
};

const DIP_COST: Record<string, number> = { improveRelations: 10, proposeTreaty: 15, denounce: 5, sanction: 10, mediate: 20, summit: 25, createOrg: 40, joinOrg: 20 };

// Utility of a treaty for target `t` proposed by `a`. >0 = accept.
export function evaluateProposal(w: WorldState, a: string, t: string, treaty: TreatyType): { score: number; reasons: string[] } {
  const A = w.countries[a], T = w.countries[t];
  const rel = getRel(w, a, t), tr = trust(w, t, a);
  const reasons: string[] = [];
  let s = rel * 0.5 + (tr - 50) * 0.4 - ideologyDistance(A, T) * 10 + T.ai.cooperation * 15 - 10;
  if (rel > 30) reasons.push('why.goodRelations'); if (rel < -20) reasons.push('why.badRelations');
  if (tr < 35) reasons.push('why.distrust');
  switch (treaty) {
    case 'fta': { const ex = exposure(t, a); s += ex * 150 + (T.policy.fdiOpenness - 0.5) * 20 - T.policy.tariff * 0.6 - 12; if (ex < 0.015) { s -= 25; reasons.push('why.littleTrade'); } if (ex > 0.05) reasons.push('why.tradePartner'); break; }
    case 'alliance': case 'defense': {
      const threat = warsOf(w, t).length ? 20 : 0;
      const pr = power(A) / Math.max(1, power(T));
      s += Math.min(25, pr * 8) + threat - 20 - (warsOf(w, a).length ? 30 : 0);
      if (warsOf(w, a).length) reasons.push('why.dragIntoWar');
      if (pr > 2) reasons.push('why.strongPartner');
      // won't ally with enemies of its allies
      if (allies(w, t).some((x) => getRel(w, x, a) < -40)) { s -= 30; reasons.push('why.alliesObject'); }
      break;
    }
    case 'nap': s += 15; break;
    case 'investment': s += (T.policy.fdiOpenness - 0.4) * 40 + 5; break;
    case 'tech': s += (A.tech - T.tech) * 0.6; if (A.tech > T.tech) reasons.push('why.techGain'); break;
    default: break;
  }
  if (atWar(w, a, t)) { s = -100; reasons.push('why.atWar'); }
  return { score: s, reasons };
}

export function perform(w: WorldState, actor: string, act: Action): Result {
  const C = w.countries[actor];
  if (!C || !C.alive) return { ok: false, key: 'err.invalid' };
  const tgt = 'target' in act ? w.countries[act.target] : undefined;
  if ('target' in act && (!tgt || !tgt.alive || act.target === actor)) return { ok: false, key: 'err.invalidTarget' };
  const cost = DIP_COST[act.type] || 0;
  if (cost && C.diploPoints < cost) return { ok: false, key: 'err.noDiplo', params: { n: cost } };
  const log = (r: Result) => { w.log.unshift({ t: w.t, actor, action: act.type + ('target' in act ? ':' + act.target : ''), ok: r.ok, detail: r.key }); if (w.log.length > 300) w.log.length = 300; if (r.ok && cost) C.diploPoints -= cost; if (actor === w.player) w.diverged = true; return r; };
  switch (act.type) {
    case 'setPolicy': {
      const p = { ...act.patch };
      if (p.policyRate !== undefined && p.policyRate !== null && !hasMonetaryAuthority(C)) return log({ ok: false, key: 'err.noMonetary' });
      if (p.taxBurden !== undefined) p.taxBurden = clamp(p.taxBurden, 5, 60);
      if (p.corpTax !== undefined) p.corpTax = clamp(p.corpTax, 0, 50);
      if (p.tariff !== undefined) p.tariff = clamp(p.tariff, 0, 60);
      if (p.policyRate !== undefined && p.policyRate !== null) p.policyRate = clamp(p.policyRate, -1, 80);
      for (const k of ['fdiOpenness', 'regulation', 'migration'] as const) if (p[k] !== undefined) p[k] = clamp(p[k] as number, 0, 1);
      const before = { ...C.policy };
      Object.assign(C.policy, p);
      // Abrupt tax hikes and deep cuts hit approval; consequences explained in news
      if (p.taxBurden !== undefined && p.taxBurden - before.taxBurden > 2) C.gov.approval -= (p.taxBurden - before.taxBurden) * 0.8;
      if (p.tariff !== undefined && p.tariff - before.tariff > 5) for (const x of Object.values(w.countries)) if (x.alive && exposure(x.iso, actor) > 0.08) addRel(w, x.iso, actor, -5);
      return log({ ok: true, key: 'ok.policy' });
    }
    case 'setSpending': {
      const v = clamp(act.value, 0, act.key === 'defense' ? 40 : 30);
      const d = v - C.policy.spending[act.key];
      if (d < -1) C.gov.approval -= Math.abs(d) * (act.key === 'social' || act.key === 'health' ? 1.2 : 0.4);
      C.policy.spending[act.key] = +v.toFixed(2);
      return log({ ok: true, key: 'ok.policy' });
    }
    case 'strategicSector': {
      const s = new Set(C.policy.strategic); act.on ? s.add(act.sector) : s.delete(act.sector);
      if (s.size > 4) return log({ ok: false, key: 'err.tooManySectors' });
      C.policy.strategic = [...s].filter((x) => SECTORS.includes(x));
      C.policy.spending.subsidies = +(Math.max(C.policy.spending.subsidies, 0.5 + C.policy.strategic.length * 0.4)).toFixed(2);
      return log({ ok: true, key: 'ok.policy' });
    }
    case 'reform': {
      const R = REFORMS[act.id]; if (!R) return log({ ok: false, key: 'err.invalid' });
      if (C.gov.reforms.some((r) => r.id === act.id)) return log({ ok: false, key: 'err.reformActive' });
      if (C.gov.stability + R.stab < 10) return log({ ok: false, key: 'err.tooUnstable' });
      C.gov.stability += R.stab; C.gov.reforms.push({ id: act.id, until: w.t + R.months });
      if (R.effect === 'education') C.policy.spending.education += R.cost;
      if (R.effect === 'health') C.policy.spending.health += R.cost;
      if (R.effect === 'deficit') C.policy.spending.social = Math.max(1, C.policy.spending.social + R.cost);
      if (R.effect === 'tech') C.policy.spending.research += R.cost;
      if (R.effect === 'cb') { C.policy.cbIndependent = !C.policy.cbIndependent; }
      if (act.id === 'democratize') { const order = ['absolute_monarchy', 'theocracy', 'one_party', 'authoritarian', 'hybrid', 'flawed_democracy', 'full_democracy']; const i = order.indexOf(C.gov.type); C.gov.type = order[Math.min(order.length - 1, Math.max(4, i + 1))] as any; C.gov.nextElection = w.t + 12; }
      if (act.id === 'centralize') { const order = ['full_democracy', 'flawed_democracy', 'hybrid', 'authoritarian']; const i = order.indexOf(C.gov.type); if (i >= 0) C.gov.type = order[Math.min(3, i + 1)] as any; C.gov.regionalAutonomy = Math.max(0, C.gov.regionalAutonomy - 0.2); }
      if (act.id === 'decentralize') { C.gov.regionalAutonomy = Math.min(1, C.gov.regionalAutonomy + 0.2); for (const t of w.territories) if (t.owner === actor) t.unrest = Math.max(0, t.unrest - 15); }
      news(w, 'politics', 'ev.reform', { c: actor, r: 'reform.' + act.id }, [actor], 1, ['cause.policy'], ['eff.reform.' + R.effect]);
      return log({ ok: true, key: 'ok.reform' });
    }
    case 'improveRelations': {
      addRel(w, actor, act.target, 6 + C.influence * 0.05); remember(w, act.target, actor, 'courtesy', 3);
      return log({ ok: true, key: 'ok.relations', params: { c: act.target } });
    }
    case 'denounce': {
      addRel(w, actor, act.target, -12); remember(w, act.target, actor, 'denounced', -8);
      C.gov.approval += C.gov.type === 'full_democracy' ? 0 : 1;
      news(w, 'diplomacy', 'ev.denounce', { a: actor, b: act.target }, [actor, act.target], 1);
      return log({ ok: true, key: 'ok.denounce' });
    }
    case 'proposeTreaty': {
      if (hasTreaty(w, actor, act.target, act.treaty)) return log({ ok: false, key: 'err.exists' });
      const ev = evaluateProposal(w, actor, act.target, act.treaty);
      const accepted = act.target === w.player ? false : ev.score > 0;
      if (act.target === w.player) { w.proposals.push({ from: actor, to: act.target, treaty: act.treaty, t: w.t }); return log({ ok: true, key: 'ok.proposalSent' }); }
      if (accepted) {
        w.treaties.push({ id: uid(w, 'tr'), type: act.treaty, a: actor, b: act.target, start: w.t });
        addRel(w, actor, act.target, 10); remember(w, act.target, actor, 'treaty_' + act.treaty, 6); invalidate();
        news(w, 'diplomacy', 'ev.treaty', { a: actor, b: act.target, k: 'treaty.' + act.treaty }, [actor, act.target], act.treaty === 'alliance' ? 2 : 1, ev.reasons, ['eff.treaty.' + act.treaty]);
      } else { addRel(w, actor, act.target, -2); }
      return log({ ok: true, key: accepted ? 'ok.accepted' : 'ok.rejected', accepted, reasons: ev.reasons, params: { c: act.target } });
    }
    case 'cancelTreaty': {
      const before = w.treaties.length;
      w.treaties = w.treaties.filter((t) => !(t.type === act.treaty && ((t.a === actor && t.b === act.target) || (t.b === actor && t.a === act.target))));
      if (w.treaties.length === before) return log({ ok: false, key: 'err.noTreaty' });
      addRel(w, actor, act.target, -20); remember(w, act.target, actor, 'broke_treaty', -25); invalidate();
      news(w, 'diplomacy', 'ev.treatyCancelled', { a: actor, b: act.target, k: 'treaty.' + act.treaty }, [actor, act.target], 2, ['cause.policy'], ['eff.trustDown']);
      return log({ ok: true, key: 'ok.cancelled' });
    }
    case 'sanction': {
      const lv = clamp(Math.round(act.level), 1, 3);
      const ex = w.sanctions.find((s) => s.from === actor && s.to === act.target);
      if (ex) ex.level = lv; else w.sanctions.push({ from: actor, to: act.target, level: lv, start: w.t });
      addRel(w, actor, act.target, -15 * lv); remember(w, act.target, actor, 'sanctioned', -10 * lv); invalidate();
      // the sanctioner also bears costs proportional to its exposure
      C.econ.growth -= exposure(actor, act.target) * lv * 2;
      news(w, 'trade', 'ev.sanctions', { a: actor, b: act.target, l: lv }, [actor, act.target], lv, ['cause.hostility'], ['eff.tradeDown', 'eff.reroute']);
      return log({ ok: true, key: 'ok.sanctioned' });
    }
    case 'liftSanctions': {
      if (!sanctionLevel(w, actor, act.target)) return log({ ok: false, key: 'err.noSanctions' });
      w.sanctions = w.sanctions.filter((s) => !(s.from === actor && s.to === act.target)); addRel(w, actor, act.target, 10); remember(w, act.target, actor, 'sanctions_lifted', 8); invalidate();
      news(w, 'trade', 'ev.sanctionsLifted', { a: actor, b: act.target }, [actor, act.target], 1);
      return log({ ok: true, key: 'ok.lifted' });
    }
    case 'declareWar': {
      const chk = canDeclare(w, actor, act.target); if (!chk.ok) return log({ ok: false, key: chk.reason! });
      const war = declareWar(w, actor, act.target, act.goals);
      if (!war) return log({ ok: false, key: 'err.invalid' });
      C.gov.approval += C.gov.type === 'full_democracy' ? -6 : 3;
      return log({ ok: true, key: 'ok.war', params: { n: war.defenders.length } });
    }
    case 'proposePeace': {
      const war = w.wars.find((x) => !x.ceasefire && warSide(x, actor) && (x.attackers.includes(act.target) || x.defenders.includes(act.target)));
      if (!war) return log({ ok: false, key: 'err.noWar' });
      const leadOther = warSide(war, actor) === 'att' ? war.defenders[0] : war.attackers[0];
      const ok = leadOther === w.player ? false : peaceAcceptable(w, war, actor, act.terms);
      if (leadOther === w.player) { w.proposals.push({ from: actor, to: leadOther, treaty: ('peace_' + act.terms) as any, t: w.t }); return log({ ok: true, key: 'ok.proposalSent' }); }
      if (ok) endWar(w, war, act.terms);
      return log({ ok: true, key: ok ? 'ok.peace' : 'ok.peaceRejected', accepted: ok });
    }
    case 'joinOrg': {
      const o = w.orgs.find((x) => x.id === act.org); if (!o) return log({ ok: false, key: 'err.invalid' });
      if (o.members.includes(actor)) return log({ ok: false, key: 'err.exists' });
      const support = o.members.length ? o.members.reduce((s, m) => s + getRel(w, m, actor), 0) / o.members.length : 50;
      const ok = o.custom || o.id === 'UN' || o.id === 'IMF' || support > (o.kind === 'military' ? 35 : 20);
      if (ok) { o.members.push(actor); invalidate(); news(w, 'diplomacy', 'ev.joinOrg', { c: actor, o: o.id }, [actor], 2, ['cause.policy'], ['eff.blocBonus']); }
      return log({ ok: true, key: ok ? 'ok.joined' : 'ok.joinRejected', accepted: ok, params: { s: Math.round(support) } });
    }
    case 'leaveOrg': {
      const o = w.orgs.find((x) => x.id === act.org); if (!o || !o.members.includes(actor)) return log({ ok: false, key: 'err.invalid' });
      o.members = o.members.filter((m) => m !== actor);
      for (const m of o.members) { addRel(w, m, actor, -10); remember(w, m, actor, 'left_org', -10); }
      invalidate(); news(w, 'diplomacy', 'ev.leaveOrg', { c: actor, o: o.id }, [actor], 2, ['cause.policy'], ['eff.tradeDown']);
      return log({ ok: true, key: 'ok.left' });
    }
    case 'createOrg': {
      const id = 'ORG' + (w.orgs.length + 1);
      const members = [actor];
      for (const inv of act.invite) { const r = getRel(w, inv, actor); if (w.countries[inv]?.alive && (inv === w.player ? false : r > 25 + rand(w) * 20)) members.push(inv); }
      w.orgs.push({ id, name: act.name, nameFr: act.name, kind: act.kind, members, custom: true, tag: { prov: 'simulated', src: 'Founded in simulation' } });
      invalidate(); news(w, 'diplomacy', 'ev.orgFounded', { c: actor, o: act.name, n: members.length }, members, 2, ['cause.policy'], ['eff.blocBonus']);
      return log({ ok: true, key: 'ok.orgCreated', params: { n: members.length } });
    }
    case 'foreignAid': {
      const amt = clamp(act.amount, 0, C.econ.gdp * 0.02);
      C.econ.debt += amt; tgt!.econ.growth += (amt / tgt!.econ.gdp) * 30; tgt!.gov.stability += Math.min(5, (amt / tgt!.econ.gdp) * 100);
      addRel(w, actor, act.target, Math.min(25, 5 + (amt / tgt!.econ.gdp) * 300)); remember(w, act.target, actor, 'aid', 10);
      C.influence += 1;
      news(w, 'diplomacy', 'ev.aid', { a: actor, b: act.target, v: Math.round(amt) }, [actor, act.target], 1);
      return log({ ok: true, key: 'ok.aid' });
    }
    case 'mediate': {
      const r = getRel(w, act.a, act.b); const ok = getRel(w, actor, act.a) > 0 && getRel(w, actor, act.b) > 0;
      if (ok) { addRel(w, act.a, act.b, 12); C.influence += 2; const war = w.wars.find((x) => !x.ceasefire && warSide(x, act.a) && warSide(x, act.b)); if (war && rand(w) < 0.3) endWar(w, war, 'ceasefire'); }
      news(w, 'diplomacy', ok ? 'ev.mediationOk' : 'ev.mediationFail', { c: actor, a: act.a, b: act.b }, [actor, act.a, act.b], 1);
      void r; return log({ ok: true, key: ok ? 'ok.mediated' : 'ok.mediationFailed', accepted: ok });
    }
    case 'summit': {
      const attend = act.invitees.filter((i) => w.countries[i]?.alive && getRel(w, i, actor) > -10);
      for (let i = 0; i < attend.length; i++) { addRel(w, actor, attend[i], 5); for (let j = i + 1; j < attend.length; j++) addRel(w, attend[i], attend[j], 3); }
      C.influence += attend.length * 0.5;
      news(w, 'diplomacy', 'ev.summit', { c: actor, n: attend.length }, [actor, ...attend], 1);
      return log({ ok: true, key: 'ok.summit', params: { n: attend.length } });
    }
    case 'releaseTerritory': {
      const t = w.territories[act.territory]; if (!t || t.owner !== actor) return log({ ok: false, key: 'err.invalid' });
      if (w.territories.filter((x) => x.owner === actor).length < 2) return log({ ok: false, key: 'err.lastTerritory' });
      const id = secede(w, [act.territory]); addRel(w, actor, id, 40);
      return log({ ok: true, key: 'ok.released' });
    }
    case 'cedeTerritory': {
      const t = w.territories[act.territory]; if (!t || t.owner !== actor || !w.countries[act.to]?.alive) return log({ ok: false, key: 'err.invalid' });
      if (w.territories.filter((x) => x.owner === actor).length < 2) return log({ ok: false, key: 'err.lastTerritory' });
      transferTerritory(w, act.territory, act.to, 'treaty'); addRel(w, actor, act.to, 25);
      return log({ ok: true, key: 'ok.ceded' });
    }
    case 'nationalize': case 'privatize': case 'bailout': case 'subsidizeCompany': {
      const co = w.companies.find((x) => x.id === act.company); if (!co || co.hq !== actor) return log({ ok: false, key: 'err.notDomestic' });
      if (act.type === 'nationalize') { if (co.state) return log({ ok: false, key: 'err.exists' }); C.econ.debt += co.marketCap * 0.6; co.state = true; C.policy.fdiOpenness = clamp(C.policy.fdiOpenness - 0.05, 0, 1); for (const x of co.intl) addRel(w, x, actor, -3); }
      if (act.type === 'privatize') { if (!co.state) return log({ ok: false, key: 'err.invalid' }); C.econ.debt = Math.max(0, C.econ.debt - co.marketCap * 0.5); co.state = false; }
      if (act.type === 'bailout') { C.econ.debt += co.revenue * 0.2; co.margin = Math.max(co.margin, 0.02); co.alive = true; }
      if (act.type === 'subsidizeCompany') { C.econ.debt += co.revenue * 0.03; co.margin += 0.02; co.rd += 0.01; }
      news(w, 'business', 'ev.corp.' + act.type, { c: actor, co: co.name }, [actor], 1, ['cause.policy'], [], 'simulated', { kind: 'company', id: co.id });
      return log({ ok: true, key: 'ok.corp' });
    }
  }
  return { ok: false, key: 'err.invalid' };
}

// Proposals from AI to the player wait in w.proposals for a decision in the UI.
export function respondProposal(w: WorldState, idx: number, accept: boolean) {
  const p = w.proposals[idx]; if (!p) return;
  w.proposals.splice(idx, 1);
  if (p.treaty.startsWith('peace_')) {
    const war = w.wars.find((x) => !x.ceasefire && warSide(x, p.from) && warSide(x, p.to));
    if (war && accept) endWar(w, war, p.treaty.slice(6) as any);
    return;
  }
  if (accept) { w.treaties.push({ id: uid(w, 'tr'), type: p.treaty as TreatyType, a: p.from, b: p.to, start: w.t }); addRel(w, p.from, p.to, 10); remember(w, p.from, p.to, 'accepted_' + p.treaty, 8); invalidate(); news(w, 'diplomacy', 'ev.treaty', { a: p.from, b: p.to, k: 'treaty.' + p.treaty }, [p.from, p.to], 1); }
  else { addRel(w, p.from, p.to, -4); remember(w, p.from, p.to, 'rejected', -3); }
}
void shareOrg;
