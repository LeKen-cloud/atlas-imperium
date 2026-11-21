// Rule-based analyst: always available. Explains causes from the simulation's own state and can run
// counterfactual simulations (clone the world, change one thing, compare). Output is structured so the
// UI can separate facts from interpretation.
import type { Country, WorldState } from '../sim/types';
import type { Lang } from '../i18n';
import { cname, fmtMoney, fmtNum, fmtPct } from '../i18n';
import { debtRatio, netEnergyExport, riskScore, potentialGrowth, level } from '../sim/economy';
import { tradeView, computeTrade } from '../sim/trade';
import { tick } from '../sim/engine';
import { sanctionsOn, warsOf } from '../sim/relations';
import { SECTORS } from '../sim/types';

export interface Analysis { facts: string[]; interpretation: string[]; prov: 'simulated' | 'ai'; ranking?: { iso: string; v: number; label: string }[] }
const L = (lang: Lang, en: string, fr: string) => (lang === 'fr' ? fr : en);
const chg = (arr: number[], n: number) => (arr.length > n ? arr[arr.length - 1] / arr[arr.length - 1 - n] - 1 : 0);

export function classify(q: string): string {
  const s = q.toLowerCase();
  if (/curr|monnaie|devise|fx|exchange|change|dollar|euro|yen/.test(s)) return 'fx';
  if (/stock|bourse|equit|action|market|marché/.test(s) && !/energy|énerg/.test(s)) return 'equity';
  if (/industr|sector|secteur|driv|moteur/.test(s)) return 'sectors';
  if (/energy|énerg|oil|pétrole|gas|gaz/.test(s)) return 'energy';
  if (/interest|taux|rate/.test(s)) return 'rates';
  if (/risk|risque|financial system|système financier|bank|banque/.test(s)) return 'risks';
  if (/compet|compét/.test(s)) return 'competitive';
  if (/debt|dette|bond|obligation/.test(s)) return 'debt';
  return 'summary';
}

