// AI agents on top of the deterministic simulation. Architecture:
//  - one shared world state; agents receive compact JSON summaries of it
//  - the model returns structured JSON; every proposed action is validated by sim/actions.perform()
//  - when the model is unavailable, rule-based fallbacks produce the same kinds of output
import type { WorldState, TreatyType, SpendKey } from '../sim/types';
import { SPEND_KEYS, SECTORS } from '../sim/types';
import { perform, type Action, type Result, evaluateProposal } from '../sim/actions';
import { askJSON, type AIConfig } from './llm';
import { analyze, summarize, type Analysis } from './analyst';
import { getRel, trust, warsOf } from '../sim/relations';
import { news } from '../sim/events';
import { translate, cname, type Lang } from '../i18n';

const langName = (l: Lang) => (l === 'fr' ? 'French' : 'English');

// ---------------- Orders: natural language -> validated actions ----------------
const ACTION_SCHEMA = {
  type: 'object', properties: {
    summary: { type: 'string' },
    actions: { type: 'array', items: { type: 'object', properties: {
      type: { type: 'string', enum: ['setPolicy', 'setSpending', 'reform', 'improveRelations', 'denounce', 'proposeTreaty', 'cancelTreaty', 'sanction', 'liftSanctions', 'declareWar', 'proposePeace', 'joinOrg', 'leaveOrg', 'foreignAid', 'summit', 'strategicSector'] },
      target: { type: 'string' }, treaty: { type: 'string' }, level: { type: 'number' }, key: { type: 'string' }, value: { type: 'number' }, field: { type: 'string' }, id: { type: 'string' }, org: { type: 'string' }, terms: { type: 'string' }, amount: { type: 'number' }, sector: { type: 'string' },
    }, required: ['type'] } },
  }, required: ['summary', 'actions'],
};

