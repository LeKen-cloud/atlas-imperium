// Commodities, corporations and the player's sovereign-wealth portfolio (all simulated prices).
import type { Company, Holding, WorldState } from './types';
import { clamp, pushHist, rand, randn, seeded, hashStr } from './util';
import { news } from './events';
import { sanctionsOn, warsOf } from './relations';

const OIL_PRODUCERS = ['SAU', 'RUS', 'USA', 'IRQ', 'IRN', 'ARE', 'KWT', 'VEN', 'NGA', 'LBY', 'KAZ', 'CAN', 'NOR', 'QAT'];
export function commoditiesTick(w: WorldState) {
  const C = w.commodities;
  const totalOil = OIL_PRODUCERS.reduce((s, i) => s + (w.countries[i]?.resources.oil || 0), 0) || 1;
  let supply = 0;
  for (const i of OIL_PRODUCERS) {
    const c = w.countries[i]; if (!c?.alive) continue; const share = c.resources.oil / totalOil;
    if (warsOf(w, i).length) supply += share * 1.6;
    supply += share * Math.min(3, sanctionsOn(w, i).reduce((s, x) => s + x.level, 0) / 12) * 0.5;
  }
  const gulfWar = w.wars.some((x) => !x.ceasefire && [...x.attackers, ...x.defenders].some((i) => ['IRN', 'SAU', 'IRQ', 'ARE', 'KWT', 'QAT'].includes(i)));
  const demand = 1 + (w.global.demand - 3) * 0.06 - w.global.pandemic * 0.3;
  const renew = Object.values(w.countries).reduce((s, c) => s + c.renewables * c.energyUse, 0) / Math.max(1, Object.values(w.countries).reduce((s, c) => s + c.energyUse, 0));
  const step = (id: string, fund: number, speed: number, vol: number) => {
    const c = C[id]; if (!c) return;
    const drift = speed * Math.log(Math.max(1e-6, fund) / c.price);
    c.price = Math.max(c.base * 0.15, c.price * Math.exp(drift + randn(w) * vol));
  };
  step('brent', C.brent.base * demand * (1 + supply) * (gulfWar ? 1.45 : 1) * (1 - (renew - 15) * 0.006), 0.12, 0.07);
  step('gas', C.gas.base * demand * (1 + supply * 1.3) * (gulfWar ? 1.35 : 1), 0.12, 0.08);
  step('gold', C.gold.base * (1 + (w.global.risk - 18) * 0.02) * (1 + Math.max(0, avgInfl(w) - 2) * 0.05) * 1.35, 0.03, 0.035);
  step('silver', 100 * demand * (1 + (w.global.risk - 18) * 0.01), 0.06, 0.05);
  step('copper', 100 * demand * (1 + (renew - 15) * 0.01), 0.08, 0.05);
  step('lithium', 100 * demand * (1 + (renew - 15) * 0.03), 0.06, 0.08);
  step('uranium', 100 * (1 + Object.values(w.countries).filter((c) => c.policy.energy === 'nuclear').length * 0.03), 0.05, 0.05);
  const agriWar = w.wars.some((x) => !x.ceasefire && [...x.attackers, ...x.defenders].some((i) => ['UKR', 'RUS'].includes(i)));
  step('wheat', 100 * (1 + (w.global.climate - 1.3) * 0.5) * (agriWar ? 1.12 : 1), 0.08, 0.05);
  step('corn', 100 * (1 + (w.global.climate - 1.3) * 0.4), 0.08, 0.05);
  for (const c of Object.values(C)) pushHist(c.hist, c.price);
}
const avgInfl = (w: WorldState) => { let s = 0, g = 0; for (const c of Object.values(w.countries)) if (c.alive) { s += c.econ.inflation * c.econ.gdp; g += c.econ.gdp; } return g ? s / g : 2; };

