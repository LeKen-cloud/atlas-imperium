import type { WorldState } from './types';

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Deterministic PRNG stored inside the world state so a saved game replays identically.
export function rand(w: WorldState): number {
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randn = (w: WorldState) => {
  const u = Math.max(1e-9, rand(w)), v = rand(w);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
export const pick = <T>(w: WorldState, arr: T[]): T => arr[Math.floor(rand(w) * arr.length)];
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function dateOf(w: WorldState, t = w.t) {
  const m = w.startMonth + t; const y = w.startYear + Math.floor(m / 12);
  return { y, m: (m % 12) + 1 };
}
export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const pushHist = (arr: number[], v: number, max = 240) => { arr.push(Math.round(v * 1000) / 1000); if (arr.length > max) arr.shift(); };
export const uid = (w: WorldState, p: string) => `${p}${w.t}-${Math.floor(rand(w) * 1e6).toString(36)}`;
