// Turn-based loop (PAX-Historia style): chat → up to N orders → time jump → chapter report.
// Outcomes are computed by the deterministic simulation; the report only describes what happened.
import type { MetricDelta, OrderOutcome, QueuedOrder, TurnReport, WorldState } from './types';
import { perform, MAJOR_ACTIONS, type Action } from './actions';
import { tick } from './engine';
import { debtRatio } from './economy';
import { uid } from './util';
import { evaluateProposal } from './actions';
import { tradeView } from './trade';
import { getRel, hasTreaty, shareOrg, warsOf } from './relations';
import { RATINGS } from './economy';

export const JUMPS = [1, 3, 6, 12]; // months
export const isMajor = (a: Action) => MAJOR_ACTIONS.has(a.type);
export const ordersLeft = (w: WorldState) => w.turn.maxOrders - w.turn.orders.length;

export function queueOrder(w: WorldState, order: Omit<QueuedOrder, 'id'>): QueuedOrder | null {
  if (ordersLeft(w) <= 0 || !order.actions.length) return null;
  const o = { ...order, id: uid(w, 'o') }; w.turn.orders.push(o); return o;
}
export const removeOrder = (w: WorldState, id: string) => { w.turn.orders = w.turn.orders.filter((o) => o.id !== id); };

function snapshotMetrics(w: WorldState) {
  const c = w.player ? w.countries[w.player] : null;
  if (!c) return null;
  return { gdp: c.econ.gdp, growth: c.econ.growth, inflation: c.econ.inflation, unemployment: c.econ.unemployment, debt: debtRatio(c), deficit: -c.econ.deficit, approval: c.gov.approval, stability: c.gov.stability, rating: RATINGS.length - RATINGS.indexOf(c.fin.rating), equity: c.fin.equity, bond: c.fin.bond10y, influence: c.influence };
}
const UNITS: Record<string, [string, boolean]> = { gdp: ['$M', true], growth: ['%', true], inflation: ['%', false], unemployment: ['%', false], debt: ['% GDP', false], deficit: ['% GDP', true], approval: ['', true], stability: ['', true], rating: ['', true], equity: ['', true], bond: ['%', false], influence: ['', true] };

// Advisor tips: concrete next steps computed from the state (always available, no AI needed)
export function advisorTips(w: WorldState): TurnReport['tips'] {
  const iso = w.player; if (!iso) return [];
  const c = w.countries[iso]; const tips: TurnReport['tips'] = []; const e = c.econ;
  if (e.inflation > 6) tips.push({ key: c.currency === 'EUR' ? 'tip.inflationEuro' : 'tip.inflation', params: { v: e.inflation.toFixed(1) } });
  if (e.growth < 0.5) tips.push({ key: 'tip.growth', params: { v: e.growth.toFixed(1) } });
  if (e.deficit > 5 || c.fin.bond10y > 7) tips.push({ key: 'tip.deficit', params: { d: e.deficit.toFixed(1), y: c.fin.bond10y.toFixed(1) } });
  if (c.gov.approval < 35) tips.push({ key: 'tip.approval', params: { v: Math.round(c.gov.approval) } });
  if (c.gov.stability < 40) tips.push({ key: 'tip.stability' });
  if (warsOf(w, iso).length && c.mil.exhaustion > 60) tips.push({ key: 'tip.peace', params: { v: Math.round(c.mil.exhaustion) } });
  // opportunity: the most promising trade deal
  const cand = (tradeView().partners[iso] || []).map((p) => p.iso).find((p) => !hasTreaty(w, iso, p, 'fta') && !shareOrg(w, iso, p, ['economic']) && evaluateProposal(w, iso, p, 'fta').score > 5);
  if (cand) tips.push({ key: 'tip.fta', params: { c: cand } });
  const friend = Object.keys(w.countries).filter((x) => x !== iso && w.countries[x].alive && getRel(w, iso, x) > 45 && !hasTreaty(w, iso, x, 'alliance') && !hasTreaty(w, iso, x, 'defense')).sort((a, b) => w.countries[b].econ.gdp - w.countries[a].econ.gdp)[0];
  if (friend && tips.length < 4) tips.push({ key: 'tip.alliance', params: { c: friend } });
  if (c.tech < 60 && c.policy.spending.research < 2 && tips.length < 4) tips.push({ key: 'tip.research' });
  if (!tips.length) tips.push({ key: 'tip.allGood' });
  return tips.slice(0, 4);
}

