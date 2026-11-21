// Monthly simulation tick: global aggregates → trade → countries (economy, finance, politics) → wars →
// markets → AI decisions → events → history. Deterministic for a given seed and action sequence.
import type { WorldState } from './types';
import { computeTrade } from './trade';
import { econTick, financeTick, type EconCtx } from './economy';
import { politicsTick } from './politics';
import { warTick } from './military';
import { commoditiesTick, companiesTick, portfolioTick } from './markets';
import { aiTick } from './countryAI';
import { emergentEvents, news } from './events';
import { clamp, pushHist, rand } from './util';
import { EUROZONE } from '../data/reference';
import { secede } from './borders';
import { invalidate } from './relations';

export function tick(w: WorldState) {
  const alive = Object.values(w.countries).filter((c) => c.alive && c.iso !== 'ATA');
  // Global demand = GDP-weighted growth
  let gs = 0, gg = 0; for (const c of alive) { gs += c.econ.growth * c.econ.gdp; gg += c.econ.gdp; }
  w.global.demand = gg ? gs / gg : 3;
  // Euro area: one central bank, one currency
  const ez = alive.filter((c) => EUROZONE.includes(c.iso) || c.currency === 'EUR');
  let ezI = 0, ezG = 0, ezW = 0, ezCa = 0, ezRisk = 0;
  for (const c of ez) { ezI += c.econ.inflation * c.econ.gdp; ezG += c.econ.gap * c.econ.gdp; ezW += c.econ.gdp; ezCa += c.econ.exports - c.econ.imports; ezRisk += Math.max(0, c.fin.bond10y - 3) * c.econ.gdp; }
  const ezInfl = ezW ? ezI / ezW : 2, ezGap = ezW ? ezG / ezW : 0;
  const us = w.countries.USA;
  if (us?.alive) w.global.usRate = us.econ.policyRate;
  const ecbTarget = clamp(1.0 + ezInfl + 0.5 * (ezInfl - 2) + 0.5 * ezGap, 0, 15);
  w.global.ecbRate += (ecbTarget - w.global.ecbRate) * 0.12;
  // Risk sentiment (VIX-like)
  const bigWars = w.wars.filter((x) => !x.ceasefire).length;
  const crises = alive.reduce((s, c) => s + ((c.econ.bankHealth < 30 || c.fin.bond10y > 9) ? (c.econ.gdp > 1e6 ? 3 : c.econ.gdp > 300000 ? 1 : 0) : 0), 0);
  w.global.risk = clamp(w.global.risk + ((14 + bigWars * 2 + crises * 1.5 - Math.min(0, w.global.demand - 2) * 4 + w.global.pandemic * 30) - w.global.risk) * 0.15 + (rand(w) - 0.5) * 2, 9, 85);
  pushHist(w.global.riskHist, w.global.risk);
  // Commodities first so countries see this month's prices
  commoditiesTick(w);
  const oil = w.commodities.brent.price;
  const ctx: EconCtx = { oilChg: w.global.oilPrev ? Math.log(oil / w.global.oilPrev) : 0, oilRel: oil / 80, risk: w.global.risk, riskChg: w.global.riskPrev ? w.global.risk - w.global.riskPrev : 0, usInfl: us?.econ.inflation ?? 2.5, usRate: w.global.usRate, ezInfl, ezGap };
  w.global.oilPrev = oil; w.global.riskPrev = w.global.risk;
  computeTrade(w);
  for (const c of alive) econTick(w, c, ctx);
  // Euro FX: one rate for the whole area, driven by aggregate fundamentals
  const E = ez[0]?.fin;
  if (E) {
    const anchor = (E.fxAnchor || E.fx) * (1 + (ezInfl - ctx.usInfl) / 1200);
    const dev = Math.log(E.fx / anchor);
    const chg = dev * 100 * 0.04 + (w.global.ecbRate - ezInfl - (ctx.usRate - ctx.usInfl)) * 0.02 + (ezCa / Math.max(1, ezW)) * 1.5 - (ezRisk / Math.max(1, ezW)) * 0.05 + (rand(w) - 0.5) * 1.2;
    const fx = Math.max(0.2, E.fx * (1 - chg / 100));
    for (const c of ez) { c.fin.fx = fx; c.fin.fxAnchor = anchor; }
  }
  for (const c of alive) financeTick(w, c, ctx);
  for (const c of alive) politicsTick(w, c);
  warTick(w);
  // Territorial unrest & secession
  for (const t of w.territories) {
    const o = w.countries[t.owner]; if (!o) continue;
    const foreign = t.iso && t.iso !== t.owner && !o.core.includes(t.i);
    const occupied = t.controller !== t.owner;
    if (foreign || occupied) t.unrest = clamp(t.unrest + 1.2 - o.gov.stability * 0.015 - o.gov.regionalAutonomy * 1.5, 0, 100);
    else t.unrest = Math.max(0, t.unrest - 1);
    if (foreign && !occupied && t.unrest > 85 && rand(w) < 0.04 && w.territories.filter((x) => x.owner === t.owner).length > 1) secede(w, [t.i]);
  }
  companiesTick(w);
  for (const c of alive) {
    // diplomatic capacity & influence
    c.influence = clamp(Math.log10(Math.max(10, c.econ.gdp)) * 9 - 25 + c.mil.tech * 0.1 + w.orgs.filter((o) => o.members.includes(c.iso)).length * 1.5, 0, 100);
    c.diploPoints = Math.min(100, c.diploPoints + 1.5 + c.influence / 25);
    if (c.iso !== w.player) aiTick(w, c);
  }
  emergentEvents(w);
  w.proposals = w.proposals.filter((p) => w.t - p.t < 12 && w.countries[p.from]?.alive);
  w.t++;
  for (const c of alive) {
    const h = c.hist;
    h.t.push(w.t); if (h.t.length > 240) h.t.shift();
    pushHist(h.gdp, c.econ.gdp); pushHist(h.growth, c.econ.growth); pushHist(h.infl, c.econ.inflation); pushHist(h.unemp, c.econ.unemployment);
    pushHist(h.debt, (c.econ.debt / c.econ.gdp) * 100); pushHist(h.approval, c.gov.approval); pushHist(h.stability, c.gov.stability);
    pushHist(h.fx, c.fin.fx); pushHist(h.equity, c.fin.equity); pushHist(h.bond, c.fin.bond10y);
  }
  portfolioTick(w);
  if (w.t === 1) news(w, 'meta', 'ev.timelineStart', {}, [], 1, [], [], 'simulated');
  return w;
}

// Settle derived values (growth, rates, yields, ratings) by running a throw-away copy forward,
// then copy only those fields back — real levels (GDP, debt, prices, borders, diplomacy) stay as loaded.
export function warmup(w: WorldState, months = 4) {
  const copy: WorldState = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < months; i++) tick(copy);
  for (const iso of Object.keys(w.countries)) {
    const a = w.countries[iso].econ, b = copy.countries[iso]?.econ; if (!b) continue;
    a.growth = b.growth; a.potential = b.potential; a.gap = b.gap; a.policyRate = b.policyRate; a.effRate = b.effRate; a.tradeK = b.tradeK; a.unemployment = b.unemployment;
    a.exports = b.exports; a.imports = b.imports; a.deficit = b.deficit; a.revenue = b.revenue; a.expenditure = b.expenditure; a.interest = b.interest;
    const f = w.countries[iso].fin, g = copy.countries[iso].fin; f.bond10y = g.bond10y; f.rating = g.rating; f.cds = g.cds; f.vol = g.vol;
  }
  w.global.ecbRate = copy.global.ecbRate; w.global.usRate = copy.global.usRate;
  w.global.oilPrev = 0; w.global.riskPrev = 0;
  computeTrade(w);
  return w;
}
