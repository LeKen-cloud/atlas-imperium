import { useState } from 'react';
import { useGame, Section, Prov, Stat, CName } from '../common';
import { LineChart, pal } from '../charts';
import { fmtMoney, fmtNum, fmtPct, fmtDate } from '../../i18n';
import { trade } from '../../sim/markets';
import { SECTORS } from '../../sim/types';

export function CorporatePanel() {
  const { w, t, lang, act, bump, toast } = useGame();
  const [q, setQ] = useState(''); const [mine, setMine] = useState(false); const [sector, setSector] = useState(''); const [sel, setSel] = useState<string | null>(null);
  const list = w.companies.filter((c) => (!q || c.name.toLowerCase().includes(q.toLowerCase())) && (!mine || c.hq === w.player) && (!sector || c.sector === sector)).sort((a, b) => Number(b.alive) - Number(a.alive) || b.marketCap - a.marketCap);
  const co = w.companies.find((c) => c.id === sel);
  return (
    <div>
      <div className="note sim">{t('co.real')}. <Prov p="simulated" /></div>
      <div className="row"><input className="inp" placeholder={t('co.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="sel" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">{t('ui.all')}</option>{SECTORS.map((s) => <option key={s} value={s}>{t('sec.' + s)}</option>)}</select>
        <label className="chk"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('co.filterMine')}</label></div>
      {co && <Section title={<>{co.name} {co.real ? <Prov tag={{ prov: 'verified', src: 'Name / HQ / sector' }} /> : <Prov p="simulated" />}</>} right={<button className="btn ghost sm" onClick={() => setSel(null)}>✕</button>}>
        <div className="stats g4">
          <Stat label={t('co.hq')} value={<CName iso={co.hq} />} /><Stat label={t('co.sector')} value={t('sec.' + co.sector)} />
          <Stat label={t('co.revenue')} value={fmtMoney(co.revenue, lang)} p="simulated" /><Stat label={t('co.margin')} value={fmtPct(co.margin * 100, 1, lang)} p="simulated" />
          <Stat label={t('co.mcap')} value={fmtMoney(co.marketCap, lang)} p="simulated" /><Stat label={t('co.employees')} value={fmtNum(co.employees, 0, lang)} p="simulated" />
          <Stat label={t('co.rd')} value={fmtPct(co.rd * 100, 1, lang)} p="simulated" /><Stat label={t('co.state')} value={co.state ? t('ui.yes') : t('ui.no')} />
        </div>
        <LineChart series={[{ name: t('co.mcap'), data: co.hist, color: pal(0) }]} labels={co.hist.map((_, i) => fmtDate(w, w.t - co.hist.length + 1 + i, lang))} height={120} />
        {co.intl.length > 0 && <p>{t('co.intl')}: {co.intl.map((x) => <CName key={x} iso={x} />)}</p>}
        {!co.alive && <p className="warn">{t('co.defunct')}</p>}
        <div className="actions">
          {co.hq === w.player && <>
            {!co.state && <button className="btn sm" onClick={() => act({ type: 'nationalize', company: co.id })}>{t('co.nationalize')}</button>}
            {co.state && <button className="btn sm" onClick={() => act({ type: 'privatize', company: co.id })}>{t('co.privatize')}</button>}
            <button className="btn sm" onClick={() => act({ type: 'subsidizeCompany', company: co.id })}>{t('co.subsidize')}</button>
            <button className="btn sm" onClick={() => act({ type: 'bailout', company: co.id })}>{t('co.bailout')}</button></>}
          {w.player && co.alive && <button className="btn sm primary" onClick={() => { const ok = trade(w, 'company:' + co.id, Math.min(w.portfolio.cash, 1000)); toast(ok ? '✓' : 'Error', ok ? 'ok' : 'err'); bump(); }}>{t('co.invest')} ($1B)</button>}
        </div>
      </Section>}
      <table className="tbl click"><thead><tr><th>{t('mk.instrument')}</th><th>{t('co.hq')}</th><th className="r">{t('co.mcap')}</th><th className="r">{t('co.margin')}</th></tr></thead><tbody>
        {list.map((c) => <tr key={c.id} onClick={() => setSel(c.id)} className={(sel === c.id ? 'on ' : '') + (c.alive ? '' : 'dead')}><td>{c.name} {!c.real && <span className="tag alt">{t('co.generated')}</span>}{c.state && <span className="tag">{t('co.state')}</span>}</td><td>{w.countries[c.hq]?.flag} {c.hq}</td><td className="r">{c.alive ? fmtMoney(c.marketCap, lang) : t('co.defunct')}</td><td className={'r ' + (c.margin >= 0 ? 'pos' : 'neg')}>{fmtPct(c.margin * 100, 1, lang)}</td></tr>)}
      </tbody></table>
    </div>
  );
}