export interface EndTurnOptions { onMonth?: (i: number, n: number) => void | Promise<void> }
export async function endTurn(w: WorldState, opts: EndTurnOptions = {}): Promise<TurnReport> {
  const from = w.t; const months = Math.max(1, w.turn.jump | 0);
  const before = snapshotMetrics(w);
  const owners = w.territories.map((t) => t.owner + '|' + t.controller);
  const newsBefore = w.news[0]?.id;
  // 1) Resolve the player's orders
  const orders: OrderOutcome[] = [];
  if (w.player) for (const o of w.turn.orders) {
    const results = o.actions.map((a) => { const r = perform(w, w.player!, a); return { label: a.type + ('target' in a ? ' → ' + (a as any).target : ''), ok: r.ok, key: r.key, params: r.params, reasons: r.reasons }; });
    orders.push({ text: o.text || o.summary || o.actions.map((a) => a.type).join(', '), results });
  }
  // 2) Time jump: the world (including every AI government) plays the same months
  for (let i = 0; i < months; i++) { tick(w); if (opts.onMonth) await opts.onMonth(i + 1, months); }
  // 3) Build the chapter report
  const after = snapshotMetrics(w);
  const deltas: MetricDelta[] = before && after ? Object.keys(before).map((k) => ({ key: k, before: (before as any)[k], after: (after as any)[k], unit: UNITS[k][0], goodUp: UNITS[k][1] })) : [];
  const fresh: string[] = []; for (const n of w.news) { if (n.id === newsBefore) break; fresh.push(n.id); }
  const byId = new Map(w.news.map((n) => [n.id, n]));
  const headlines = fresh.filter((id) => { const n = byId.get(id)!; return n.severity >= 2 || (w.player && n.countries.includes(w.player)); })
    .sort((a, b) => { const A = byId.get(a)!, B = byId.get(b)!; const mine = (x: typeof A) => (w.player && x.countries.includes(w.player) ? 2 : 0); return mine(B) + B.severity - (mine(A) + A.severity); }).slice(0, 14);
  const borders: TurnReport['borders'] = [];
  w.territories.forEach((t, i) => {
    const [o, c] = owners[i].split('|');
    if (o !== t.owner) borders.push({ t: i, name: t.name, from: o, to: t.owner, kind: 'transfer' });
    else if (c !== t.controller) borders.push({ t: i, name: t.name, from: c, to: t.controller, kind: t.controller === t.owner ? 'liberated' : 'occupied' });
  });
  const report: TurnReport = { n: w.turn.n, from, to: w.t, player: w.player, orders, deltas, headlines, borders, tips: advisorTips(w) };
  w.reports.push(report); if (w.reports.length > 60) w.reports.shift();
  w.turn = { ...w.turn, n: w.turn.n + 1, orders: [] };
  return report;
}

// Plain chronicle used when the local AI is offline (and as the facts the AI must respect).
export function factSheet(w: WorldState, r: TurnReport, t: (k: string, p?: Record<string, string | number>) => string): string[] {
  const lines: string[] = [];
  for (const o of r.orders) lines.push('ORDER: ' + o.text + ' → ' + o.results.map((x) => t(x.key, x.params)).join('; '));
  for (const id of r.headlines) { const n = w.news.find((x) => x.id === id); if (n) lines.push('EVENT: ' + t(n.key, n.params)); }
  for (const b of r.borders) lines.push('MAP: ' + b.name + ' ' + b.kind + ' ' + b.from + ' → ' + b.to);
  for (const d of r.deltas) if (['gdp', 'growth', 'inflation', 'approval', 'stability'].includes(d.key)) lines.push(`STAT: ${d.key} ${d.before.toFixed(1)} → ${d.after.toFixed(1)}`);
  return lines;
}
