// Relations, treaties, sanctions and memory helpers shared by diplomacy, trade, AI and military.
// Lookups go through an index rebuilt whenever orgs/treaties/sanctions/wars change (cheap signature check).
import type { Country, TreatyType, WorldState } from './types';
import { isDemocracy } from './types';
import { clamp, pairKey } from './util';
import { FRIENDLY, HOSTILE } from '../data/reference';
import { countryNeighbors, invalidateGeo } from './geo';

const SEED_REL: Record<string, number> = {};
for (const [a, b, v] of [...HOSTILE, ...FRIENDLY]) SEED_REL[pairKey(a, b)] = v;

interface Index { sig: string; orgOf: Map<string, { id: string; kind: string }[]>; sanc: Map<string, number>; treaty: Set<string>; war: Set<string>; base: Map<string, number>; nato: Set<string>; csto: Set<string> }
let IDX: Index | null = null;
let worldRef: WorldState | null = null;
function sig(w: WorldState) { return w.t + ':' + w.scenario; }
export function invalidate() { IDX = null; invalidateGeo(); }
export function idx(w: WorldState): Index {
  const s = sig(w);
  if (IDX && IDX.sig === s && worldRef === w) return IDX;
  worldRef = w;
  const orgOf = new Map<string, { id: string; kind: string }[]>();
  for (const o of w.orgs) { if (o.id === 'UN' || o.id === 'IMF') continue; for (const m of o.members) { const a = orgOf.get(m) || []; a.push({ id: o.id, kind: o.kind }); orgOf.set(m, a); } }
  const sanc = new Map<string, number>(); for (const x of w.sanctions) sanc.set(x.from + '>' + x.to, x.level);
  const treaty = new Set<string>(); for (const t of w.treaties) treaty.add(t.type + '|' + pairKey(t.a, t.b));
  const war = new Set<string>(); for (const x of w.wars) if (!x.ceasefire) for (const a of x.attackers) for (const d of x.defenders) war.add(pairKey(a, d));
  const nato = new Set(w.orgs.find((o) => o.id === 'NATO')?.members || []), csto = new Set(w.orgs.find((o) => o.id === 'CSTO')?.members || []);
  IDX = { sig: s, orgOf, sanc, treaty, war, base: new Map(), nato, csto };
  return IDX;
}

export const orgsOf = (w: WorldState, iso: string) => w.orgs.filter((o) => o.members.includes(iso));
export function shareOrg(w: WorldState, a: string, b: string, kinds?: string[]) {
  const I = idx(w); const A = I.orgOf.get(a); const B = I.orgOf.get(b); if (!A || !B) return false;
  for (const x of A) if ((!kinds || kinds.includes(x.kind)) && B.some((y) => y.id === x.id)) return true;
  return false;
}

