// Gravity model of bilateral trade. Flows are derived each month (not saved) from GDP, distance, blocs,
// agreements, sanctions, wars, relations and tariffs. Each country's level is calibrated once so its
// export/GDP ratio starts at a plausible value; afterwards only the *changes* in partners, policy and
// geopolitics move the flows.
import type { WorldState } from './types';
import { distance, countryNeighbors, geoVersion } from './geo';
import { relMatrix } from './relations';
import { clamp } from './util';

export interface TradeView { exports: Record<string, number>; imports: Record<string, number>; partners: Record<string, { iso: string; ex: number; im: number }[]>; flows: [string, string, number][]; partnerGrowth: Record<string, number> }
let last: TradeView = { exports: {}, imports: {}, partners: {}, flows: [], partnerGrowth: {} };
export const tradeView = () => last;

export function opennessTarget(gdp: number, resShare: number) { return clamp(0.5 - 0.075 * (Math.log10(gdp) - 4) + resShare * 0.6, 0.1, 0.95); }

let staticKey = ''; let STATIC: Float64Array = new Float64Array(0);
export function computeTrade(w: WorldState) {
  const isos = Object.keys(w.countries).filter((i) => w.countries[i].alive && w.countries[i].econ.gdp > 0 && i !== 'ATA');
  const n = isos.length; const ix = new Map(isos.map((x, i) => [x, i]));
  // distance & contiguity factors only change when the set of countries or borders change
  const key = isos.join(',') + ':' + geoVersion();
  if (key !== staticKey) {
    staticKey = key; STATIC = new Float64Array(n * n);
    for (let a = 0; a < n; a++) { const nb = countryNeighbors(w, isos[a]); for (let b = 0; b < n; b++) if (a !== b) STATIC[a * n + b] = Math.pow(distance(w, isos[a], isos[b]), -0.8) * (nb.has(isos[b]) ? 1.6 : 1); }
  }
  const R = relMatrix(w, isos);
  const econOrgs = w.orgs.filter((o) => o.kind === 'economic').slice(0, 31); const em = new Int32Array(n);
  econOrgs.forEach((o, k) => { for (const m of o.members) { const i = ix.get(m); if (i !== undefined) em[i] |= 1 << k; } });
  const pairF = new Map<number, number>();
  const mul = (a: string, b: string, f: number) => { const i = ix.get(a), j = ix.get(b); if (i === undefined || j === undefined) return; pairF.set(i * n + j, (pairF.get(i * n + j) ?? 1) * f); pairF.set(j * n + i, (pairF.get(j * n + i) ?? 1) * f); };
  for (const t of w.treaties) if (t.type === 'fta') mul(t.a, t.b, 1.5);
  const sl = new Map<number, number>();
  for (const x of w.sanctions) { const i = ix.get(x.from), j = ix.get(x.to); if (i === undefined || j === undefined) continue; for (const k of [i * n + j, j * n + i]) sl.set(k, Math.max(sl.get(k) || 0, x.level)); }
  for (const [k, lv] of sl) pairF.set(k, (pairF.get(k) ?? 1) * (1 - 0.28 * lv));
  for (const war of w.wars) if (!war.ceasefire) for (const a of war.attackers) for (const d of war.defenders) mul(a, d, 0.02);
  const gA = isos.map((i) => Math.pow(w.countries[i].econ.gdp, 0.85)), gB = isos.map((i) => Math.pow(w.countries[i].econ.gdp, 0.8));
  const tar = isos.map((i) => { const B = w.countries[i]; return clamp(1 - B.policy.tariff / 45, 0.2, 1.1) * (B.policy.capitalControls ? 0.93 : 1); });
  const raw = new Float64Array(n * n); const rawEx = new Float64Array(n);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue; const k = a * n + b;
      let f = gA[a] * gB[b] * STATIC[k] * (1 + R[k] / 250) * tar[b];
      if (em[a] & em[b]) f *= 1.9;
      const pf = pairF.get(k); if (pf !== undefined) f *= pf;
      raw[k] = f; rawEx[a] += f;
    }
  }
  for (let a = 0; a < n; a++) {
    const A = w.countries[isos[a]];
    if (!A.econ.tradeK || !isFinite(A.econ.tradeK)) {
      const res = clamp(((A.resources.oil * 47 * 1.4 + A.resources.gas * 20) / A.econ.gdp), 0, 0.5);
      A.econ.tradeK = (opennessTarget(A.econ.gdp, res) * A.econ.gdp) / Math.max(1e-9, rawEx[a]);
    }
  }
  const exp = new Float64Array(n), imp = new Float64Array(n); let max = 0;
  for (let a = 0; a < n; a++) { const k = w.countries[isos[a]].econ.tradeK; for (let b = 0; b < n; b++) { const v = (raw[a * n + b] *= k); exp[a] += v; imp[b] += v; if (v > max) max = v; } }
  const exports: Record<string, number> = {}, imports: Record<string, number> = {};
  const partners: TradeView['partners'] = {}; const partnerGrowth: Record<string, number> = {};
  const growth = isos.map((i) => w.countries[i].econ.growth);
  const idxs = Array.from({ length: n }, (_, i) => i);
  for (let a = 0; a < n; a++) {
    const iso = isos[a]; exports[iso] = exp[a]; imports[iso] = imp[a];
    const c = w.countries[iso]; c.econ.exports = exp[a]; c.econ.imports = imp[a];
    let s = 0, ws = 0; for (let b = 0; b < n; b++) { const v = raw[a * n + b]; s += growth[b] * v; ws += v; }
    partnerGrowth[iso] = ws ? s / ws : 2.5;
    const top = idxs.filter((b) => b !== a).sort((x, y) => raw[a * n + y] + raw[y * n + a] - raw[a * n + x] - raw[x * n + a]).slice(0, 12);
    partners[iso] = top.map((b) => ({ iso: isos[b], ex: raw[a * n + b], im: raw[b * n + a] }));
  }
  const flows: [string, string, number][] = [];
  const thr = max * 0.004;
  for (let k = 0; k < n * n; k++) if (raw[k] > thr) flows.push([isos[Math.floor(k / n)], isos[k % n], raw[k]]);
  flows.sort((x, y) => y[2] - x[2]);
  last = { exports, imports, partners, flows: flows.slice(0, 400), partnerGrowth };
  return last;
}

// How exposed is `iso` to a shock in `src`? Share of its total trade done with src.
export function exposure(iso: string, src: string) {
  const p = last.partners[iso]?.find((x) => x.iso === src); const tot = (last.exports[iso] || 0) + (last.imports[iso] || 0);
  return p && tot ? (p.ex + p.im) / tot : 0;
}
