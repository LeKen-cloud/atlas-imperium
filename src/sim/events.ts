// Event engine: news creation, emergent crisis detection and exogenous shocks.
import type { NewsItem, Prov, WorldState } from './types';
import { clamp, pick, rand, uid } from './util';
import { debtRatio } from './economy';

export function news(w: WorldState, cat: string, key: string, params: Record<string, string | number>, countries: string[], severity = 1, causes: string[] = [], effects: string[] = [], prov: Prov = 'simulated', link?: NewsItem['link']) {
  const n: NewsItem = { id: uid(w, 'n'), t: w.t, cat, key, params, countries, severity, causes, effects, prov, link: link || (countries[0] ? { kind: 'country', id: countries[0] } : undefined) };
  w.news.unshift(n);
  if (w.news.length > 600) w.news.length = 600;
  return n;
}

// Flags remember which crises are active so we report transitions, not every month.
const flag = (w: WorldState, iso: string, k: string) => (w.countries[iso] as any)._f?.[k];
const setFlag = (w: WorldState, iso: string, k: string, v: boolean) => { const c = w.countries[iso] as any; (c._f ||= {})[k] = v; };

const REGION_HAZARD: Record<string, number> = { Asia: 1.6, Americas: 1.1, Oceania: 0.9, Africa: 0.9, Europe: 0.5 };

export function emergentEvents(w: WorldState) {
  const big = Object.values(w.countries).filter((c) => c.alive && c.econ.gdp > 20000);
  for (const c of big) {
    const e = c.econ, iso = c.iso;
    const rec = e.growth < -1.5;
    if (rec && !flag(w, iso, 'rec')) news(w, 'economy', 'ev.recession', { c: iso, g: e.growth.toFixed(1) }, [iso], c.econ.gdp > 1e6 ? 3 : 2, [e.policyRate - e.inflation > 3 ? 'cause.tightMoney' : 'cause.demand', e.bankHealth < 40 ? 'cause.banks' : 'cause.external'], ['eff.unemploymentUp', 'eff.revenueDown']);
    if (!rec && flag(w, iso, 'rec') && e.growth > 0.5) news(w, 'economy', 'ev.recovery', { c: iso }, [iso], 1, ['cause.policy'], ['eff.growthUp']);
    setFlag(w, iso, 'rec', rec);
    const inf = e.inflation > 12;
    if (inf && !flag(w, iso, 'inf')) news(w, 'economy', 'ev.inflation', { c: iso, v: e.inflation.toFixed(1) }, [iso], e.inflation > 40 ? 3 : 2, [c.policy.cbIndependent ? 'cause.fx' : 'cause.monetization', 'cause.oil'], ['eff.approvalDown', 'eff.ratesUp']);
    setFlag(w, iso, 'inf', inf);
    const debt = c.fin.bond10y > 9 && debtRatio(c) > 80;
    if (debt && !flag(w, iso, 'debt')) news(w, 'finance', 'ev.debtCrisis', { c: iso, y: c.fin.bond10y.toFixed(1) }, [iso], 3, ['cause.debt', 'cause.deficit'], ['eff.austerity', 'eff.contagion'], 'simulated', { kind: 'market', id: 'bond:' + iso });
    setFlag(w, iso, 'debt', debt);
    const bank = e.bankHealth < 28;
    if (bank && !flag(w, iso, 'bank')) { news(w, 'finance', 'ev.bankCrisis', { c: iso }, [iso], 3, ['cause.rates', 'cause.privateDebt'], ['eff.creditCrunch', 'eff.marketsDown']); c.fin.equity *= 0.88; }
    setFlag(w, iso, 'bank', bank);
    const h = c.hist.equity; if (h.length > 3) {
      const ch = c.fin.equity / h[h.length - 3] - 1;
      if (ch < -0.2 && !flag(w, iso, 'crash')) news(w, 'finance', 'ev.crash', { c: iso, p: (ch * 100).toFixed(0) }, [iso], 3, ['cause.risk'], ['eff.wealthDown'], 'simulated', { kind: 'market', id: 'equity:' + iso });
      setFlag(w, iso, 'crash', ch < -0.2);
    }
    const fx = c.hist.fx; if (fx.length > 6 && c.currency !== 'USD') {
      const d = c.fin.fx / fx[fx.length - 6] - 1;
      if (d > 0.25 && !flag(w, iso, 'fx')) news(w, 'finance', 'ev.currencyCrisis', { c: iso, p: (d * 100).toFixed(0) }, [iso], 3, ['cause.inflation', 'cause.reserves'], ['eff.importsCostlier'], 'simulated', { kind: 'market', id: 'fx:' + iso });
      setFlag(w, iso, 'fx', d > 0.25);
    }
    if (c.tech > 80 && c.policy.spending.research > 2.5 && rand(w) < 0.006) {
      const field = pick(w, ['ai', 'fusion', 'chips', 'biotech', 'batteries', 'quantum']);
      c.tech = clamp(c.tech + 2, 0, 99); c.econ.sectors.technology.growth += 3;
      news(w, 'science', 'ev.breakthrough', { c: iso, f: 'field.' + field }, [iso], 2, ['cause.research'], ['eff.productivityUp']);
    }
  }
  // Exogenous: natural disasters
  if (rand(w) < 0.12) {
    const alive = Object.values(w.countries).filter((c) => c.alive && c.iso !== 'ATA');
    const c = alive[Math.floor(rand(w) * alive.length)];
    if (rand(w) < (REGION_HAZARD[c.region] || 1) / 1.6) {
      const kind = pick(w, ['earthquake', 'flood', 'hurricane', 'drought', 'wildfire']);
      const sev = rand(w) < 0.2 ? 3 : 2;
      c.econ.growth -= sev * 0.8; c.infra = clamp(c.infra - sev, 0, 100); c.gov.stability -= sev;
      news(w, 'disaster', 'ev.disaster', { c: c.iso, k: 'dis.' + kind }, [c.iso], sev, [kind === 'drought' || kind === 'wildfire' ? 'cause.climate' : 'cause.nature'], ['eff.infraDamage', 'eff.growthDown']);
    }
  }
  // Global pandemic (rare)
  if (w.global.pandemic <= 0 && rand(w) < 0.0015) { w.global.pandemic = 0.6; news(w, 'health', 'ev.pandemic', {}, [], 3, ['cause.nature'], ['eff.globalRecession', 'eff.tourismDown']); }
  if (w.global.pandemic > 0) w.global.pandemic = Math.max(0, w.global.pandemic - 0.03);
  // Climate drift
  w.global.climate += 0.0016 - Object.values(w.countries).reduce((s, c) => s + (c.renewables - 15) * c.energyUse, 0) / 1e9;
  // Supply chain shock
  if (rand(w) < 0.01) { w.commodities.copper.price *= 1.15; w.commodities.lithium.price *= 1.2; news(w, 'trade', 'ev.supplyChain', {}, [], 2, ['cause.logistics'], ['eff.inflationUp']); }
}