// Baseline opinion from structure (blocs, regime similarity, region); the sparse w.rel map stores accumulated changes.
export function baseRel(w: WorldState, a: string, b: string): number {
  const I = idx(w); const k = pairKey(a, b);
  const m = I.base.get(k); if (m !== undefined) return m;
  const A = w.countries[a], B = w.countries[b]; if (!A || !B) return 0;
  let r: number;
  if (SEED_REL[k] !== undefined && w.scenario === 'contemporary') r = SEED_REL[k];
  else {
    r = 5;
    const oa = I.orgOf.get(a) || [], ob = I.orgOf.get(b) || [];
    for (const x of oa) if (ob.some((y) => y.id === x.id)) r += x.kind === 'military' ? 25 : 10;
    r += isDemocracy(A.gov.type) === isDemocracy(B.gov.type) ? 8 : -8;
    if (A.region === B.region) r += 6;
    if ((I.nato.has(a) && I.csto.has(b)) || (I.nato.has(b) && I.csto.has(a))) r -= 30;
  }
  r = clamp(r, -100, 100); I.base.set(k, r); return r;
}
export function getRel(w: WorldState, a: string, b: string): number {
  if (a === b) return 100;
  return clamp(baseRel(w, a, b) + (w.rel[pairKey(a, b)] || 0), -100, 100);
}
export function addRel(w: WorldState, a: string, b: string, d: number) {
  const k = pairKey(a, b); w.rel[k] = clamp((w.rel[k] || 0) + d, -200, 200);
}
export function remember(w: WorldState, who: string, withIso: string, kind: string, delta: number) {
  const c = w.countries[who]; if (!c) return;
  c.ai.memory.push({ t: w.t, with: withIso, kind, delta });
  if (c.ai.memory.length > 40) c.ai.memory.shift();
}
// Trust = memory of kept vs broken commitments and hostile acts with that partner, decaying over ~5 years.
export function trust(w: WorldState, a: string, b: string): number {
  const m = w.countries[a]?.ai.memory.filter((x) => x.with === b) || [];
  return clamp(50 + m.reduce((s, x) => s + x.delta * Math.exp(-(w.t - x.t) / 60), 0), 0, 100);
}
export const hasTreaty = (w: WorldState, a: string, b: string, type: TreatyType) => idx(w).treaty.has(type + '|' + pairKey(a, b));
export const sanctionLevel = (w: WorldState, from: string, to: string) => idx(w).sanc.get(from + '>' + to) || 0;
export const sanctionsOn = (w: WorldState, to: string) => w.sanctions.filter((s) => s.to === to);
export const atWar = (w: WorldState, a: string, b: string) => idx(w).war.has(pairKey(a, b));
export const warsOf = (w: WorldState, a: string) => w.wars.filter((x) => !x.ceasefire && (x.attackers.includes(a) || x.defenders.includes(a)));
export const allies = (w: WorldState, a: string): string[] => {
  const s = new Set<string>();
  for (const t of w.treaties) if (t.type === 'alliance' || t.type === 'defense') { if (t.a === a) s.add(t.b); if (t.b === a) s.add(t.a); }
  for (const o of w.orgs) if (o.kind === 'military' && o.members.includes(a)) o.members.forEach((m) => m !== a && s.add(m));
  return [...s].filter((x) => w.countries[x]?.alive);
};
export function power(c: Country) { return (c.mil.capital * (0.5 + c.mil.tech / 100) * (0.5 + c.mil.readiness / 200) + c.mil.personnel * 8) * (1 - c.mil.exhaustion / 250); }
export function militaryScore(w: WorldState, iso: string) { const c = w.countries[iso]; return c ? Math.round(Math.sqrt(Math.max(0, power(c)))) : 0; }
export const neighbors = countryNeighbors;
export function ideologyDistance(a: Country, b: Country) {
  const g = (c: Country) => { const p = c.gov.parties.filter((x) => x.inGov); return p.reduce((s, x) => s + x.econ, 0) / (p.length || 1); };
  return Math.abs(g(a) - g(b)) + (isDemocracy(a.gov.type) !== isDemocracy(b.gov.type) ? 1 : 0);
}

// Fast dense relation matrix for bulk computations (trade). Same formula as getRel.
export function relMatrix(w: WorldState, isos: string[]): Float32Array {
  const n = isos.length; const ix = new Map(isos.map((x, i) => [x, i]));
  const orgs = w.orgs.filter((o) => o.id !== 'UN' && o.id !== 'IMF').slice(0, 31);
  const mask = new Int32Array(n);
  orgs.forEach((o, k) => { for (const m of o.members) { const i = ix.get(m); if (i !== undefined) mask[i] |= 1 << k; } });
  const ow = orgs.map((o) => (o.kind === 'military' ? 25 : 10));
  const nato = orgs.findIndex((o) => o.id === 'NATO'), csto = orgs.findIndex((o) => o.id === 'CSTO');
  const dem = isos.map((i) => isDemocracy(w.countries[i].gov.type)); const reg = isos.map((i) => w.countries[i].region);
  const M = new Float32Array(n * n);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    let r = 5; const sh = mask[a] & mask[b];
    if (sh) for (let k = 0; k < orgs.length; k++) if (sh & (1 << k)) r += ow[k];
    r += dem[a] === dem[b] ? 8 : -8; if (reg[a] === reg[b]) r += 6;
    if (nato >= 0 && csto >= 0) { const na = mask[a] >> nato & 1, nb = mask[b] >> nato & 1, ca = mask[a] >> csto & 1, cb = mask[b] >> csto & 1; if ((na && cb) || (nb && ca)) r -= 30; }
    M[a * n + b] = M[b * n + a] = r;
  }
  if (w.scenario === 'contemporary') for (const [k, v] of Object.entries(SEED_REL)) { const [x, y] = k.split('|'); const a = ix.get(x), b = ix.get(y); if (a !== undefined && b !== undefined) M[a * n + b] = M[b * n + a] = v; }
  for (const [k, v] of Object.entries(w.rel)) { const [x, y] = k.split('|'); const a = ix.get(x), b = ix.get(y); if (a !== undefined && b !== undefined) { const r = clamp(clamp(M[a * n + b], -100, 100) + v, -100, 100); M[a * n + b] = M[b * n + a] = r; } }
  return M;
}
