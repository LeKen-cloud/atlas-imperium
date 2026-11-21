import { useState } from 'react';
import { useGame, Stat, Prov } from './common';
import { fmtMoney, fmtPct, fmtPop, fmtNum } from '../i18n';
import { debtRatio, gdpPc } from '../sim/economy';
import { getRel, militaryScore, warsOf } from '../sim/relations';
import { Spark } from './charts';

export function CountryCard({ iso }: { iso: string }) {
  const { w, t, lang, select, setPanel, setPlayer, compare, setCompare } = useGame();
  const [min, setMin] = useState(false);
  const c = w.countries[iso]; const e = c.econ;
  const last = (a: number[]) => (a.length > 1 ? a[a.length - 1] - a[a.length - 2] : 0);
  const name = lang === 'fr' ? c.nameFr : c.name;
  const lead = c.gov.headOfState || c.gov.headOfGov;
  return (
    <div className={'ccard' + (min ? ' min' : '')} style={{ ['--cc' as any]: c.color }}>
      <header>
        <span className="cflag" aria-hidden>{c.flag}</span>
        <div className="ct"><h2>{name}</h2><span className="muted">{t('gov.' + c.gov.type)} <Prov tag={c.tags.gov} compact /></span></div>
        <button className="btn ghost sm" onClick={() => setMin(!min)} aria-label={min ? t('ui.expand') : t('ui.collapse')}>{min ? '▴' : '▾'}</button>
        <button className="btn ghost sm" onClick={() => select(null)} aria-label={t('ui.close')}>✕</button>
      </header>
      {!c.alive && <div className="warn">{t('ev.dissolved', { c: iso })}</div>}
      {!min && c.alive && <>
        <dl className="kv two">
          <dt>{t('cd.capital')}</dt><dd>{c.capital || '—'}</dd>
          <dt>{t('cd.hos')}</dt><dd>{lead || <span className="muted small">{t('cd.unknownLeader')}</span>} {lead && <Prov tag={c.gov.leaderTag} compact />}</dd>
          {c.gov.headOfGov && c.gov.headOfGov !== c.gov.headOfState && <><dt>{t('cd.hog')}</dt><dd>{c.gov.headOfGov}</dd></>}
          <dt>{t('cd.currency')}</dt><dd>{c.currencyName || c.currency}</dd>
        </dl>
        <div className="stats g3">
          <Stat label={t('cd.population')} value={fmtPop(c.soc.pop, lang)} tag={c.tags.pop} />
          <Stat label={t('cd.gdp')} value={fmtMoney(e.gdp, lang)} tag={w.t ? { prov: 'simulated' } : c.tags.gdp} sub={<Spark data={c.hist.gdp} />} />
          <Stat label={t('cd.gdppc')} value={'$' + fmtNum(gdpPc(c), 0, lang)} p={w.t ? 'simulated' : c.tags.gdp.prov} />
          <Stat tone={e.growth > 2 ? 'good' : e.growth < 0 ? 'bad' : null} label={t('cd.growth')} value={fmtPct(e.growth, 1, lang)} p="simulated" trend={last(c.hist.growth)} />
          <Stat tone={e.inflation > 8 ? 'bad' : e.inflation > 4 ? 'warn' : 'good'} label={t('cd.inflation')} value={fmtPct(e.inflation, 1, lang)} tag={w.t ? { prov: 'simulated' } : c.tags.inflation} trend={last(c.hist.infl)} />
          <Stat tone={e.unemployment > 10 ? 'bad' : e.unemployment < 5 ? 'good' : null} label={t('cd.unemployment')} value={fmtPct(e.unemployment, 1, lang)} p="estimate" />
          <Stat tone={debtRatio(c) > 120 ? 'bad' : debtRatio(c) > 80 ? 'warn' : 'good'} label={t('cd.debt')} value={fmtPct(debtRatio(c), 0, lang)} tag={w.t ? { prov: 'simulated' } : c.tags.debt} />
          <Stat tone={e.deficit > 6 ? 'bad' : e.deficit > 3 ? 'warn' : 'good'} label={t('cd.budget')} value={fmtPct(-e.deficit, 1, lang)} p="simulated" />
          <Stat tone={c.fin.rating.startsWith('A') ? 'good' : c.fin.rating.startsWith('B') ? 'warn' : 'bad'} label={t('cd.rating')} value={c.fin.rating} p="simulated" sub={fmtPct(c.fin.bond10y, 2, lang)} />
          <Stat tone={c.gov.stability < 35 ? 'bad' : c.gov.stability > 65 ? 'good' : null} label={t('cd.stability')} value={fmtNum(c.gov.stability, 0, lang)} p="simulated" trend={last(c.hist.stability)} />
          <Stat tone={c.gov.approval < 30 ? 'bad' : c.gov.approval > 60 ? 'good' : null} label={t('cd.approval')} value={fmtNum(c.gov.approval, 0, lang)} p="simulated" trend={last(c.hist.approval)} />
          <Stat label={t('cd.military')} value={fmtNum(militaryScore(w, iso), 0, lang)} tag={c.tags.defense} sub={c.mil.nuclear ? '☢' : undefined} />
          <Stat label={t('cd.influence')} value={fmtNum(c.influence, 0, lang)} p="simulated" />
          <Stat label={t('cd.education')} value={fmtNum(c.soc.education, 0, lang)} p="estimate" />
          <Stat label={t('cd.infrastructure')} value={fmtNum(c.infra, 0, lang)} p="estimate" />
        </div>
        {w.player && w.player !== iso && <div className="relrow">{t('cd.relations')}: <b className={getRel(w, w.player, iso) >= 0 ? 'pos' : 'neg'}>{fmtNum(getRel(w, w.player, iso), 0, lang)}</b></div>}
        {warsOf(w, iso).length > 0 && <div className="warn">⚔ {t('mil.wars')}: {warsOf(w, iso).map((x) => (x.attackers[0] === iso ? x.defenders[0] : x.attackers[0])).map((x) => w.countries[x]?.[lang === 'fr' ? 'nameFr' : 'name']).join(', ')}</div>}
        <div className="actions">
          <button className="btn sm" onClick={() => setPanel(w.player === iso ? 'government' : 'diplomacy')}>{t('cd.open')}</button>
          <button className="btn sm" onClick={() => setPanel('economy')}>{t('nav.economy')}</button>
          <button className="btn sm" onClick={() => { if (!compare.includes(iso)) setCompare([...compare, iso].slice(-6)); setPanel('compare'); }}>{t('cd.compare')}</button>
          {w.player !== iso && <button className="btn sm ghost" onClick={() => setPlayer(iso)}>{t('cd.playThis')}</button>}
        </div>
      </>}
    </div>
  );
}
