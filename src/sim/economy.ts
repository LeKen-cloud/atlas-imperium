// Monthly macroeconomic and financial dynamics for one country. All rates annualized, step = 1 month.
import type { Country, Sector, WorldState } from './types';
import { SECTORS } from './types';
import { clamp, randn } from './util';
import { sanctionsOn, warsOf } from './relations';
import { tradeView } from './trade';
import { EUROZONE } from '../data/reference';

export interface EconCtx { oilChg: number; oilRel: number; risk: number; riskChg: number; usInfl: number; usRate: number; ezInfl: number; ezGap: number }

export const level = (c: Country) => Math.log10(Math.max(300, (c.econ.gdp * 1e6) / Math.max(1, c.soc.pop)));
export const gdpPc = (c: Country) => (c.econ.gdp * 1e6) / Math.max(1, c.soc.pop);
export const debtRatio = (c: Country) => (c.econ.debt / Math.max(1, c.econ.gdp)) * 100;
export const totalSpend = (c: Country) => Object.values(c.policy.spending).reduce((a, b) => a + b, 0);
export function netEnergyExport(c: Country, oilPrice: number) {
  const prod = c.resources.oil * 47 * (oilPrice / 80) + c.resources.gas * 20 + c.resources.coal * 10;
  const use = c.energyUse * (1 - c.renewables / 100) * 18 * (0.5 + oilPrice / 160);
  return (prod - use) / Math.max(1, c.econ.gdp); // share of GDP
}
export function hasMonetaryAuthority(c: Country) { return c.gov.centralBank && !EUROZONE.includes(c.iso) && c.currency !== 'EUR'; }

// Expected structural indices for an income level; potential growth responds to deviations from them.
export const expected = (L: number) => ({ edu: 28 + (L - 2.7) * 27, infra: 25 + (L - 2.7) * 28, tech: 15 + (L - 2.7) * 30, corr: 80 - (L - 2.7) * 28 });
export function potentialGrowth(c: Country) {
  const L = level(c); const conv = clamp((4.95 - L) / 2.1, 0, 1);
  const p = c.policy; const x = expected(L);
  let g = 0.5 + 4.0 * conv;
  g += (c.soc.education - x.edu) * 0.04 + (c.infra - x.infra) * 0.03 + (c.tech - x.tech) * 0.04;
  g -= (c.gov.corruption - x.corr) * 0.03;
  g += c.soc.popGrowth * 0.6 + (p.migration - 0.4) * 0.5;
  g -= (p.regulation - 0.5) * 0.8;
  g += (p.fdiOpenness - 0.5) * 0.8 - (p.corpTax - 25) * 0.025;
  g += (c.gov.stability - 55) * 0.015;
  g -= Math.max(0, p.tariff - 8) * 0.04;
  if (c.gov.reforms.some((r) => r.id === 'labor')) g += 0.3;
  if (c.gov.reforms.some((r) => r.id === 'digital')) g += 0.2;
  return clamp(g, -1, 8);
}

