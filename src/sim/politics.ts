// Domestic politics: approval, stability, elections, coalitions, coups, protests and separatism.
import type { Country, WorldState } from './types';
import { isDemocracy } from './types';
import { clamp, rand, randn } from './util';
import { allocateSeats, formCoalition, govEcon } from './init';
import { warsOf } from './relations';
import { news } from './events';
import { debtRatio } from './economy';

export function policyAlignment(c: Country) {
  // How well current fiscal stance matches the ruling coalition's ideology (-1 left .. +1 right).
  const ideo = govEcon(c);
  const p = c.policy;
  const leftness = (p.taxBurden - 30) / 15 + (p.spending.social - 9) / 6 - (p.regulation - 0.5);
  return -Math.abs(ideo + leftness * 0.6) * 4;
}

export function politicsTick(w: WorldState, c: Country) {
  const g = c.gov, e = c.econ;
  const wars = warsOf(w, c.iso);
  const misery = e.inflation + e.unemployment;
  let rally = 0;
  for (const x of wars) { const age = w.t - x.start; rally += age < 6 ? 6 : -c.mil.exhaustion * 0.12; }
  const austerity = Math.max(0, (c.hist.debt.length > 12 ? 0 : 0));
  const target = 50 + (e.growth - 2) * 2.6 - (misery - 9) * 1.3 - (g.corruption - 40) * 0.2 + rally + policyAlignment(c) - austerity - (e.bankHealth < 30 ? 8 : 0);
  g.approval = clamp(g.approval + (target - g.approval) * 0.09 + randn(w) * 0.8, 3, 97);
  const auth = !isDemocracy(g.type);
  const unrest = w.territories.filter((t) => t.owner === c.iso).reduce((s, t) => s + t.unrest, 0) / 20;
  const stTarget = 30 + g.approval * 0.35 + c.soc.cohesion * 0.2 - (c.soc.gini - 35) * 0.35 + g.legitimacy * 0.15 - wars.length * 6 - unrest + (auth ? 10 : 0) - Math.max(0, e.inflation - 15) * 0.3 - (debtRatio(c) > 150 ? 4 : 0);
  g.stability = clamp(g.stability + (stTarget - g.stability) * 0.06, 0, 100);
  g.legitimacy = clamp(g.legitimacy + ((auth ? 40 + g.approval * 0.3 : 55 + g.approval * 0.4) - g.legitimacy) * 0.02, 0, 100);
  g.corruption = clamp(g.corruption + (g.reforms.some((r) => r.id === 'anticorruption') ? -0.25 : 0.01), 3, 97);
  c.soc.cohesion = clamp(c.soc.cohesion + ((60 - (c.soc.gini - 35) * 0.6 - (c.policy.migration - 0.4) * 10 + (g.stability - 50) * 0.1) - c.soc.cohesion) * 0.02, 5, 95);
  // party support drift
  if (isDemocracy(g.type)) {
    for (const p of g.parties) {
      const inc = p.inGov ? (g.approval - 45) * 0.0004 : -(g.approval - 45) * 0.00025;
      const populist = p.bloc === 'nationalist' ? (misery - 10) * 0.0003 + (c.policy.migration - 0.4) * 0.0008 : 0;
      const green = p.bloc === 'green' ? (w.global.climate - 1.3) * 0.0005 : 0;
      p.support = clamp(p.support + inc + populist + green + randn(w) * 0.002, 0.005, 0.8);
    }
    const tot = g.parties.reduce((s, p) => s + p.support, 0); g.parties.forEach((p) => (p.support /= tot));
  }
  // Elections
  if ((g.type === 'full_democracy' || g.type === 'flawed_democracy') && w.t >= g.nextElection) election(w, c);
  if (g.type === 'hybrid' && w.t >= g.nextElection) { election(w, c, true); }
  // Protests
  if (g.stability < 38 && rand(w) < (38 - g.stability) / 120) {
    news(w, 'social', 'ev.protests', { c: c.iso }, [c.iso], g.stability < 20 ? 3 : 2, ['cause.lowStability', misery > 15 ? 'cause.misery' : 'cause.approval'], ['eff.stabilityDown']);
    g.stability -= 1.5; c.econ.growth -= 0.2;
  }
  // Coups (non-full democracies only)
  if (g.type !== 'full_democracy' && g.stability < 20 && rand(w) < 0.025) coup(w, c);
  // Democratization pressure
  if (!isDemocracy(g.type) && g.type !== 'theocracy' && g.stability < 18 && c.soc.education > 55 && rand(w) < 0.01) {
    g.type = 'hybrid'; g.nextElection = w.t + 6;
    news(w, 'politics', 'ev.revolution', { c: c.iso }, [c.iso], 3, ['cause.lowStability', 'cause.education'], ['eff.regimeChange']);
    g.parties = [{ id: 'left', bloc: 'left', econ: -0.5, auth: 0.3, support: 0.3, seats: 0, inGov: false }, { id: 'centre', bloc: 'centre', econ: 0, auth: 0.3, support: 0.4, seats: 0, inGov: false }, { id: 'centre_right', bloc: 'centre_right', econ: 0.4, auth: 0.4, support: 0.3, seats: 0, inGov: false }];
    allocateSeats(g.parties); formCoalition(g.parties);
    c.gov.headOfState = null; c.gov.leaderTag = { prov: 'simulated', src: 'Transitional government (simulation)' };
  }
}