export function analyze(w: WorldState, iso: string, q: string, lang: Lang): Analysis {
  const c = w.countries[iso]; const kind = classify(q);
  const facts: string[] = [], interp: string[] = [];
  const n = (iso2: string) => cname(iso2, lang, w);
  if (!c) return { facts: [], interpretation: [L(lang, 'No country selected.', 'Aucun pays sélectionné.')], prov: 'simulated' };
  const e = c.econ, f = c.fin; const us = w.countries.USA;
  if (kind === 'fx') {
    const d12 = chg(c.hist.fx, 12), d3 = chg(c.hist.fx, 3);
    facts.push(L(lang, `${n(iso)} currency: ${fmtPct(-d3 * 100, 1, lang)} vs USD over 3 months, ${fmtPct(-d12 * 100, 1, lang)} over 12 months.`, `Monnaie de ${n(iso)} : ${fmtPct(-d3 * 100, 1, lang)} face à l’USD sur 3 mois, ${fmtPct(-d12 * 100, 1, lang)} sur 12 mois.`));
    facts.push(L(lang, `Inflation ${fmtPct(e.inflation, 1, lang)} vs ${fmtPct(us.econ.inflation, 1, lang)} in the US; policy rate ${fmtPct(e.policyRate, 2, lang)} vs ${fmtPct(us.econ.policyRate, 2, lang)}.`, `Inflation ${fmtPct(e.inflation, 1, lang)} contre ${fmtPct(us.econ.inflation, 1, lang)} aux États-Unis ; taux directeur ${fmtPct(e.policyRate, 2, lang)} contre ${fmtPct(us.econ.policyRate, 2, lang)}.`));
    const ca = ((e.exports - e.imports) / e.gdp) * 100;
    facts.push(L(lang, `Trade balance ${fmtPct(ca, 1, lang)} of GDP; reserves ${fmtMoney(f.reserves, lang)}; sovereign risk score ${fmtNum(riskScore(w, c), 1, lang)}.`, `Balance commerciale ${fmtPct(ca, 1, lang)} du PIB ; réserves ${fmtMoney(f.reserves, lang)} ; score de risque souverain ${fmtNum(riskScore(w, c), 1, lang)}.`));
    const realDiff = (e.policyRate - e.inflation) - (us.econ.policyRate - us.econ.inflation);
    if (e.inflation > us.econ.inflation + 1) interp.push(L(lang, 'Higher inflation than the US erodes purchasing power; the fundamental value of the currency drifts down.', 'Une inflation supérieure à celle des États-Unis érode le pouvoir d’achat : la valeur fondamentale de la monnaie baisse.'));
    if (realDiff < -1) interp.push(L(lang, 'Real interest rates are lower than in the US, so capital is drawn to dollar assets.', 'Les taux réels sont inférieurs à ceux des États-Unis : les capitaux se tournent vers les actifs en dollars.'));
    if (ca < -3) interp.push(L(lang, 'A large trade deficit must be financed from abroad, pressuring the currency.', 'Un déficit commercial important doit être financé par l’étranger, ce qui pèse sur la monnaie.'));
    if (riskScore(w, c) > 3) interp.push(L(lang, 'Investors demand a risk premium (debt, deficits, instability, war or sanctions).', 'Les investisseurs exigent une prime de risque (dette, déficits, instabilité, guerre ou sanctions).'));
    if (!interp.length) interp.push(L(lang, 'No strong depreciation pressure: fundamentals are balanced; recent moves are mostly market noise.', 'Pas de forte pression baissière : les fondamentaux sont équilibrés ; les mouvements récents relèvent surtout du bruit de marché.'));
    if (c.currency === 'EUR') interp.push(L(lang, 'The euro is shared: its value reflects the whole euro area, not this country alone.', 'L’euro est partagé : sa valeur reflète toute la zone euro, pas ce seul pays.'));
  } else if (kind === 'equity') {
    facts.push(L(lang, `Index ${fmtNum(f.equity, 0, lang)}: ${fmtPct(chg(c.hist.equity, 3) * 100, 1, lang)} over 3 months; volatility ${fmtPct(f.vol, 0, lang)}.`, `Indice ${fmtNum(f.equity, 0, lang)} : ${fmtPct(chg(c.hist.equity, 3) * 100, 1, lang)} sur 3 mois ; volatilité ${fmtPct(f.vol, 0, lang)}.`));
    facts.push(L(lang, `Growth ${fmtPct(e.growth, 1, lang)}, 10-y yield ${fmtPct(f.bond10y, 2, lang)} (${fmtNum((f.bond10y - (c.hist.bond[c.hist.bond.length - 4] ?? f.bond10y)) * 100, 0, lang)} bp in 3 m), bank health ${fmtNum(e.bankHealth, 0, lang)}/100, global risk ${fmtNum(w.global.risk, 0, lang)}.`, `Croissance ${fmtPct(e.growth, 1, lang)}, taux à 10 ans ${fmtPct(f.bond10y, 2, lang)} (${fmtNum((f.bond10y - (c.hist.bond[c.hist.bond.length - 4] ?? f.bond10y)) * 100, 0, lang)} pb en 3 mois), santé bancaire ${fmtNum(e.bankHealth, 0, lang)}/100, risque mondial ${fmtNum(w.global.risk, 0, lang)}.`));
    if (e.growth < 0.5) interp.push(L(lang, 'Weak growth depresses expected earnings.', 'La faible croissance pèse sur les bénéfices attendus.'));
    if (f.bond10y > (c.hist.bond[c.hist.bond.length - 4] ?? f.bond10y) + 0.3) interp.push(L(lang, 'Rising yields lower the value of future profits.', 'La hausse des taux réduit la valeur des profits futurs.'));
    if (w.global.risk > 25) interp.push(L(lang, 'Global risk aversion is elevated.', 'L’aversion mondiale au risque est élevée.'));
    if (warsOf(w, iso).length) interp.push(L(lang, 'War weighs on confidence and on public finances.', 'La guerre pèse sur la confiance et les finances publiques.'));
    if (!interp.length) interp.push(L(lang, 'Earnings growth and stable rates support the market.', 'La croissance des bénéfices et la stabilité des taux soutiennent le marché.'));
  } else if (kind === 'sectors') {
    const s = SECTORS.map((k) => ({ k, sh: e.sectors[k].share, g: e.sectors[k].growth, contrib: e.sectors[k].share * e.sectors[k].growth })).sort((a, b) => b.contrib - a.contrib);
    facts.push(L(lang, 'Top contributors to growth (share × growth):', 'Principales contributions à la croissance (part × croissance) :'));
    for (const x of s.slice(0, 4)) facts.push(`• ${x.k}: ${fmtPct(x.sh * 100, 1, lang)} ${L(lang, 'of GDP', 'du PIB')}, ${fmtPct(x.g, 1, lang)}`);
    for (const x of s.slice(-3)) interp.push(`${x.k}: ${fmtPct(x.g, 1, lang)} — ${L(lang, 'lagging', 'à la traîne')}`);
    if (c.policy.strategic.length) interp.push(L(lang, `Targeted support is active for: ${c.policy.strategic.join(', ')}.`, `Soutien ciblé actif pour : ${c.policy.strategic.join(', ')}.`));
  } else if (kind === 'energy') {
    const oil = w.commodities.brent.price;
    const rank = Object.values(w.countries).filter((x) => x.alive && x.econ.gdp > 30000).map((x) => ({ iso: x.iso, v: -netEnergyExport(x, oil) * 100 })).sort((a, b) => b.v - a.v).slice(0, 10);
    facts.push(L(lang, `Brent at $${fmtNum(oil, 1, lang)}. Ranking by net energy import bill (% GDP, estimate from OWID production and consumption):`, `Brent à ${fmtNum(oil, 1, lang)} $. Classement par facture énergétique nette (% du PIB, estimation à partir des données OWID) :`));
    return { facts, interpretation: [L(lang, 'Countries that import most of their energy relative to GDP suffer most from price spikes: inflation rises, the trade balance worsens and growth slows.', 'Les pays qui importent le plus d’énergie relativement à leur PIB souffrent le plus des flambées : inflation, dégradation de la balance commerciale, croissance plus faible.')], prov: 'simulated', ranking: rank.map((r) => ({ ...r, label: fmtPct(r.v, 1, lang) })) };
  } else if (kind === 'rates') {
    // Counterfactual: +2 points on the policy rate for 12 months vs baseline
    const base: WorldState = JSON.parse(JSON.stringify(w)); const alt: WorldState = JSON.parse(JSON.stringify(w));
    const A = alt.countries[iso];
    const eu = c.currency === 'EUR';
    if (eu) alt.global.ecbRate += 2; else A.policy.policyRate = e.policyRate + 2;
    for (let i = 0; i < 12; i++) { if (eu) alt.global.ecbRate = Math.max(alt.global.ecbRate, base.global.ecbRate + 2); tick(base); tick(alt); }
    const B = base.countries[iso], X = alt.countries[iso];
    computeTrade(w); // restore derived trade view for the real world
    facts.push(L(lang, 'Counterfactual simulation: policy rate +2 points for 12 months, compared with no change.', 'Simulation contrefactuelle : taux directeur +2 points pendant 12 mois, comparé au statu quo.'));
    facts.push(`${L(lang, 'Growth', 'Croissance')}: ${fmtPct(B.econ.growth, 1, lang)} → ${fmtPct(X.econ.growth, 1, lang)}`);
    facts.push(`${L(lang, 'Inflation', 'Inflation')}: ${fmtPct(B.econ.inflation, 1, lang)} → ${fmtPct(X.econ.inflation, 1, lang)}`);
    facts.push(`${L(lang, 'Unemployment', 'Chômage')}: ${fmtPct(B.econ.unemployment, 1, lang)} → ${fmtPct(X.econ.unemployment, 1, lang)}`);
    facts.push(`${L(lang, '10-y yield', 'Taux à 10 ans')}: ${fmtPct(B.fin.bond10y, 2, lang)} → ${fmtPct(X.fin.bond10y, 2, lang)} · ${L(lang, 'Stocks', 'Actions')}: ${fmtNum(B.fin.equity, 0, lang)} → ${fmtNum(X.fin.equity, 0, lang)}`);
    interp.push(L(lang, 'Higher rates cool demand and inflation, raise borrowing costs (including on public debt) and weigh on equities; the currency tends to strengthen.', 'Des taux plus élevés freinent la demande et l’inflation, renchérissent l’emprunt (y compris pour la dette publique) et pèsent sur les actions ; la monnaie tend à s’apprécier.'));
    if (eu) interp.push(L(lang, 'In the euro area the ECB sets rates for all members; this test raises the euro-area rate.', 'Dans la zone euro, la BCE fixe les taux pour tous ; ce test relève le taux de la zone.'));
  } else if (kind === 'risks' || kind === 'debt') {
    const items: [string, boolean][] = [
      [L(lang, `Public debt ${fmtPct(debtRatio(c), 0, lang)} of GDP`, `Dette publique ${fmtPct(debtRatio(c), 0, lang)} du PIB`), debtRatio(c) > 90],
      [L(lang, `Budget deficit ${fmtPct(e.deficit, 1, lang)} of GDP`, `Déficit budgétaire ${fmtPct(e.deficit, 1, lang)} du PIB`), e.deficit > 4],
      [L(lang, `Bank health ${fmtNum(e.bankHealth, 0, lang)}/100`, `Santé bancaire ${fmtNum(e.bankHealth, 0, lang)}/100`), e.bankHealth < 45],
      [L(lang, `Private debt ${fmtPct(e.privateDebt, 0, lang)} of GDP`, `Dette privée ${fmtPct(e.privateDebt, 0, lang)} du PIB`), e.privateDebt > 160],
      [L(lang, `Inflation ${fmtPct(e.inflation, 1, lang)}`, `Inflation ${fmtPct(e.inflation, 1, lang)}`), e.inflation > 6],
      [L(lang, `Stability ${fmtNum(c.gov.stability, 0, lang)}/100`, `Stabilité ${fmtNum(c.gov.stability, 0, lang)}/100`), c.gov.stability < 40],
      [L(lang, `Sanctions received: ${sanctionsOn(w, iso).length}`, `Sanctions subies : ${sanctionsOn(w, iso).length}`), sanctionsOn(w, iso).length > 3],
      [L(lang, `Active wars: ${warsOf(w, iso).length}`, `Guerres en cours : ${warsOf(w, iso).length}`), warsOf(w, iso).length > 0],
    ];
    for (const [s, bad] of items) facts.push((bad ? '⚠ ' : '✓ ') + s);
    facts.push(L(lang, `Rating ${f.rating}, CDS ${f.cds} bp, 10-y yield ${fmtPct(f.bond10y, 2, lang)}.`, `Note ${f.rating}, CDS ${f.cds} pb, taux à 10 ans ${fmtPct(f.bond10y, 2, lang)}.`));
    const bad = items.filter((x) => x[1]).length;
    interp.push(bad >= 3 ? L(lang, 'Several vulnerabilities reinforce each other: a shock could trigger a debt or banking crisis.', 'Plusieurs vulnérabilités se renforcent : un choc pourrait déclencher une crise de la dette ou bancaire.') : bad ? L(lang, 'Contained risks, but watch the flagged indicators.', 'Risques contenus, mais surveillez les indicateurs signalés.') : L(lang, 'The financial system looks resilient.', 'Le système financier semble résilient.'));
  } else if (kind === 'competitive') {
    const rank = Object.values(w.countries).filter((x) => x.alive && x.econ.gdp > 50000).map((x) => ({ iso: x.iso, v: potentialGrowth(x) - (4.0 * Math.max(0, Math.min(1, (4.95 - level(x)) / 2.1))) })).sort((a, b) => b.v - a.v).slice(0, 10);
    facts.push(L(lang, 'Ranking by structural advantage beyond income level (education, infrastructure, technology, institutions, openness):', 'Classement par avantage structurel au-delà du niveau de revenu (éducation, infrastructures, technologie, institutions, ouverture) :'));
    return { facts, interpretation: [L(lang, 'These economies grow faster than their income level alone would predict.', 'Ces économies croissent plus vite que leur seul niveau de revenu ne le laisserait prévoir.')], prov: 'simulated', ranking: rank.map((r) => ({ ...r, label: '+' + fmtNum(r.v, 2, lang) })) };
  } else {
    facts.push(L(lang, `GDP ${fmtMoney(e.gdp, lang)}, growth ${fmtPct(e.growth, 1, lang)} (potential ${fmtPct(e.potential, 1, lang)}), inflation ${fmtPct(e.inflation, 1, lang)}, unemployment ${fmtPct(e.unemployment, 1, lang)}.`, `PIB ${fmtMoney(e.gdp, lang)}, croissance ${fmtPct(e.growth, 1, lang)} (potentiel ${fmtPct(e.potential, 1, lang)}), inflation ${fmtPct(e.inflation, 1, lang)}, chômage ${fmtPct(e.unemployment, 1, lang)}.`));
    const tp = tradeView().partners[iso]?.slice(0, 3).map((p) => n(p.iso)).join(', ');
    facts.push(L(lang, `Main partners: ${tp}. Stability ${fmtNum(c.gov.stability, 0, lang)}, approval ${fmtNum(c.gov.approval, 0, lang)}.`, `Principaux partenaires : ${tp}. Stabilité ${fmtNum(c.gov.stability, 0, lang)}, popularité ${fmtNum(c.gov.approval, 0, lang)}.`));
    interp.push(e.growth > e.potential ? L(lang, 'The economy runs above potential: watch inflation.', 'L’économie tourne au-dessus de son potentiel : attention à l’inflation.') : L(lang, 'The economy runs below potential: there is room for stimulus if finances allow.', 'L’économie tourne sous son potentiel : il y a de la marge pour une relance si les finances le permettent.'));
  }
  return { facts, interpretation: interp, prov: 'simulated' };
}