const SYL = ['Nor', 'Vel', 'Astra', 'Kai', 'Lumen', 'Orix', 'Tera', 'Nova', 'Quanta', 'Sol', 'Vert', 'Axi', 'Cor', 'Hel', 'Ion', 'Mira', 'Pax', 'Zen'];
const SUF: Record<string, string> = { technology: 'Systems', energy: 'Power', finance: 'Capital', manufacturing: 'Industries', health: 'Bio', mining: 'Resources', telecom: 'Networks', logistics: 'Freight', retail: 'Markets', agriculture: 'Agro', construction: 'Build', transport: 'Lines', tourism: 'Travel', education: 'Learning', realestate: 'Estates' };

export function companiesTick(w: WorldState) {
  for (const co of w.companies) {
    if (!co.alive) continue;
    const c = w.countries[co.hq]; if (!c?.alive) { co.alive = false; continue; }
    const s = c.econ.sectors[co.sector];
    const sectorOut = c.econ.gdp * s.share;
    co.share = clamp(co.share * (1 + (co.rd - 0.05) * 0.02 + randn(w) * 0.01), 0.005, 0.6);
    co.revenue += (sectorOut * co.share * (1 + co.intl.length * 0.05) - co.revenue) * 0.15;
    const sanc = sanctionsOn(w, co.hq).length ? 0.03 : 0;
    co.margin = clamp(co.margin + ((0.1 + (s.health - 55) * 0.002 - sanc - Math.max(0, c.econ.policyRate - 6) * 0.004) - co.margin) * 0.1 + randn(w) * 0.006, -0.4, 0.45);
    const pe = clamp(18 - (c.fin.bond10y - 4) * 1.3 + (s.growth - c.econ.growth) * 0.5 + (co.sector === 'technology' ? 8 : 0), 4, 60);
    co.marketCap = Math.max(1, Math.max(co.revenue * 0.01, co.revenue * co.margin) * pe);
    co.employees = Math.round(co.revenue * 2.2);
    pushHist(co.hist, co.marketCap, 120);
    // international expansion
    if (co.margin > 0.15 && rand(w) < 0.01) {
      const p = Object.values(w.countries).filter((x) => x.alive && x.policy.fdiOpenness > 0.5 && x.iso !== co.hq && !co.intl.includes(x.iso));
      if (p.length) { const tgt = p[Math.floor(rand(w) * p.length)]; co.intl.push(tgt.iso); tgt.econ.fdiInflow += co.revenue * 0.05; news(w, 'business', 'ev.expansion', { co: co.name, c: tgt.iso }, [co.hq, tgt.iso], 1, [], [], 'simulated', { kind: 'company', id: co.id }); }
    }
    // bankruptcy
    if (co.margin < -0.2 && !co.state && rand(w) < 0.08) {
      co.alive = false; c.econ.unemployment += Math.min(1, co.employees / Math.max(1, c.soc.pop) * 100);
      news(w, 'business', 'ev.bankruptcy', { co: co.name, c: co.hq }, [co.hq], 2, ['cause.losses'], ['eff.jobsLost'], 'simulated', { kind: 'company', id: co.id });
    }
  }
  // M&A: quarterly
  if (w.t % 3 === 0 && rand(w) < 0.35) {
    const alive = w.companies.filter((x) => x.alive);
    const buyer = alive[Math.floor(rand(w) * alive.length)];
    const target = alive.filter((x) => x !== buyer && x.sector === buyer?.sector && x.marketCap < buyer.marketCap * 0.5).sort((a, b) => a.margin - b.margin)[0];
    if (buyer && target && buyer.margin > 0.08) {
      const home = w.countries[target.hq];
      const blocked = home.policy.regulation > 0.75 || (target.state && target.hq !== buyer.hq) || (target.hq !== buyer.hq && home.policy.fdiOpenness < 0.3);
      if (blocked) news(w, 'business', 'ev.mergerBlocked', { a: buyer.name, b: target.name, c: target.hq }, [buyer.hq, target.hq], 1, ['cause.competition'], [], 'simulated', { kind: 'company', id: buyer.id });
      else {
        buyer.revenue += target.revenue; buyer.intl = [...new Set([...buyer.intl, ...target.intl, target.hq !== buyer.hq ? target.hq : ''].filter(Boolean))]; target.alive = false;
        news(w, 'business', 'ev.merger', { a: buyer.name, b: target.name }, [buyer.hq, target.hq], 2, ['cause.consolidation'], ['eff.marketShare'], 'simulated', { kind: 'company', id: buyer.id });
      }
    }
  }
  // New companies emerge in dynamic, high-tech economies (clearly simulated, generated names)
  if (rand(w) < 0.03) {
    const cands = Object.values(w.countries).filter((c) => c.alive && c.tech > 60 && c.econ.growth > 2);
    if (cands.length) {
      const c = cands[Math.floor(rand(w) * cands.length)];
      const sector = Object.entries(c.econ.sectors).sort((a, b) => b[1].growth - a[1].growth)[0][0] as Company['sector'];
      const r = seeded(hashStr(c.iso + w.t));
      const name = SYL[Math.floor(r() * SYL.length)] + SYL[Math.floor(r() * SYL.length)].toLowerCase() + ' ' + (SUF[sector] || 'Group');
      const revenue = c.econ.gdp * c.econ.sectors[sector].share * 0.01;
      w.companies.push({ id: 'sim' + w.t + Math.floor(r() * 1000), name, hq: c.iso, sector, real: false, state: false, revenue, margin: 0.05, marketCap: revenue * 0.05 * 30, employees: Math.round(revenue * 2), rd: 0.12, share: 0.01, alive: true, hist: [], intl: [] });
      news(w, 'business', 'ev.newCompany', { co: name, c: c.iso }, [c.iso], 1, ['cause.innovation'], [], 'simulated');
    }
  }
}