export function econTick(w: WorldState, c: Country, ctx: EconCtx) {
  const e = c.econ, p = c.policy, f = c.fin;
  const tv = tradeView();
  const wars = warsOf(w, c.iso);
  const warLoad = wars.reduce((s, x) => s + (x.goals.length || x.id === 'irn' ? 1 : 0.5), 0);
  const sanc = sanctionsOn(w, c.iso).reduce((s, x) => s + x.level * (w.countries[x.from]?.econ.gdp || 0), 0) / 2e7; // weighted by sanctioner size
  e.potential = potentialGrowth(c);
  // Demand impulses
  const fiscal = clamp((e.deficit - 3) * 0.22, -1.5, 2);
  const real = e.policyRate - e.inflation;
  const neutral = 0.5 + e.potential * 0.4;
  const monetary = clamp(-(real - neutral) * 0.3, -3, 2);
  const openness = (e.exports + e.imports) / 2 / Math.max(1, e.gdp);
  const external = clamp(openness * ((tv.partnerGrowth[c.iso] ?? 2.5) - 2.5) * 0.8, -3, 3);
  const tot = clamp(netEnergyExport(c, ctx.oilRel * 80) * ctx.oilChg * 12 * 0.5, -3, 3);
  const confidence = (c.gov.stability - 55) * 0.03 - warLoad * 1.4 - Math.min(4, sanc) - (ctx.risk - 20) * 0.025 - (e.bankHealth < 35 ? (35 - e.bankHealth) * 0.12 : 0);
  const climate = -(w.global.climate - 1.2) * 0.3 - w.global.pandemic * 4;
  const target = e.potential + fiscal + monetary + external + tot + confidence + climate - e.gap * 0.15;
  e.growth += (target - e.growth) * 0.22 + randn(w) * 0.35;
  e.growth = clamp(e.growth, -25, 20);
  e.gap = clamp(e.gap * 0.97 + (e.growth - e.potential) / 12, -15, 10);
  // Inflation
  const fxYoY = c.hist.fx.length >= 12 ? (f.fx / c.hist.fx[c.hist.fx.length - 12] - 1) * 100 : 0;
  const importShare = e.imports / Math.max(1, e.gdp);
  let pi = 2 + 0.3 * e.gap + clamp(fxYoY, -30, 200) * 0.07 * (0.4 + importShare);
  pi += Math.max(0, -netEnergyExport(c, ctx.oilRel * 80)) * ctx.oilChg * 12 * 4 + (ctx.oilRel - 1) * 0.8;
  if (!p.cbIndependent && e.deficit > 5) pi += (e.deficit - 5) * 0.9;
  pi += p.tariff * 0.03;
  if (warLoad) pi += 1.2 * warLoad;
  e.inflation += (pi - e.inflation) * 0.07 + randn(w) * 0.08;
  e.inflation = clamp(e.inflation, -5, 500);
  // Labour market
  e.unemployment += ((e.nairu - 0.45 * e.gap) - e.unemployment) * 0.08;
  e.unemployment = clamp(e.unemployment, 1, 40);
  e.nairu += ((p.regulation - 0.5) * 0.02 - (c.soc.education - 60) * 0.0005);
  e.nairu = clamp(e.nairu, 2.5, 20);
  // Monetary policy
  if (EUROZONE.includes(c.iso) || c.currency === 'EUR') e.policyRate = w.global.ecbRate;
  else if (p.policyRate !== null && hasMonetaryAuthority(c)) e.policyRate = p.policyRate;
  else {
    const taylor = neutral + e.inflation + 0.5 * (e.inflation - 2) + 0.5 * e.gap + (fxYoY > 15 ? 2 : 0);
    e.policyRate += (clamp(taylor, 0, 80) - e.policyRate) * (p.cbIndependent ? 0.15 : 0.08);
  }
  // Nominal GDP in USD (real growth + inflation, converted with exchange-rate change)
  const prevFx = c.hist.fx.length ? c.hist.fx[c.hist.fx.length - 1] : f.fx;
  e.gdp *= (1 + (e.growth + e.inflation) / 1200) * (prevFx / Math.max(1e-9, f.fx));
  e.gdp = Math.max(10, e.gdp);
  e.gdpReal *= 1 + e.growth / 1200;
  // Public finances
  const collection = 1 - (c.gov.corruption - 30) / 300;
  const corpEffect = (p.corpTax - 25) * 0.08;
  const tariffRev = (p.tariff / 100) * importShare * 0.6 * 100;
  const revPct = (p.taxBurden + corpEffect * 0.5 + tariffRev) * collection * (1 + e.gap * 0.012);
  e.effRate += ((f.bond10y + 0.3) - e.effRate) * 0.02;
  e.interest = e.debt * (e.effRate / 100);
  const warCost = warLoad ? e.gdp * 0.01 * warLoad : 0;
  e.revenue = (revPct / 100) * e.gdp;
  e.expenditure = (totalSpend(c) / 100) * e.gdp + e.interest + warCost + (e.unemployment - e.nairu) * 0.003 * e.gdp;
  e.deficit = ((e.expenditure - e.revenue) / e.gdp) * 100;
  e.debt = Math.max(0, e.debt + (e.expenditure - e.revenue) / 12);
  // Investment & FDI
  e.investment = clamp(e.investment + ((22 + (p.fdiOpenness - 0.5) * 6 - (real - 1) * 0.4 + (c.gov.stability - 55) * 0.05 - (p.corpTax - 25) * 0.15) - e.investment) * 0.05, 8, 45);
  e.fdiInflow = Math.max(0, e.gdp * (0.004 + p.fdiOpenness * 0.035 - (p.corpTax - 25) * 0.0008 + (c.gov.stability - 50) * 0.0002 - Math.min(0.02, sanc * 0.004)));
  e.consumption = clamp(100 - e.investment - (totalSpend(c) * 0.6) + (e.imports - e.exports) / e.gdp * 100 * 0.3, 35, 85);
  // Bank health
  e.bankHealth += ((60 + e.gap * 3 - Math.max(0, e.policyRate - 6) * 1.5 - Math.max(0, e.privateDebt - 150) * 0.1 + (p.regulation - 0.5) * 20 - Math.max(0, debtRatio(c) - 120) * 0.15) - e.bankHealth) * 0.04;
  e.bankHealth = clamp(e.bankHealth, 0, 100);
  e.privateDebt = clamp(e.privateDebt + (e.policyRate < e.inflation ? 0.15 : -0.1), 10, 300);
  // Sectors
  const oilRel = ctx.oilRel;
  const sectorBonus: Partial<Record<Sector, number>> = {
    technology: (c.tech - 50) * 0.05 + p.spending.research * 0.6,
    energy: (oilRel - 1) * 6 + (p.energy === 'fossil' ? 1 : p.energy === 'green' ? 0.5 : 0),
    mining: (w.commodities.copper.price / 100 - 1) * 5,
    construction: (p.spending.infrastructure - 3) * 0.8 - Math.max(0, e.policyRate - 4) * 0.4,
    finance: (e.bankHealth - 60) * 0.06,
    tourism: -warLoad * 4 - w.global.pandemic * 20,
    realestate: -Math.max(0, e.policyRate - 4) * 0.5,
    agriculture: (w.commodities.wheat.price / 100 - 1) * 3,
    manufacturing: (p.tariff - 5) * 0.06 - Math.max(0, oilRel - 1) * 1.5,
    health: (p.spending.health - 5) * 0.3, education: (p.spending.education - 4.5) * 0.3,
  };
  let tot2 = 0;
  for (const k of SECTORS) {
    const s = e.sectors[k];
    const strat = p.strategic.includes(k) ? 1.6 : 0;
    s.growth = clamp(e.growth + (sectorBonus[k] || 0) + strat + randn(w) * 0.6, -40, 40);
    s.share *= 1 + (s.growth - e.growth) / 1200;
    s.health = clamp(s.health + ((55 + (s.growth - e.growth) * 6 + strat * 5) - s.health) * 0.1, 0, 100);
    tot2 += s.share;
  }
  for (const k of SECTORS) e.sectors[k].share /= tot2;
  // Structural indices
  const sp = p.spending;
  c.soc.education = clamp(c.soc.education + (sp.education - 4.5) * 0.015 - 0.003, 5, 99);
  c.soc.health = clamp(c.soc.health + (sp.health - 5.5) * 0.012 - 0.003 - w.global.pandemic * 0.2, 5, 99);
  c.infra = clamp(c.infra + (sp.infrastructure - 3) * 0.025 - 0.006, 5, 99);
  c.tech = clamp(c.tech + (sp.research - 1.5) * 0.03 + (p.fdiOpenness - 0.5) * 0.01 + (c.soc.education - 60) * 0.0006, 3, 99);
  e.productivity *= 1 + (e.potential - c.soc.popGrowth) / 1200;
  // Population & society
  const s = c.soc;
  const L = level(c);
  s.popGrowth += ((clamp(2.6 - (L - 2.7) * 1.15, -0.6, 3.2) + (p.migration - 0.4) * 0.8 + (s.netMigration / 10)) - s.popGrowth) * 0.01;
  s.pop *= 1 + s.popGrowth / 1200;
  s.urban = clamp(s.urban + 0.02, 5, 99);
  s.netMigration = clamp(s.netMigration + ((L - 4) * 3 + (p.migration - 0.4) * 6 - warLoad * 8 - (60 - c.gov.stability) * 0.05 - s.netMigration) * 0.05, -30, 20);
  s.gini = clamp(s.gini + ((sp.social - 8) * -0.004) + (p.taxBurden < 20 ? 0.003 : -0.002), 20, 70);
  // Energy transition
  if (p.energy === 'green') c.renewables = clamp(c.renewables + 0.12, 0, 95);
  else if (p.energy === 'nuclear') c.renewables = clamp(c.renewables + 0.05, 0, 95);
  else if (p.energy === 'fossil') { c.resources.oil *= 1.0015; c.resources.gas *= 1.0015; }
  else c.renewables = clamp(c.renewables + 0.04, 0, 95);
  c.energyUse *= 1 + (e.growth * 0.4 - 0.5) / 1200;
  // Military capital
  const m = c.mil; m.spendPct = sp.defense;
  m.capital = Math.max(0, m.capital + (sp.defense / 100) * e.gdp / 12 * (1 - c.gov.corruption / 250) - m.capital * 0.06 / 12);
  m.tech = clamp(m.tech + (c.tech - m.tech) * 0.004 + (sp.research > 2.5 ? 0.01 : 0), 5, 99);
  m.readiness = clamp(m.readiness + ((45 + sp.defense * 6) - m.readiness) * 0.03, 10, 100);
  m.exhaustion = clamp(m.exhaustion + (warLoad ? 1.2 * warLoad : -1.5), 0, 100);
  m.personnel = Math.max(1, m.personnel * (1 + (sp.defense - m.spendPct) / 1200));
  // Expire reforms
  c.gov.reforms = c.gov.reforms.filter((r) => r.until > w.t);
}

