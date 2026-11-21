// Centralised translations. Add a language by adding a dictionary file and registering it here.
import { en } from './en';
import { fr } from './fr';
import type { WorldState } from '../sim/types';

export type Lang = 'en' | 'fr';
export const DICTS: Record<Lang, Record<string, string>> = { en, fr };
let world: WorldState | null = null;
export const bindWorld = (w: WorldState | null) => { world = w; };

export function cname(iso: string, lang: Lang, w: WorldState | null = world): string {
  const c = w?.countries[iso];
  if (!c) return iso;
  return lang === 'fr' ? c.nameFr : c.name;
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const d = DICTS[lang];
  let s = d[key] ?? DICTS.en[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined) return '';
    if (typeof v === 'string') {
      if (d[v] || DICTS.en[v]) return d[v] ?? DICTS.en[v];
      if (world?.countries[v]) return cname(v, lang);
      if (world?.orgs.some((o) => o.id === v)) { const o = world.orgs.find((x) => x.id === v)!; return lang === 'fr' ? o.nameFr : o.name; }
    }
    return String(v);
  });
  return s;
}

// Number formatting
export const fmtMoney = (m: number, lang: Lang) => {
  // m in USD millions
  const a = Math.abs(m); const sp = lang === 'fr' ? ' ' : '';
  if (a >= 1e6) return `$${(m / 1e6).toFixed(2)}${sp}T`.replace('.', lang === 'fr' ? ',' : '.');
  if (a >= 1e3) return `$${(m / 1e3).toFixed(1)}${sp}${lang === 'fr' ? 'Md' : 'B'}`.replace('.', lang === 'fr' ? ',' : '.');
  return `$${m.toFixed(0)}${sp}M`;
};
export const fmtNum = (v: number, d = 1, lang: Lang = 'en') => (isFinite(v) ? v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
export const fmtPop = (p: number, lang: Lang) => (p >= 1e9 ? fmtNum(p / 1e9, 2, lang) + (lang === 'fr' ? ' Md' : ' B') : p >= 1e6 ? fmtNum(p / 1e6, 1, lang) + ' M' : fmtNum(p / 1e3, 0, lang) + ' k');
export const fmtPct = (v: number, d = 1, lang: Lang = 'en') => fmtNum(v, d, lang) + (lang === 'fr' ? ' %' : '%');
const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
};
export function fmtDate(w: WorldState, t: number, lang: Lang, day?: number) {
  const m = w.startMonth + t; const y = w.startYear + Math.floor(m / 12); const mo = m % 12;
  return (day !== undefined ? day + 1 + ' ' : '') + MONTHS[lang][mo] + ' ' + y;
}