// ---- Portfolio ----
export function priceOf(w: WorldState, id: string): number | null {
  const [kind, key] = id.split(':');
  if (kind === 'equity') return w.countries[key]?.alive ? w.countries[key].fin.equity : null;
  if (kind === 'bond') { const c = w.countries[key]; if (!c?.alive) return null; return +(100 * Math.exp(-(c.fin.bond10y - 4) * 0.08)).toFixed(3); }
  if (kind === 'commodity') return w.commodities[key]?.price ?? null;
  if (kind === 'company') { const co = w.companies.find((x) => x.id === key); return co?.alive ? co.marketCap / 1000 : 0; }
  if (kind === 'fx') { const c = w.countries[key]; return c ? 1 / c.fin.fx : null; }
  return null;
}
export function trade(w: WorldState, id: string, usd: number): boolean {
  const price = priceOf(w, id); if (!price) return false;
  const kind = id.split(':')[0] as Holding['kind'];
  let h = w.portfolio.holdings.find((x) => x.id === id);
  if (usd > 0) {
    if (w.portfolio.cash < usd) return false;
    if (!h) { h = { kind, id, units: 0, cost: 0 }; w.portfolio.holdings.push(h); }
    h.units += usd / price; h.cost += usd; w.portfolio.cash -= usd;
  } else {
    if (!h) return false;
    const units = Math.min(h.units, -usd / price); const frac = units / h.units;
    h.units -= units; h.cost *= 1 - frac; w.portfolio.cash += units * price;
    if (h.units < 1e-9) w.portfolio.holdings = w.portfolio.holdings.filter((x) => x !== h);
  }
  return true;
}
export function portfolioValue(w: WorldState) {
  return w.portfolio.cash + w.portfolio.holdings.reduce((s, h) => s + h.units * (priceOf(w, h.id) || 0), 0);
}
export function portfolioTick(w: WorldState) {
  // bonds pay coupons monthly
  for (const h of w.portfolio.holdings) if (h.kind === 'bond') { const c = w.countries[h.id.split(':')[1]]; if (c) w.portfolio.cash += h.units * (priceOf(w, h.id) || 0) * (c.fin.bond10y / 1200); }
  pushHist(w.portfolio.history, portfolioValue(w), 240);
}
