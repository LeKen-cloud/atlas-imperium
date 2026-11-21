// Map visualization modes: each returns a value per country and a colour scale.
import type { Country, WorldState } from '../sim/types';
import { gdpPc, debtRatio, netEnergyExport } from '../sim/economy';
import { getRel, militaryScore, allies } from '../sim/relations';
import { tradeView } from '../sim/trade';

export const MAP_MODES = ['political', 'economic', 'gdp', 'gdppc', 'density', 'growth', 'inflation', 'debt', 'bonds', 'military', 'ideology', 'alliances', 'influence', 'resources', 'industry', 'finance', 'infrastructure', 'stability', 'trade', 'energy', 'relations'] as const;
export type MapMode = (typeof MAP_MODES)[number];

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function ramp(stops: string[], t: number) {
  t = Math.max(0, Math.min(1, isFinite(t) ? t : 0));
  const n = stops.length - 1; const i = Math.min(n - 1, Math.floor(t * n)); const f = t * n - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
export const SEQ = ['#1d2b3a', '#24546b', '#2b8a8f', '#7cc4a0', '#e8e5a2'];
export const DIV = ['#c2413b', '#e48a5f', '#e9dcc4', '#6fb0b9', '#1f6f8b'];
export const HEAT = ['#2a6f97', '#7fb7a8', '#e9d8a6', '#ee9b00', '#ae2012'];

export const GOV_COLORS: Record<string, string> = {
  full_democracy: '#2f7fb8', flawed_democracy: '#6aa7d4', hybrid: '#d9b65b', authoritarian: '#c0583f', absolute_monarchy: '#8e4f9e', theocracy: '#6b4b3a', one_party: '#a32d2d',
};
const BLOC_COLORS: Record<string, string> = { NATO: '#3b82c4', CSTO: '#c0392b', SCO: '#d35400', BRICS: '#e0a526', EU: '#2e86c1', ASEAN: '#16a085', AU: '#7d9d3a', GCC: '#8e44ad', MERCOSUR: '#27ae60' };

export interface ModeResult { value: (c: Country) => number | null; color: (c: Country) => string; legend: { kind: 'scale'; stops: string[]; lo: string; hi: string } | { kind: 'cats'; items: [string, string][] }; fmt: (v: number) => string }

const logT = (v: number, lo: number, hi: number) => (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
const linT = (v: number, lo: number, hi: number) => (v - lo) / (hi - lo);

export function modeFor(mode: MapMode, w: WorldState, sel: string | null, t: (k: string) => string): ModeResult {
  const scale = (value: (c: Country) => number | null, tf: (v: number) => number, stops: string[], lo: string, hi: string, fmt: (v: number) => string): ModeResult => ({
    value, color: (c) => { const v = value(c); return v === null || !isFinite(v) ? '#3a4048' : ramp(stops, tf(v)); }, legend: { kind: 'scale', stops, lo, hi }, fmt,
  });
  const f1 = (v: number) => v.toFixed(1);
  switch (mode) {
    case 'political': return { value: () => null, color: (c) => c.color, legend: { kind: 'cats', items: [] }, fmt: String };
    case 'gdp': return scale((c) => c.econ.gdp, (v) => logT(v, 1000, 3e7), SEQ, '$1B', '$30T', (v) => '$' + (v / 1000).toFixed(0) + 'B');
    case 'gdppc': return scale((c) => gdpPc(c), (v) => logT(v, 500, 120000), SEQ, '$500', '$120k', (v) => '$' + Math.round(v).toLocaleString());
    case 'density': return scale((c) => (c.area ? c.soc.pop / c.area : null), (v) => logT(v, 1, 1500), SEQ, '1/km²', '1500/km²', (v) => v.toFixed(0) + '/km²');
    case 'growth': return scale((c) => c.econ.growth, (v) => linT(v, -6, 8), DIV, '−6%', '+8%', (v) => f1(v) + '%');
    case 'inflation': return scale((c) => c.econ.inflation, (v) => logT(v + 2, 1, 50), HEAT, '−1%', '48%+', (v) => f1(v) + '%');
    case 'debt': return scale((c) => debtRatio(c), (v) => linT(v, 0, 200), HEAT, '0%', '200%', (v) => v.toFixed(0) + '%');
    case 'bonds': return scale((c) => c.fin.bond10y, (v) => linT(v, 0, 20), HEAT, '0%', '20%', (v) => v.toFixed(2) + '%');
    case 'military': return scale((c) => militaryScore(w, c.iso), (v) => logT(v + 1, 1, 3000), SEQ, t('map.low'), t('map.high'), (v) => v.toFixed(0));
    case 'influence': return scale((c) => c.influence, (v) => linT(v, 0, 90), SEQ, '0', '90', (v) => v.toFixed(0));
    case 'infrastructure': return scale((c) => c.infra, (v) => linT(v, 10, 95), SEQ, '10', '95', (v) => v.toFixed(0));
    case 'stability': return scale((c) => c.gov.stability, (v) => linT(v, 10, 90), [...HEAT].reverse(), t('map.low'), t('map.high'), (v) => v.toFixed(0));
    case 'industry': return scale((c) => (c.econ.sectors.manufacturing.share + c.econ.sectors.construction.share + c.econ.sectors.mining.share + c.econ.sectors.energy.share) * 100, (v) => linT(v, 10, 60), SEQ, '10%', '60%', (v) => v.toFixed(0) + '%');
    case 'finance': return scale((c) => c.econ.gdp * c.econ.sectors.finance.share * (c.fin.equity / 1000), (v) => logT(v, 100, 3e6), SEQ, t('map.low'), t('map.high'), (v) => '$' + (v / 1000).toFixed(0) + 'B');
    case 'resources': return scale((c) => c.resources.oil + c.resources.gas + c.resources.coal + c.resources.minerals * 3000, (v) => logT(v + 1, 10, 30000), SEQ, t('map.low'), t('map.high'), (v) => v.toFixed(0) + ' TWh-eq');
    case 'energy': return scale((c) => netEnergyExport(c, w.commodities.brent.price) * 100, (v) => linT(v, -15, 15), DIV, t('mode.energy') + ' −', '+', (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '% GDP');
    case 'economic': {
      const dom = (c: Country) => { const s = c.econ.sectors; const ag = s.agriculture.share, ind = s.manufacturing.share + s.mining.share + s.energy.share + s.construction.share; return ag > 0.15 ? 'agri' : ind > 0.38 ? 'ind' : (s.technology.share + s.finance.share) > 0.18 ? 'know' : 'serv'; };
      const col: Record<string, string> = { agri: '#7d9d3a', ind: '#c0703f', know: '#3b82c4', serv: '#8aa0b0' };
      return { value: () => null, color: (c) => col[dom(c)], legend: { kind: 'cats', items: [['#7d9d3a', t('sec.agriculture')], ['#c0703f', t('mode.industry')], ['#3b82c4', t('sec.technology') + ' / ' + t('sec.finance')], ['#8aa0b0', 'Services']] }, fmt: String };
    }
    case 'ideology': return { value: () => null, color: (c) => GOV_COLORS[c.gov.type], legend: { kind: 'cats', items: Object.entries(GOV_COLORS).map(([k, v]) => [v, t('gov.' + k)]) }, fmt: String };
    case 'alliances': {
      const pick = (c: Country) => { for (const id of ['NATO', 'CSTO', 'GCC', 'EU', 'BRICS', 'SCO', 'ASEAN', 'MERCOSUR', 'AU']) if (w.orgs.find((o) => o.id === id)?.members.includes(c.iso)) return id; return null; };
      return { value: () => null, color: (c) => { const p = pick(c); return p ? BLOC_COLORS[p] : '#4a5058'; }, legend: { kind: 'cats', items: Object.entries(BLOC_COLORS).map(([k, v]) => [v, k]) }, fmt: String };
    }
    case 'relations': return {
      value: (c) => (sel ? getRel(w, sel, c.iso) : null),
      color: (c) => { if (!sel) return '#4a5058'; if (c.iso === sel) return '#f0f0f0'; if (allies(w, sel).includes(c.iso)) return '#2f7fb8'; return ramp(DIV, (getRel(w, sel, c.iso) + 100) / 200); },
      legend: { kind: 'scale', stops: DIV, lo: '−100', hi: '+100' }, fmt: (v) => v.toFixed(0),
    };
    case 'trade': {
      const tv = tradeView();
      const vol = (c: Country) => { if (!sel || c.iso === sel) return null; const p = tv.partners[sel]?.find((x) => x.iso === c.iso); if (p) return p.ex + p.im; const q = tv.partners[c.iso]?.find((x) => x.iso === sel); return q ? q.ex + q.im : 0; };
      return { value: vol, color: (c) => { if (!sel) return '#4a5058'; if (c.iso === sel) return '#f0f0f0'; const v = vol(c); return v ? ramp(SEQ, logT(v, 100, 5e5)) : '#2c3138'; }, legend: { kind: 'scale', stops: SEQ, lo: '$0.1B', hi: '$500B' }, fmt: (v) => '$' + (v / 1000).toFixed(1) + 'B' };
    }
  }
}
