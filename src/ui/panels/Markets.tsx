import { useState } from 'react';
import { useGame, Section, Prov, Tabs, Stat } from '../common';
import { LineChart, Spark, pal } from '../charts';
import { fmtDate, fmtMoney, fmtNum, fmtPct } from '../../i18n';
import { MARKET_SNAPSHOT } from '../../data/reference';
import { priceOf, trade, portfolioValue } from '../../sim/markets';
import { debtRatio } from '../../sim/economy';

type Tab = 'terminal' | 'bonds' | 'fx' | 'commodities' | 'portfolio' | 'watch' | 'real';
const chg = (a: number[], n: number) => (a.length > n ? (a[a.length - 1] / a[a.length - 1 - n] - 1) * 100 : NaN);

export function MarketsPanel() {
  const { w, t, lang, bump, toast, select, setPanel } = useGame();
  const [tab, setTab] = useState<Tab>('terminal');
  const [inst, setInst] = useState<string>('commodity:brent');
  const [amt, setAmt] = useState(1000);
  const [q, setQ] = useState('');
  const big = Object.values(w.countries).filter((c) => c.alive && c.econ.gdp > 150000 && (!q || (c.name + c.nameFr).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.econ.gdp - a.econ.gdp);
  const cn = (iso: string) => (lang === 'fr' ? w.countries[iso].nameFr : w.countries[iso].name);
  const instName = (id: string) => { const [k, x] = id.split(':'); if (k === 'commodity') return t('cm.' + x); if (k === 'company') return w.companies.find((c) => c.id === x)?.name || x; if (!w.countries[x]) return id; return cn(x) + ' · ' + (k === 'equity' ? t('mk.equities') : k === 'bond' ? t('mk.bonds') : t('mk.fx')); };
  const histOf = (id: string): number[] => { const [k, x] = id.split(':'); const c = w.countries[x];
    if (k === 'commodity') return w.commodities[x]?.hist || []; if (k === 'equity') return c?.hist.equity || []; if (k === 'bond') return c?.hist.bond || []; if (k === 'fx') return c?.hist.fx || []; if (k === 'company') return w.companies.find((y) => y.id === x)?.hist || []; return []; };
  const watch = (id: string) => { if (!w.watchlist.includes(id)) { w.watchlist.push(id); bump(); } };
  const labelsFor = (n: number) => Array.from({ length: n }, (_, i) => fmtDate(w, w.t - n + 1 + i, lang));
  const doTrade = (id: string, usd: number) => { const ok = trade(w, id, usd); toast(ok ? (usd > 0 ? t('mk.buy') : t('mk.sell')) + ' ✓' : 'Error', ok ? 'ok' : 'err'); bump(); };
  const hist = histOf(inst);
  return (
    <div>
      <Tabs tabs={[['terminal', t('mk.equities')], ['bonds', t('mk.bonds')], ['fx', t('mk.fx')], ['commodities', t('mk.commodities')], ['portfolio', t('mk.portfolio')], ['watch', t('mk.watchlist')], ['real', t('mk.real')]]} value={tab} onChange={setTab} />
      {tab !== 'real' && <div className="note sim">{t('mk.sim')} — <Prov p="simulated" /> <button className="link" onClick={() => setTab('real')}>{t('mk.real')} →</button></div>}
      {tab !== 'real' && tab !== 'portfolio' && <Section title={instName(inst)} right={<span><button className="btn sm ghost" onClick={() => watch(inst)}>{t('mk.add')}</button></span>}>
        <LineChart series={[{ name: instName(inst), data: hist, color: pal(0) }]} labels={labelsFor(hist.length)} height={150} />
        <div className="row"><Stat label={t('mk.price')} value={fmtNum(priceOf(w, inst) || 0, 2, lang)} /><Stat label={t('mk.chg1m')} value={fmtPct(chg(hist, 1), 1, lang)} /><Stat label={t('mk.chg1y')} value={fmtPct(chg(hist, 12), 1, lang)} />
          {w.player && <div className="trade"><input className="inp sm" type="number" value={amt} min={1} onChange={(e) => setAmt(+e.target.value)} aria-label={t('mk.amount')} /><button className="btn sm primary" onClick={() => doTrade(inst, amt)}>{t('mk.buy')}</button><button className="btn sm" onClick={() => doTrade(inst, -amt)}>{t('mk.sell')}</button></div>}</div>
      </Section>}
      {(tab === 'terminal' || tab === 'bonds' || tab === 'fx') && <input className="inp" placeholder={t('ui.search')} value={q} onChange={(e) => setQ(e.target.value)} />}
      {tab === 'terminal' && <table className="tbl click"><thead><tr><th>{t('news.country')}</th><th className="r">{t('mk.level')}</th><th className="r">{t('mk.chg1m')}</th><th className="r">{t('mk.chg1y')}</th><th className="r">{t('mk.vol')}</th><th /></tr></thead><tbody>
        {big.map((c) => <tr key={c.iso} onClick={() => setInst('equity:' + c.iso)} className={inst === 'equity:' + c.iso ? 'on' : ''}><td>{c.flag} {cn(c.iso)}</td><td className="r">{fmtNum(c.fin.equity, 0, lang)}</td><td className={'r ' + (chg(c.hist.equity, 1) >= 0 ? 'pos' : 'neg')}>{fmtPct(chg(c.hist.equity, 1), 1, lang)}</td><td className={'r ' + (chg(c.hist.equity, 12) >= 0 ? 'pos' : 'neg')}>{fmtPct(chg(c.hist.equity, 12), 1, lang)}</td><td className="r">{fmtNum(c.fin.vol, 0, lang)}</td><td><Spark data={c.hist.equity.slice(-24)} /></td></tr>)}
      </tbody></table>}
      {tab === 'terminal' && <p className="muted small">{lang === 'fr' ? 'Indices nationaux simulés (base 1000 au départ). Les niveaux réels des indices (S&P 500, CAC 40…) ne sont pas fournis par la clé gratuite : voir l’onglet Réel.' : 'Simulated national indices (base 1000 at start). Real index levels (S&P 500, CAC 40…) are not available on the free key: see the Real tab.'}</p>}
      {tab === 'bonds' && <>
        <table className="tbl click"><thead><tr><th>{t('news.country')}</th><th className="r">{t('mk.yield')}</th><th className="r">{t('mk.rating')}</th><th className="r">{t('mk.cds')}</th><th className="r">{t('cd.debt')}</th><th /></tr></thead><tbody>
          {big.map((c) => <tr key={c.iso} onClick={() => setInst('bond:' + c.iso)} className={inst === 'bond:' + c.iso ? 'on' : ''}><td>{c.flag} {cn(c.iso)}</td><td className="r">{fmtPct(c.fin.bond10y, 2, lang)}</td><td className="r">{c.fin.rating}</td><td className="r">{c.fin.cds}</td><td className="r">{fmtPct(debtRatio(c), 0, lang)}</td><td><Spark data={c.hist.bond.slice(-24)} color="#e3a33b" /></td></tr>)}
        </tbody></table>
        <Section title={t('mk.yieldCurve')}><svg className="scatter" viewBox="0 0 400 200" role="img" aria-label={t('mk.yieldCurve')}>
          <line x1="30" y1="180" x2="395" y2="180" className="grid" /><line x1="30" y1="5" x2="30" y2="180" className="grid" />
          <text x="395" y="196" className="tick" textAnchor="end">{t('cd.debt')} % → 250</text><text x="34" y="14" className="tick">{t('mk.yield')} % ↑ 20</text>
          {big.map((c) => <circle key={c.iso} cx={30 + Math.min(250, debtRatio(c)) / 250 * 365} cy={180 - Math.min(20, c.fin.bond10y) / 20 * 170} r={Math.max(2.5, Math.sqrt(c.econ.gdp / 1e5))} fill={c.color} opacity={0.75} onClick={() => select(c.iso)}><title>{cn(c.iso)}: {c.fin.bond10y.toFixed(2)}% / {debtRatio(c).toFixed(0)}%</title></circle>)}
        </svg></Section>
      </>}
      {tab === 'fx' && <table className="tbl click"><thead><tr><th>{t('cd.currency')}</th><th className="r">{t('mk.perUsd')}</th><th className="r">{t('mk.chg1y')}</th><th>{t('ui.sourceOf')}</th></tr></thead><tbody>
        {[...new Map(big.map((c) => [c.currency, c])).values()].map((c) => <tr key={c.currency} onClick={() => setInst('fx:' + c.iso)} className={inst === 'fx:' + c.iso ? 'on' : ''}><td>{c.flag} {c.currency} <span className="muted small">{c.currencyName}</span></td><td className="r">{c.currency === 'USD' ? '1' : fmtNum(c.fin.fx, c.fin.fx < 10 ? 4 : 2, lang)}{!c.fin.fxRef && c.currency !== 'USD' ? <span className="muted"> ({t('mk.index')})</span> : ''}</td><td className={'r ' + (-chg(c.hist.fx, 12) >= 0 ? 'pos' : 'neg')}>{fmtPct(-chg(c.hist.fx, 12), 1, lang)}</td><td className="small muted">{c.fin.fxRef ? t('mk.simStart') : t('mk.simIndex')}</td></tr>)}
      </tbody></table>}
      {tab === 'commodities' && <table className="tbl click"><thead><tr><th>{t('mk.instrument')}</th><th className="r">{t('mk.price')}</th><th className="r">{t('mk.chg1m')}</th><th className="r">{t('mk.chg1y')}</th><th /></tr></thead><tbody>
        {Object.values(w.commodities).map((c) => <tr key={c.id} onClick={() => setInst('commodity:' + c.id)} className={inst === 'commodity:' + c.id ? 'on' : ''}><td>{t('cm.' + c.id)} <span className="muted small">{c.unit}</span></td><td className="r">{fmtNum(c.price, 2, lang)}</td><td className="r">{fmtPct(chg(c.hist, 1), 1, lang)}</td><td className="r">{fmtPct(chg(c.hist, 12), 1, lang)}</td><td><Spark data={c.hist.slice(-24)} /></td></tr>)}
        <tr><td colSpan={5}><Stat label={t('mk.risk')} value={fmtNum(w.global.risk, 1, lang)} p="simulated" sub={<Spark data={w.global.riskHist.slice(-36)} color="#d96b6b" w={160} />} /></td></tr>
      </tbody></table>}
      {tab === 'portfolio' && <Section title={t('mk.portfolio')} right={<Prov p="simulated" />}>
        {!w.player ? <p className="muted">{t('err.observer')}</p> : <>
          <div className="stats g3"><Stat label={t('mk.value')} value={fmtMoney(portfolioValue(w), lang)} /><Stat label={t('mk.cash')} value={fmtMoney(w.portfolio.cash, lang)} /><Stat label={t('mk.pnl')} value={fmtMoney(portfolioValue(w) - (w.portfolio.history[0] ?? portfolioValue(w)), lang)} /></div>
          <LineChart series={[{ name: t('mk.value'), data: w.portfolio.history, color: pal(0) }]} labels={labelsFor(w.portfolio.history.length)} height={130} />
          <table className="tbl"><thead><tr><th>{t('mk.instrument')}</th><th className="r">{t('mk.value')}</th><th className="r">{t('mk.pnl')}</th><th /></tr></thead><tbody>
            {w.portfolio.holdings.map((h) => { const val = h.units * (priceOf(w, h.id) || 0); return <tr key={h.id}><td><button className="link" onClick={() => { setInst(h.id); setTab('terminal'); }}>{instName(h.id)}</button></td><td className="r">{fmtMoney(val, lang)}</td><td className={'r ' + (val >= h.cost ? 'pos' : 'neg')}>{fmtPct((val / h.cost - 1) * 100, 1, lang)}</td><td className="r"><button className="btn sm" onClick={() => doTrade(h.id, -val)}>{t('mk.sell')}</button></td></tr>; })}
            {!w.portfolio.holdings.length && <tr><td colSpan={4} className="muted">{t('mk.noHoldings')}</td></tr>}
          </tbody></table></>}
      </Section>}
      {tab === 'watch' && <table className="tbl click"><thead><tr><th>{t('mk.instrument')}</th><th className="r">{t('mk.price')}</th><th className="r">{t('mk.chg1m')}</th><th /></tr></thead><tbody>
        {w.watchlist.map((id) => { const h = histOf(id); return <tr key={id} onClick={() => setInst(id)}><td>{instName(id)}</td><td className="r">{fmtNum(priceOf(w, id) || 0, 2, lang)}</td><td className="r">{fmtPct(chg(h, 1), 1, lang)}</td><td className="r"><Spark data={h.slice(-24)} /> <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); w.watchlist = w.watchlist.filter((x) => x !== id); bump(); }}>{t('mk.remove')}</button></td></tr>; })}
      </tbody></table>}
      {tab === 'real' && <RealMarkets />}
      <p><button className="btn ghost sm" onClick={() => setPanel('intel')}>{t('mk.ask')} →</button></p>
    </div>
  );
}