export function summarize(w: WorldState, c: Country) {
  const e = c.econ;
  return {
    country: c.name, gov: c.gov.type, gdp_usd_bn: Math.round(e.gdp / 1000), growth: +e.growth.toFixed(1), inflation: +e.inflation.toFixed(1), unemployment: +e.unemployment.toFixed(1),
    debt_pct_gdp: Math.round(debtRatio(c)), deficit: +e.deficit.toFixed(1), policy_rate: +e.policyRate.toFixed(2), bond10y: +c.fin.bond10y.toFixed(2), rating: c.fin.rating,
    fx_change_12m_pct: +(chg(c.hist.fx, 12) * -100).toFixed(1), equity_change_3m_pct: +(chg(c.hist.equity, 3) * 100).toFixed(1), stability: Math.round(c.gov.stability), approval: Math.round(c.gov.approval),
    top_sectors: SECTORS.map((k) => [k, e.sectors[k].share, e.sectors[k].growth] as const).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, s, g]) => `${k} ${(s * 100).toFixed(0)}% (${g.toFixed(1)}%)`),
    partners: tradeView().partners[c.iso]?.slice(0, 5).map((p) => p.iso), wars: warsOf(w, c.iso).map((x) => x.attackers[0] + ' vs ' + x.defenders[0]),
    sanctions_received: sanctionsOn(w, c.iso).length, oil_price: Math.round(w.commodities.brent.price), global_risk: Math.round(w.global.risk),
  };
}