export function findCountries(w: WorldState, text: string): string[] {
  const s = ' ' + text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ') + ' ';
  const found: { iso: string; pos: number }[] = [];
  for (const c of Object.values(w.countries)) {
    if (!c.alive) continue;
    let pos = -1;
    for (const nm of [c.name, c.nameFr]) { const k = nm.toLowerCase(); if (k.length < 3) continue; const i = s.indexOf(' ' + k); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
    // ISO codes only when written in capitals as a separate word (avoids "and" → Andorra)
    const m = new RegExp('(^|[^A-Za-z])' + c.iso + '([^A-Za-z]|$)').exec(text); if (pos < 0 && m) pos = m.index;
    if (pos >= 0) found.push({ iso: c.iso, pos });
  }
  return found.sort((a, b) => a.pos - b.pos).map((f) => f.iso);
}

// Rule-based parser (EN/FR keywords). Covers the common orders; the LLM handles free-form ones.
export function parseOrders(w: WorldState, actor: string, text: string): Action[] {
  const s = text.toLowerCase(); const acts: Action[] = [];
  const C = w.countries[actor];
  const num = (re: RegExp) => { const m = s.match(re); return m ? parseFloat(m[1].replace(',', '.')) : null; };
  const others = findCountries(w, text).filter((x) => x !== actor);
  const tgt = others[0];
  if (/corporate|sociétés|societes|\bis\b/.test(s)) { const v = num(/(?:corporate|sociétés|societes)[^0-9]*(\d+[.,]?\d*)/); if (v !== null) acts.push({ type: 'setPolicy', patch: { corpTax: v } }); }
  if (/tax|impôt|impot|fiscal/.test(s) && !/corporate|sociétés|societes/.test(s)) {
    const v = num(/(?:tax|impôts?|impot)[^0-9]*(\d+[.,]?\d*)/);
    if (v !== null) acts.push({ type: 'setPolicy', patch: { taxBurden: v } });
    else if (/cut|lower|baiss|rédui|reduc/.test(s)) acts.push({ type: 'setPolicy', patch: { taxBurden: C.policy.taxBurden - 2 } });
    else if (/raise|increase|hausse|augment/.test(s)) acts.push({ type: 'setPolicy', patch: { taxBurden: C.policy.taxBurden + 2 } });
  }
  if (/interest rate|taux directeur|policy rate|taux d'intérêt|taux d’intérêt/.test(s)) { const v = num(/(?:rate|taux)[^0-9]*(\d+[.,]?\d*)/); if (v !== null) acts.push({ type: 'setPolicy', patch: { policyRate: v } }); }
  if (/tariff|douane/.test(s)) { const v = num(/(?:tariff|douane)s?[^0-9]*(\d+[.,]?\d*)/); acts.push({ type: 'setPolicy', patch: { tariff: v ?? (/cut|lower|baiss|rédui/.test(s) ? C.policy.tariff - 3 : C.policy.tariff + 5) } }); }
  const spendMap: [RegExp, SpendKey][] = [[/infrastruct|rail|road|route|port|ferroviaire/, 'infrastructure'], [/educat|école|ecole|universit/, 'education'], [/health|santé|sante|hôpita|hospital/, 'health'], [/defen[cs]e|défense|military|armée|militaire/, 'defense'], [/research|recherche|r&d|innovation/, 'research'], [/social|pension|welfare|allocation/, 'social']];
  if (/invest|spend|fund|financ|investi|dépens|depens|boost|renforc|augment/.test(s)) for (const [re, k] of spendMap) if (re.test(s)) acts.push({ type: 'setSpending', key: k, value: C.policy.spending[k] + (k === 'defense' ? 0.5 : 0.6) });
  if (/cut spending|austerity|austérité|réduire les dépenses/.test(s)) acts.push({ type: 'setSpending', key: 'admin', value: C.policy.spending.admin - 0.5 }, { type: 'setSpending', key: 'subsidies', value: Math.max(0, C.policy.spending.subsidies - 0.5) });
  if (/green|verte|renewable|renouvelable/.test(s)) acts.push({ type: 'setPolicy', patch: { energy: 'green' } });
  if (/nuclear|nucléaire/.test(s) && !/war|guerre/.test(s)) acts.push({ type: 'setPolicy', patch: { energy: 'nuclear' } });
  if (/corruption/.test(s)) acts.push({ type: 'reform', id: 'anticorruption' });
  for (const sec of SECTORS) if (new RegExp('strateg.*' + sec.slice(0, 5)).test(s)) acts.push({ type: 'strategicSector', sector: sec, on: true });
  if (tgt) {
    const treaty: TreatyType | null = /free.?trade|libre.?échange|libre-echange|trade deal|accord commercial/.test(s) ? 'fta' : /alliance/.test(s) ? 'alliance' : /defen[cs]e pact|pacte de défense/.test(s) ? 'defense' : /non.?aggression/.test(s) ? 'nap' : /investment treaty|traité d.investissement/.test(s) ? 'investment' : /tech/.test(s) ? 'tech' : null;
    if (/peace|paix|ceasefire|cessez/.test(s)) acts.push({ type: 'proposePeace', target: tgt, terms: /ceasefire|cessez/.test(s) ? 'ceasefire' : /cede|céd/.test(s) ? 'cede' : 'white' });
    else if (/declare war|déclarer la guerre|attack|attaquer|invade|envahir/.test(s)) acts.push({ type: 'declareWar', target: tgt });
    else if (/lift|lever/.test(s) && /sanction/.test(s)) acts.push({ type: 'liftSanctions', target: tgt });
    else if (/sanction|embargo/.test(s)) acts.push({ type: 'sanction', target: tgt, level: /embargo|total|severe|sévère/.test(s) ? 3 : 2 });
    else if (treaty) acts.push({ type: 'proposeTreaty', target: tgt, treaty });
    else if (/aid|aide/.test(s)) acts.push({ type: 'foreignAid', target: tgt, amount: (num(/(\d+[.,]?\d*)\s*(?:m|million)/) ?? 500) });
    else if (/denounce|condemn|dénonc|condamn/.test(s)) acts.push({ type: 'denounce', target: tgt });
    else if (/relation|rapproch|friend|ami/.test(s)) acts.push({ type: 'improveRelations', target: tgt });
    if (/summit|sommet/.test(s)) acts.push({ type: 'summit', invitees: others });
  }
  return acts;
}

function sanitize(w: WorldState, a: any, actor: string): Action | null {
  if (!a || typeof a.type !== 'string') return null;
  const T = typeof a.target === 'string' ? a.target.toUpperCase() : undefined;
  const tgt = T && w.countries[T] ? T : T ? findCountries(w, a.target)[0] : undefined;
  switch (a.type) {
    case 'setPolicy': { const f = a.field || a.key; const allowed = ['taxBurden', 'corpTax', 'policyRate', 'tariff', 'fdiOpenness', 'regulation', 'migration', 'energy']; if (!allowed.includes(f)) return null; return { type: 'setPolicy', patch: { [f]: f === 'energy' ? a.id || a.value : Number(a.value) } as any }; }
    case 'setSpending': return SPEND_KEYS.includes(a.key) && isFinite(a.value) ? { type: 'setSpending', key: a.key, value: Number(a.value) } : null;
    case 'reform': return typeof a.id === 'string' ? { type: 'reform', id: a.id } : null;
    case 'strategicSector': return SECTORS.includes(a.sector) ? { type: 'strategicSector', sector: a.sector, on: true } : null;
    case 'joinOrg': case 'leaveOrg': return w.orgs.some((o) => o.id === a.org) ? { type: a.type, org: a.org } : null;
    case 'summit': return { type: 'summit', invitees: (Array.isArray(a.invitees) ? a.invitees : [tgt]).filter((x: string) => w.countries[x]) };
    default:
      if (!tgt || tgt === actor) return null;
      if (a.type === 'proposeTreaty' || a.type === 'cancelTreaty') return ['alliance', 'defense', 'fta', 'nap', 'investment', 'tech'].includes(a.treaty) ? { type: a.type, target: tgt, treaty: a.treaty } : null;
      if (a.type === 'sanction') return { type: 'sanction', target: tgt, level: Math.max(1, Math.min(3, Number(a.level) || 2)) };
      if (a.type === 'proposePeace') return { type: 'proposePeace', target: tgt, terms: ['white', 'cede', 'ceasefire'].includes(a.terms) ? a.terms : 'white' };
      if (a.type === 'foreignAid') return { type: 'foreignAid', target: tgt, amount: Number(a.amount) || 500 };
      if (['improveRelations', 'denounce', 'liftSanctions', 'declareWar'].includes(a.type)) return { type: a.type, target: tgt } as Action;
      return null;
  }
}

export interface OrderOutcome { source: 'ai' | 'rules'; summary: string; results: { action: Action; result: Result }[] }
export async function executeOrder(w: WorldState, actor: string, text: string, cfg: AIConfig, lang: Lang, allowWar: boolean): Promise<OrderOutcome> {
  let actions: Action[] = []; let source: 'ai' | 'rules' = 'rules'; let summary = '';
  const sys = `You translate a head of government's orders into game actions for a geopolitical simulation. Country codes are ISO-3. Current policy: ${JSON.stringify(w.countries[actor].policy)}. Only use the listed action types. setPolicy uses field+value (taxBurden % GDP, corpTax %, policyRate %, tariff %, fdiOpenness 0-1, regulation 0-1, migration 0-1, energy balanced|green|fossil|nuclear via id). setSpending uses key (${SPEND_KEYS.join(',')}) and absolute value in % of GDP. Write the summary in ${langName(lang)}.`;
  const r = await askJSON<{ summary: string; actions: any[] }>(cfg, sys, `Country: ${actor}. Orders: ${text}`, ACTION_SCHEMA, 45000);
  if (r && Array.isArray(r.actions)) { actions = r.actions.map((a) => sanitize(w, a, actor)).filter(Boolean) as Action[]; source = 'ai'; summary = r.summary || ''; }
  if (!actions.length) { actions = parseOrders(w, actor, text); source = 'rules'; summary = ''; }
  if (!allowWar) actions = actions.filter((a) => a.type !== 'declareWar');
  const results = actions.slice(0, 6).map((action) => ({ action, result: perform(w, actor, action) }));
  return { source, summary, results };
}

// ---------------- Diplomat: conversation with an AI government ----------------
export async function diplomatReply(w: WorldState, player: string, other: string, message: string, cfg: AIConfig, lang: Lang): Promise<{ text: string; prov: 'ai' | 'simulated'; result?: Result }> {
  // 1) Game rules decide any concrete proposal in the message.
  const acts = parseOrders(w, player, message + ' ' + cname(other, 'en', w)).filter((a) => 'target' in a && (a as any).target === other && ['proposeTreaty', 'proposePeace', 'foreignAid', 'improveRelations'].includes(a.type));
  let result: Result | undefined;
  if (acts[0]) result = perform(w, player, acts[0]);
  const O = w.countries[other];
  const rel = Math.round(getRel(w, player, other)); const tr = Math.round(trust(w, other, player));
  const mem = O.ai.memory.filter((m) => m.with === player).slice(-8).map((m) => `${m.kind}(${m.delta > 0 ? '+' : ''}${m.delta}) at month ${m.t}`);
  const outcome = result ? (result.accepted ? 'ACCEPTED' : result.ok ? 'REJECTED' : 'NOT POSSIBLE') + (result.reasons?.length ? ' because: ' + result.reasons.map((x) => translate('en', x)).join(', ') : '') : 'no formal proposal';
  // 2) The model only phrases the reply, in character.
  const sys = `You are the government of ${O.name} (${O.gov.type}) in a geopolitical simulation, speaking to ${w.countries[player].name}. Stay in character, be concise (max 90 words), diplomatic, and consistent with the facts. Relation: ${rel}/100. Trust: ${tr}/100. Your priorities: ${O.ai.goals.join(', ')}. You remember: ${mem.join('; ') || 'nothing notable'}. The game engine already decided the outcome of any proposal: ${outcome}. Never contradict that outcome. Reply in ${langName(lang)}.`;
  const r = await askJSON<{ reply: string }>(cfg, sys, message, { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'] }, 45000);
  if (r?.reply) return { text: r.reply, prov: 'ai', result };
  const fb = result ? (result.accepted ? translate(lang, 'ai.fallbackReply.accept') : translate(lang, 'ai.fallbackReply.reject') + (result.reasons?.length ? ' (' + result.reasons.map((x) => translate(lang, x)).join(', ') + ')' : '')) : translate(lang, 'ai.fallbackReply.chat', { r: rel });
  return { text: fb, prov: 'simulated', result };
}

// ---------------- Analyst ----------------
export async function analystAnswer(w: WorldState, iso: string, question: string, cfg: AIConfig, lang: Lang): Promise<Analysis & { ai?: string }> {
  const base = analyze(w, iso, question, lang);
  const c = w.countries[iso];
  const recent = w.news.filter((n) => n.countries.includes(iso)).slice(0, 8).map((n) => translate('en', n.key, n.params));
  const sys = `You are a senior economic and financial analyst inside a geopolitical simulation. Use ONLY the data provided (it is simulated game data, not real-world data). Explain causes and relationships and outline 2-3 scenarios. Max 160 words. Answer in ${langName(lang)}.`;
  const r = await askJSON<{ answer: string }>(cfg, sys, `Question: ${question}\nCountry data: ${JSON.stringify(summarize(w, c))}\nRule-based findings: ${JSON.stringify(base)}\nRecent events: ${recent.join(' | ')}`, { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }, 60000);
  return r?.answer ? { ...base, ai: r.answer } : base;
}

// ---------------- Strategic layer for AI countries ----------------
let busy = false;
export async function strategicRound(w: WorldState, cfg: AIConfig) {
  if (busy || !cfg.enabled) return; busy = true;
  try {
    const majors = Object.values(w.countries).filter((c) => c.alive && c.iso !== w.player).sort((a, b) => b.econ.gdp - a.econ.gdp).slice(0, 12);
    const pick = majors[w.t % majors.length]; if (!pick) return;
    const neigh = Object.values(w.countries).filter((x) => x.alive && x.iso !== pick.iso).map((x) => ({ iso: x.iso, rel: Math.round(getRel(w, pick.iso, x.iso)), gdp: Math.round(x.econ.gdp / 1000) })).sort((a, b) => Math.abs(b.rel) * Math.log(b.gdp + 1) - Math.abs(a.rel) * Math.log(a.gdp + 1)).slice(0, 15);
    const sys = `You are the strategic planning agent of ${pick.name} in a geopolitical simulation. Choose at most 2 actions that serve your national interest given the situation. Avoid war unless overwhelmingly justified. Personality: aggression ${pick.ai.aggression.toFixed(2)}, cooperation ${pick.ai.cooperation.toFixed(2)}. Write a one-sentence public summary in English.`;
    const r = await askJSON<{ summary: string; actions: any[] }>(cfg, sys, JSON.stringify({ self: summarize(w, pick), goals: pick.ai.goals, relations: neigh, wars: warsOf(w, pick.iso).map((x) => x.id) }), ACTION_SCHEMA, 60000);
    if (!r?.actions?.length || !w.countries[pick.iso]?.alive) return;
    const done: string[] = [];
    for (const a of r.actions.slice(0, 2)) {
      const act = sanitize(w, a, pick.iso); if (!act) continue;
      if (act.type === 'declareWar' && pick.ai.aggression < 0.6) continue;
      if (act.type === 'proposeTreaty' && evaluateProposal(w, pick.iso, (act as any).target, (act as any).treaty).score < -50) continue;
      const res = perform(w, pick.iso, act); if (res.ok) done.push(act.type);
    }
    if (done.length && r.summary) news(w, 'diplomacy', 'ev.llmAction', { c: pick.iso, text: r.summary.slice(0, 160) }, [pick.iso], 1, [], [], 'ai');
  } finally { busy = false; }
}
