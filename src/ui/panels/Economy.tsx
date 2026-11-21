import { useState } from 'react';
import { useFocus, NoCountry, ReadOnlyNote } from './index';
import { Section, Stat, Slider, Bar, Prov, Tabs } from '../common';
import { LineChart, pal, Donut } from '../charts';
import { fmtDate, fmtMoney, fmtNum, fmtPct } from '../../i18n';
import { SECTORS, type Sector } from '../../sim/types';
import { debtRatio, hasMonetaryAuthority, totalSpend, potentialGrowth } from '../../sim/economy';
import { WORLD } from '../../sim/geo';

type Tab = 'overview' | 'sectors' | 'policy' | 'budget';
export function EconomyPanel() {
  const { w, t, lang, iso, mine, act } = useFocus();
  const [tab, setTab] = useState<Tab>('overview');
  if (!iso) return <NoCountry />;
  const c = w.countries[iso]; const e = c.econ; const p = c.policy;
  const labels = c.hist.t.map((x) => fmtDate(w, x, lang));
  const sectors = SECTORS.map((k) => ({ k, ...e.sectors[k], contrib: e.sectors[k].share * e.sectors[k].growth })).sort((a, b) => b.share - a.share);
  const real = WORLD.countries[iso]?.real;
  const monetary = hasMonetaryAuthority(c);
  return (
    <div>
      {!mine && <ReadOnlyNote iso={iso} />}
      <Tabs tabs={[['overview', t('eco.overview')], ['sectors', t('eco.sectors')], ['policy', t('eco.policy')], ['budget', t('eco.budget')]]} value={tab} onChange={setTab} />
      {tab === 'overview' && <>
        <Section title={t('eco.overview')} right={<Prov p="simulated" />}>
          <div className="stats g4">
            <Stat label={t('cd.gdp')} value={fmtMoney(e.gdp, lang)} />
            <Stat label={t('cd.growth')} value={fmtPct(e.growth, 1, lang)} sub={t('eco.potential') + ' ' + fmtPct(potentialGrowth(c), 1, lang)} />
            <Stat label={t('eco.gap')} value={fmtPct(e.gap, 1, lang)} />
            <Stat label={t('cd.inflation')} value={fmtPct(e.inflation, 1, lang)} />
            <Stat label={t('cd.unemployment')} value={fmtPct(e.unemployment, 1, lang)} />
            <Stat label={t('cd.policyRate')} value={fmtPct(e.policyRate, 2, lang)} sub={monetary ? '' : 'ECB/shared'} />
            <Stat label={t('eco.exports')} value={fmtMoney(e.exports, lang)} />
            <Stat label={t('eco.imports')} value={fmtMoney(e.imports, lang)} />
            <Stat label={t('eco.fdi')} value={fmtMoney(e.fdiInflow, lang)} />
            <Stat label={t('eco.investment')} value={fmtPct(e.investment, 1, lang)} />
            <Stat label={t('eco.banks')} value={fmtNum(e.bankHealth, 0, lang)} />
            <Stat label={t('eco.privateDebt')} value={fmtPct(e.privateDebt, 0, lang)} />
          </div>
          <LineChart series={[{ name: t('cd.growth'), data: c.hist.growth, color: pal(0) }, { name: t('cd.inflation'), data: c.hist.infl, color: pal(1) }, { name: t('cd.unemployment'), data: c.hist.unemp, color: pal(2) }]} labels={labels} unit="%" zero />
        </Section>
        {real?.gdpHist?.length ? <Section title={t('cd.realGdpHist')} right={<Prov tag={{ prov: 'verified', src: 'World Bank WDI', date: String(real.gdp?.y) }} />}>
          <LineChart series={[{ name: 'GDP $bn', data: real.gdpHist.map((x) => x[1] / 1000), color: pal(2) }]} labels={real.gdpHist.map((x) => String(x[0]))} height={130} />
        </Section> : null}
        <Section title={t('eco.tradeoffs')}><p className="muted">{t('eco.tradeoffs.d')}</p></Section>
      </>}
      {tab === 'sectors' && <>
        <Section title={t('eco.driving')} right={<Prov p="simulated" />}>
          {[...sectors].sort((a, b) => b.contrib - a.contrib).slice(0, 4).map((s) => <Bar key={s.k} label={t('sec.' + s.k)} value={s.growth} max={10} color="#4fb3a9" right={fmtPct(s.growth, 1, lang)} />)}
          <h4>{t('eco.struggling')}</h4>
          {[...sectors].sort((a, b) => a.growth - b.growth).slice(0, 3).map((s) => <Bar key={s.k} label={t('sec.' + s.k)} value={Math.abs(Math.min(0, s.growth)) + 0.1} max={10} color="#d96b6b" right={fmtPct(s.growth, 1, lang)} />)}
        </Section>
        <Section title={t('eco.sectors')}>
          <table className="tbl"><thead><tr><th>{t('co.sector')}</th><th className="r">{t('eco.share')}</th><th className="r">{t('eco.sectorGrowth')}</th><th className="r">{t('eco.health')}</th><th>{t('pol.strategic')}</th></tr></thead><tbody>
            {sectors.map((s) => <tr key={s.k}><td>{t('sec.' + s.k)}</td><td className="r">{fmtPct(s.share * 100, 1, lang)}</td><td className={'r ' + (s.growth >= 0 ? 'pos' : 'neg')}>{fmtPct(s.growth, 1, lang)}</td><td className="r">{s.health.toFixed(0)}</td>
              <td><input type="checkbox" disabled={!mine} checked={p.strategic.includes(s.k as Sector)} onChange={(ev) => act({ type: 'strategicSector', sector: s.k as Sector, on: ev.target.checked })} aria-label={t('pol.strategic')} /></td></tr>)}
          </tbody></table>
          <p className="muted small">{t('prov.estimate')}: {lang === 'fr' ? 'structure sectorielle initiale estimée à partir du revenu et des données énergétiques réelles.' : 'initial sector mix estimated from income level and real energy data.'}</p>
        </Section>
      </>}
      {tab === 'policy' && <Section title={t('eco.policy')}>
        <Slider label={t('pol.taxBurden')} value={p.taxBurden} min={5} max={55} step={0.5} disabled={!mine} fmt={(v) => fmtPct(v, 1, lang)} onCommit={(v) => act({ type: 'setPolicy', patch: { taxBurden: v } })} />
        <Slider label={t('pol.corpTax')} value={p.corpTax} min={0} max={45} step={1} disabled={!mine} fmt={(v) => fmtPct(v, 0, lang)} onCommit={(v) => act({ type: 'setPolicy', patch: { corpTax: v } })} />
        <div className="row">
          <Slider label={t('pol.policyRate')} value={p.policyRate ?? e.policyRate} min={0} max={30} step={0.25} disabled={!mine || !monetary || p.policyRate === null} fmt={(v) => fmtPct(v, 2, lang)} onCommit={(v) => act({ type: 'setPolicy', patch: { policyRate: v } })} />
          <label className="chk"><input type="checkbox" disabled={!mine || !monetary} checked={p.policyRate === null} onChange={(ev) => act({ type: 'setPolicy', patch: { policyRate: ev.target.checked ? null : +e.policyRate.toFixed(2) } })} />{t('pol.cbAuto')}</label>
        </div>
        {!monetary && <p className="muted small">{t('pol.noMonetary')}</p>}
        <Slider label={t('pol.tariff')} value={p.tariff} min={0} max={50} step={0.5} disabled={!mine} fmt={(v) => fmtPct(v, 1, lang)} onCommit={(v) => act({ type: 'setPolicy', patch: { tariff: v } })} />
        <Slider label={t('pol.fdi')} value={p.fdiOpenness * 100} min={0} max={100} step={5} disabled={!mine} fmt={(v) => v.toFixed(0)} onCommit={(v) => act({ type: 'setPolicy', patch: { fdiOpenness: v / 100 } })} />
        <Slider label={t('pol.regulation')} value={p.regulation * 100} min={0} max={100} step={5} disabled={!mine} fmt={(v) => v.toFixed(0)} onCommit={(v) => act({ type: 'setPolicy', patch: { regulation: v / 100 } })} />
        <Slider label={t('pol.migration')} value={p.migration * 100} min={0} max={100} step={5} disabled={!mine} fmt={(v) => v.toFixed(0)} onCommit={(v) => act({ type: 'setPolicy', patch: { migration: v / 100 } })} />
        <label className="field">{t('pol.energy')} <select className="sel" disabled={!mine} value={p.energy} onChange={(ev) => act({ type: 'setPolicy', patch: { energy: ev.target.value as any } })}>{['balanced', 'green', 'fossil', 'nuclear'].map((k) => <option key={k} value={k}>{t('energy.' + k)}</option>)}</select></label>
        <label className="chk"><input type="checkbox" disabled={!mine} checked={p.capitalControls} onChange={(ev) => act({ type: 'setPolicy', patch: { capitalControls: ev.target.checked } })} />{t('pol.capitalControls')}</label>
        <p className="muted small">{t('eco.tradeoffs.d')}</p>
      </Section>}
      {tab === 'budget' && <Section title={t('eco.budget')} right={<Prov p="simulated" />}>
        <div className="stats g4">
          <Stat label={t('eco.revenue')} value={fmtMoney(e.revenue, lang)} />
          <Stat label={t('eco.spending')} value={fmtMoney(e.expenditure, lang)} />
          <Stat label={t('eco.interest')} value={fmtMoney(e.interest, lang)} />
          <Stat label={e.deficit > 0 ? t('eco.deficit') : t('eco.surplus')} value={fmtPct(Math.abs(e.deficit), 1, lang)} />
          <Stat label={t('cd.debt')} value={fmtMoney(e.debt, lang)} sub={fmtPct(debtRatio(c), 0, lang)} />
          <Stat label={t('cd.bond')} value={fmtPct(c.fin.bond10y, 2, lang)} />
        </div>
        <div className="donutrow"><Donut parts={Object.entries(p.spending).map(([k, v], i) => ({ v, color: pal(i), label: t('sp.' + k) }))} />
          <div className="lg-cats">{Object.entries(p.spending).map(([k, v], i) => <span key={k}><i style={{ background: pal(i) }} />{t('sp.' + k)} {fmtPct(v, 1, lang)}</span>)}</div></div>
        <p className="muted small">Σ {fmtPct(totalSpend(c), 1, lang)} + {t('eco.interest').toLowerCase()} {fmtPct((e.interest / e.gdp) * 100, 1, lang)}</p>
        <LineChart series={[{ name: t('cd.debt') + ' % GDP', data: c.hist.debt, color: pal(3) }]} labels={labels} unit="%" />
      </Section>}
    </div>
  );
}
