// Static geography loaded from the bundled real datasets, plus cached derived lookups.
import { neighbors } from 'topojson-client';
import worldData from '../data/generated/world.json';
import type { WorldState } from './types';
import { haversine } from './util';

export interface BaseCountry {
  iso: string; iso2: string; name: string; nameFr: string; official: string; flag: string; region: string; subregion: string;
  capital: string | null; capitalLL: [number, number] | null; currency: { code: string; name: string; symbol: string } | null;
  languages: string[]; landlocked: boolean; unMember: boolean; independent: boolean; area: number;
  real: {
    gdp: { v: number; y: number } | null; pop: { v: number; y: number } | null; infl: { v: number; y: number } | null;
    energy: Record<string, { v: number; y: number }> | null; gdpHist: [number, number][];
  };
}
export interface BaseTerritory { i: number; name: string; nameFr: string; iso: string | null; owner: string; area: number; gdp: number; pop: number }
export interface City { n: string; c: string; p: number; cap: number; ll: [number, number] }

export const WORLD = worldData as unknown as {
  meta: { built: string; sources: { id: string; name: string; license: string; url: string }[] };
  topology: any; territories: BaseTerritory[]; countries: Record<string, BaseCountry>; cities: City[];
};

// Territory adjacency from shared topology arcs (real borders).
export const T_NEIGHBORS: number[][] = neighbors(WORLD.topology.objects.countries.geometries);

let geoValid = false; let geoWorld: WorldState | null = null;
let countryAdj: Record<string, Set<string>> = {};
let GEO_V = 0;
export function invalidateGeo() { geoValid = false; GEO_V++; }
export const geoVersion = () => GEO_V;
export function ownershipKey(w: WorldState) {
  let s = ''; for (const t of w.territories) s += t.owner + t.controller; return s.length + ':' + hashOwners(s);
}
function hashOwners(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
export function countryNeighbors(w: WorldState, iso: string): Set<string> {
  if (!geoValid || geoWorld !== w) {
    geoValid = true; geoWorld = w; countryAdj = {};
    w.territories.forEach((t, i) => {
      for (const j of T_NEIGHBORS[i]) {
        const o = w.territories[j].owner;
        if (o !== t.owner) (countryAdj[t.owner] ||= new Set()).add(o);
      }
    });
  }
  return countryAdj[iso] || new Set();
}

const distCache = new Map<string, number>();
export function distance(w: WorldState, a: string, b: string): number {
  const k = a < b ? a + b : b + a;
  const c = distCache.get(k); if (c !== undefined) return c;
  const A = w.countries[a]?.capitalLL, B = w.countries[b]?.capitalLL;
  const d = A && B ? Math.max(300, haversine(A, B)) : 8000;
  distCache.set(k, d); return d;
}
export const territoriesOf = (w: WorldState, iso: string) => w.territories.filter((t) => t.owner === iso);
