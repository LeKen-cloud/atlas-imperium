// Rule-based "country brain": runs for every AI-controlled country and is always available
// (the language model, when connected, adds a strategic layer on top; see ai/agents.ts).
import type { Country, WorldState } from './types';
import { isDemocracy } from './types';
import { perform } from './actions';
import { allies, atWar, getRel, power, sanctionLevel, warsOf, hasTreaty, shareOrg } from './relations';
import { countryNeighbors } from './geo';
import { clamp, hashStr, rand } from './util';
import { tradeView, exposure } from './trade';
import { debtRatio, hasMonetaryAuthority } from './economy';
import { warSide } from './military';

export function setGoals(w: WorldState, c: Country) {
  const goals: string[] = [];
  if (debtRatio(c) > 100 || c.fin.bond10y > 7) goals.push('goal.fiscal');
  if (c.econ.inflation > 8) goals.push('goal.inflation');
  if (c.econ.growth < 0.5) goals.push('goal.growth');
  if (warsOf(w, c.iso).length) goals.push('goal.war');
  if (c.gov.stability < 40) goals.push('goal.stability');
  const threats = [...countryNeighbors(w, c.iso)].filter((n) => getRel(w, c.iso, n) < -50 && power(w.countries[n]) > power(c) * 0.8);
  if (threats.length) goals.push('goal.security');
  if (!goals.length) goals.push('goal.prosperity');
  c.ai.goals = goals;
  c.ai.longGoal = c.econ.gdp > 1e6 ? 'long.leadership' : c.ai.aggression > 0.6 ? 'long.regional' : c.tech < 40 ? 'long.develop' : 'long.prosperity';
}

export function aiTick(w: WorldState, c: Country) {
  if ((hashStr(c.iso) + w.t) % 3 !== 0) return; // each AI acts quarterly, staggered
  setGoals(w, c);
  const p = c.policy, e = c.econ;
  // ---- Fiscal & monetary ----
  if (c.ai.goals.includes('goal.fiscal') && e.deficit > 2) { p.taxBurden = clamp(p.taxBurden + 0.3, 5, 50); p.spending.subsidies = Math.max(0.2, p.spending.subsidies - 0.2); p.spending.admin = Math.max(1, p.spending.admin - 0.15); }
  else if (e.growth < -0.5 && debtRatio(c) < 90) { p.spending.infrastructure = clamp(p.spending.infrastructure + 0.25, 0.5, 8); }
  else if (e.deficit > 5 && e.growth > 1.5) { p.spending.subsidies = Math.max(0.2, p.spending.subsidies - 0.15); }
  if (hasMonetaryAuthority(c)) p.policyRate = null; // AI central banks follow their rule
  // Defence posture
  const wars = warsOf(w, c.iso);
  const target = wars.length ? 6 : c.ai.goals.includes('goal.security') ? 3.5 : Math.max(1, p.spending.defense - 0.05);
  p.spending.defense = clamp(p.spending.defense + (target - p.spending.defense) * 0.2, 0.3, 40);
  // Development
  if (c.ai.longGoal === 'long.develop' && p.spending.education < 5) p.spending.education += 0.05;
  if (c.ai.longGoal === 'long.leadership' && p.spending.research < 3.5) p.spending.research += 0.03;
  // ---- Diplomacy ----
  c.diploPoints = Math.min(100, c.diploPoints);
  const partners = (tradeView().partners[c.iso] || []).slice(0, 6);
  if (c.diploPoints > 40 && rand(w) < 0.12 * c.ai.cooperation) {
    const cand = partners.slice(0, 4).find((x) => x.iso !== w.player && !shareOrg(w, c.iso, x.iso, ['economic']) && !hasTreaty(w, c.iso, x.iso, 'fta') && getRel(w, c.iso, x.iso) > 25 && !atWar(w, c.iso, x.iso));
    if (cand) perform(w, c.iso, { type: 'proposeTreaty', target: cand.iso, treaty: 'fta' });
  }
  if (c.diploPoints > 20 && rand(w) < 0.4) {
    const fr = partners[Math.floor(rand(w) * partners.length)];
    if (fr && getRel(w, c.iso, fr.iso) > -20) perform(w, c.iso, { type: 'improveRelations', target: fr.iso });
  }
  // AI proposals to the player (alliances, trade) appear in the player's inbox
  if (w.player && w.countries[w.player]?.alive && rand(w) < 0.012 && getRel(w, c.iso, w.player) > 35 && w.proposals.filter((x) => x.to === w.player).length < 4 && !w.proposals.some((x) => x.from === c.iso)) {
    const offer = !shareOrg(w, c.iso, w.player, ['economic']) && !hasTreaty(w, c.iso, w.player, 'fta') && exposure(c.iso, w.player) > 0.02 ? 'fta'
      : !hasTreaty(w, c.iso, w.player, 'tech') && c.tech > 55 ? 'tech' : !hasTreaty(w, c.iso, w.player, 'investment') ? 'investment' : null;
    if (offer) w.proposals.push({ from: c.iso, to: w.player, treaty: offer, t: w.t });
  }
  // Sanctions against pariahs (democracies vs aggressors)
  if (isDemocracy(c.gov.type) && c.diploPoints > 15) {
    for (const war of w.wars) {
      if (war.ceasefire || w.t - war.start > 3) continue;
      const agg = war.attackers[0];
      if (agg !== c.iso && !allies(w, c.iso).includes(agg) && getRel(w, c.iso, agg) < -10 && !sanctionLevel(w, c.iso, agg) && rand(w) < 0.4) perform(w, c.iso, { type: 'sanction', target: agg, level: getRel(w, c.iso, agg) < -40 ? 2 : 1 });
    }
  }
  // ---- War & peace ----
  for (const war of wars) {
    const side = warSide(war, c.iso); if (!side || war.attackers[0] !== c.iso && war.defenders[0] !== c.iso) continue;
    const myScore = side === 'att' ? war.score : -war.score;
    const enemy = side === 'att' ? war.defenders[0] : war.attackers[0];
    if (enemy === w.player) {
      if ((c.mil.exhaustion > 70 || myScore < -40) && !w.proposals.some((x) => x.from === c.iso)) w.proposals.push({ from: c.iso, to: enemy, treaty: myScore < -40 ? 'peace_white' : 'peace_ceasefire', t: w.t });
      if (myScore > 50 && war.occupied.length && !w.proposals.some((x) => x.from === c.iso)) w.proposals.push({ from: c.iso, to: enemy, treaty: 'peace_cede', t: w.t });
    }
  }
  const activeWars = w.wars.filter((x) => !x.ceasefire).length;
  if (!wars.length && c.ai.aggression > 0.62 && c.mil.exhaustion < 20 && activeWars < 4 && rand(w) < 0.04) {
    const my = power(c);
    const targets = [...countryNeighbors(w, c.iso)].filter((n) => {
      const T = w.countries[n]; if (!T?.alive || T.mil.nuclear) return false;
      if (getRel(w, c.iso, n) > -55) return false;
      const defenders = [n, ...allies(w, n)].reduce((s, x) => s + power(w.countries[x]) * (x === n ? 1 : 0.6), 0);
      return my > defenders * 2.8;
    });
    if (targets.length) perform(w, c.iso, { type: 'declareWar', target: targets[0] });
  }
}