export const RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC', 'CC', 'C', 'D'];
export function riskScore(w: WorldState, c: Country) {
  const e = c.econ;
  let r = (debtRatio(c) - 60) * 0.025 + Math.max(0, e.deficit - 3) * 0.22 + Math.max(0, e.inflation - 6) * 0.08 + (60 - c.gov.stability) * 0.035;
  r += warsOf(w, c.iso).length * 1.2 + Math.min(3, sanctionsOn(w, c.iso).reduce((s, x) => s + x.level, 0) * 0.15);
  r -= c.fin.reserveCurrency * 2.5 + (level(c) - 4.2) * 2.0; r += (c.gov.corruption - 40) * 0.025;
  r -= Math.min(1.5, (c.fin.reserves / Math.max(1, e.gdp)) * 3);
  if (e.bankHealth < 40) r += (40 - e.bankHealth) * 0.05;
  return r;
}

export function financeTick(w: WorldState, c: Country, ctx: EconCtx) {
  const e = c.econ, f = c.fin;
  const rs = riskScore(w, c);
  const premium = clamp(rs, 0, 30);
  const target = e.policyRate * 0.55 + Math.max(0, e.inflation) * 0.25 + 1.1 + premium + (ctx.risk - 20) * 0.02;
  const prevBond = f.bond10y;
  f.bond10y = clamp(f.bond10y + (target - f.bond10y) * 0.2 + randn(w) * 0.05, -0.5, 80);
  const ri = clamp(Math.round(4 + rs * 1.6), 0, RATINGS.length - 1);
  f.rating = RATINGS[ri];
  f.cds = Math.round(premium * 85 + 10);
  // FX (USD is the numeraire; EUR handled once for the whole euro area by the engine)
  if (c.currency !== 'USD' && c.currency !== 'EUR') {
    // Fundamental anchor follows the inflation differential (relative PPP); the market rate reverts toward it.
    f.fxAnchor = (f.fxAnchor || f.fx) * (1 + (e.inflation - ctx.usInfl) / 1200);
    const dev = Math.log(f.fx / f.fxAnchor);
    const ca = (e.exports - e.imports) / Math.max(1, e.gdp);
    let chg = dev * 100 * 0.04 + (e.policyRate - e.inflation - (ctx.usRate - ctx.usInfl)) * 0.02 + ca * 1.5 - (rs > 3 ? (rs - 3) * 0.2 : 0) + randn(w) * (0.6 + premium * 0.08);
    if (c.policy.capitalControls) chg *= 0.5;
    if (chg < -1.5 && f.reserves > e.gdp * 0.05) { f.reserves -= e.gdp * 0.004; chg *= 0.6; }
    f.fx = Math.max(1e-6, f.fx * (1 - chg / 100)); // fx = units per USD, so local appreciation lowers it
  }
  f.reserves = Math.max(0, f.reserves + ((e.exports - e.imports) * 0.25 + e.fdiInflow * 0.2) / 12);
  // Equity (simulated national index)
  f.vol = clamp(f.vol + ((14 + premium * 1.4 + (ctx.risk - 18) * 0.5) - f.vol) * 0.2, 6, 90);
  const ret = (e.growth + e.inflation) / 12 + 0.3 - (f.bond10y - prevBond) * 3 - ctx.riskChg * 0.4 + (e.gap - (f as any)._gap || 0) * 0.5 + (e.bankHealth < 35 ? -0.8 : 0) + randn(w) * (f.vol / Math.sqrt(12)) * 0.6;
  (f as any)._gap = e.gap;
  f.equity = Math.max(1, f.equity * (1 + clamp(ret, -45, 45) / 100));
}