export function election(w: WorldState, c: Country, managed = false) {
  const g = c.gov;
  const before = g.parties.filter((p) => p.inGov).map((p) => p.id).sort().join(',');
  if (managed) {
    const reg = g.parties.find((p) => p.inGov) || g.parties[0];
    reg.support = clamp(reg.support + 0.05, 0.4, 0.8);
  } else {
    for (const p of g.parties) {
      p.support *= p.inGov ? 0.78 + g.approval / 180 : 1.08 - g.approval / 600;
      p.support *= Math.exp(randn(w) * 0.12);
    }
    const tot = g.parties.reduce((s, p) => s + p.support, 0); g.parties.forEach((p) => (p.support /= tot));
  }
  allocateSeats(g.parties); formCoalition(g.parties);
  g.nextElection = w.t + g.cycle * 12;
  const after = g.parties.filter((p) => p.inGov).map((p) => p.id).sort().join(',');
  const lead = [...g.parties].sort((a, b) => b.seats - a.seats)[0];
  const changed = before !== after;
  if (changed) {
    g.approval = 55; g.headOfGov = null; g.leaderTag = { prov: 'simulated', src: 'Elected in simulation' };
    adaptPolicyToGovernment(w, c);
  }
  news(w, 'politics', changed ? 'ev.electionChange' : 'ev.electionHold', { c: c.iso, party: 'party.' + lead.bloc, seats: lead.seats }, [c.iso], changed ? 2 : 1,
    [g.approval < 45 ? 'cause.approval' : 'cause.incumbency'], [changed ? 'eff.policyShift' : 'eff.continuity']);
}

// AI-controlled governments adjust fiscal stance toward their ideology; the player keeps their settings.
export function adaptPolicyToGovernment(w: WorldState, c: Country) {
  if (c.iso === w.player) return;
  const ideo = govEcon(c); const p = c.policy;
  p.taxBurden = clamp(p.taxBurden - ideo * 1.5, 8, 50);
  p.spending.social = clamp(p.spending.social - ideo * 0.8, 1, 25);
  p.regulation = clamp(p.regulation - ideo * 0.05, 0.1, 0.9);
  p.corpTax = clamp(p.corpTax - ideo * 2, 9, 40);
  const nat = c.gov.parties.find((x) => x.bloc === 'nationalist');
  if (nat?.inGov) { p.migration = clamp(p.migration - 0.15, 0, 1); p.tariff = clamp(p.tariff + 2, 0, 40); p.spending.defense = clamp(p.spending.defense + 0.3, 0.3, 15); }
  const green = c.gov.parties.find((x) => x.bloc === 'green');
  if (green?.inGov) p.energy = 'green';
}

export function coup(w: WorldState, c: Country) {
  const g = c.gov;
  g.type = 'authoritarian'; g.stability = clamp(g.stability + 15, 0, 100); g.approval = 40; g.legitimacy = 30;
  g.headOfState = null; g.headOfGov = null; g.leaderTag = { prov: 'simulated', src: 'Military junta (simulation)' };
  g.parties = [{ id: 'regime', bloc: 'regime', econ: 0.1, auth: 0.95, support: 0.7, seats: 100, inGov: true }, { id: 'opposition', bloc: 'opposition', econ: -0.1, auth: 0.3, support: 0.3, seats: 0, inGov: false }];
  g.nextElection = 9999; c.policy.cbIndependent = false;
  c.fin.equity *= 0.85; c.econ.growth -= 2;
  news(w, 'politics', 'ev.coup', { c: c.iso }, [c.iso], 3, ['cause.lowStability'], ['eff.regimeChange', 'eff.marketsDown']);
}