export function RealMarkets() {
  const { t, lang } = useGame();
  return (
    <div>
      <div className="note real">{t('mk.real')} — <Prov tag={{ prov: 'verified', src: MARKET_SNAPSHOT.src, date: MARKET_SNAPSHOT.fetched }} /> {t('mk.realNote', { d: MARKET_SNAPSHOT.fetched, s: MARKET_SNAPSHOT.src })}</div>
      <Section title={t('cm.brent') + ' ($/bbl, monthly average)'}><LineChart series={[{ name: 'Brent', data: MARKET_SNAPSHOT.brentMonthly.map((x) => x[1]), color: '#e3a33b' }]} labels={MARKET_SNAPSHOT.brentMonthly.map((x) => x[0])} height={140} /></Section>
      <table className="tbl"><thead><tr><th>{t('mk.instrument')}</th><th className="r">{t('mk.price')}</th><th>{t('rw.published')}</th></tr></thead><tbody>
        <tr><td>{t('cm.gold')} ($/oz)</td><td className="r">{fmtNum(MARKET_SNAPSHOT.gold.price, 2, lang)}</td><td className="small">{MARKET_SNAPSHOT.gold.ts}</td></tr>
        {MARKET_SNAPSHOT.fx.map((f) => <tr key={f.pair}><td>{f.pair}</td><td className="r">{fmtNum(f.rate, 4, lang)}</td><td className="small">{f.ts}</td></tr>)}
      </tbody></table>
      <ul className="muted small">{MARKET_SNAPSHOT.unavailable.map((x) => <li key={x}>{t('mk.unavailable')}: {x}</li>)}</ul>
    </div>
  );
}
