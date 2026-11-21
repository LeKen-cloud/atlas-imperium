import { useFocus, NoCountry } from './index';
import { Section, Stat, Prov, CName, Bar, Slider } from '../common';
import { fmtDate, fmtNum, fmtPct, fmtMoney } from '../../i18n';
import { militaryScore, allies, warsOf, getRel, power } from '../../sim/relations';
import { countryNeighbors } from '../../sim/geo';
import { CONTEXT_SOURCES } from '../../data/reference';

export function MilitaryPanel() {
  const { w, t, lang, iso, mine, act } = useFocus();
  if (!iso) return <NoCountry />;
  const c = w.countries[iso]; const m = c.mil;
  const nb = [...countryNeighbors(w, iso)].filter((x) => w.countries[x]?.alive);
  const region = [iso, ...nb].sort((a, b) => militaryScore(w, b) - militaryScore(w, a));
  const max = Math.max(...region.map((x) => militaryScore(w, x)), 1);
  const threats = nb.filter((x) => getRel(w, iso, x) < -30).sort((a, b) => power(w.countries[b]) - power(w.countries[a]));
  const wars = w.wars.filter((x) => !x.ceasefire && (x.attackers.includes(iso) || x.defenders.includes(iso) || iso === w.player)).sort((a, b) => Number(b.attackers.includes(iso) || b.defenders.includes(iso)) - Number(a.attackers.includes(iso) || a.defenders.includes(iso)));
  return (
    <div>
      <div className="stats g4">
        <Stat label={t('mil.strength')} value={fmtNum(militaryScore(w, iso), 0, lang)} p="simulated" />
        <Stat label={t('mil.budget')} value={fmtPct(m.spendPct, 1, lang)} tag={c.tags.defense} sub={fmtMoney(c.econ.gdp * m.spendPct / 100, lang)} />
        <Stat label={t('mil.personnel')} value={fmtNum(m.personnel, 0, lang)} p="estimate" />
        <Stat label={t('mil.tech')} value={fmtNum(m.tech, 0, lang)} p="estimate" />
        <Stat label={t('mil.readiness')} value={fmtNum(m.readiness, 0, lang)} p="simulated" />
        <Stat label={t('mil.exhaustion')} value={fmtNum(m.exhaustion, 0, lang)} p="simulated" />
        <Stat label={t('mil.nuclear')} value={m.nuclear ? '☢ ' + t('ui.yes') : t('ui.no')} p="verified" />
        <Stat label={t('mil.allies')} value={allies(w, iso).length} />
      </div>
      {mine && <Slider label={t('mil.budget')} value={c.policy.spending.defense} min={0.3} max={15} step={0.1} fmt={(v) => fmtPct(v, 1, lang)} onCommit={(v) => act({ type: 'setSpending', key: 'defense', value: v })} />}
      <Section title={t('mil.wars')}>
        {!wars.length && <p className="muted">{t('mil.noWars')}</p>}
        {wars.map((x) => { const ctxSrc = CONTEXT_SOURCES.find((s) => s.id === x.id); const mySide = x.attackers.includes(iso) ? 1 : x.defenders.includes(iso) ? -1 : 1; return (
          <div key={x.id} className="war">
            <div><b>{t('mil.attackers')}:</b> {x.attackers.map((a) => <CName key={a} iso={a} />)}</div>
            <div><b>{t('mil.defenders')}:</b> {x.defenders.map((d) => <CName key={d} iso={d} />)}</div>
            <div className="warbar" title={t('mil.score')}><span style={{ width: (50 + x.score / 2) + '%' }} /></div>
            <div className="small">{t('mil.score')}: <b className={x.score * mySide >= 0 ? 'pos' : 'neg'}>{fmtNum(x.score, 0, lang)}</b> · {t('mil.casualties')}: {fmtNum(x.casualties, 0, lang)} <Prov p="simulated" compact /> · {t('mil.since')} {x.start < 0 ? (lang === 'fr' ? 'avant le début' : 'before start') : fmtDate(w, x.start, lang)}</div>
            {x.goals.length > 0 && <div className="small">{t('mil.goals')}: {x.goals.map((g) => w.territories[g].name).join(', ')} · {t('mil.occupied')}: {x.occupied.length}</div>}
            {ctxSrc && <div className="note real small">{t('mil.context')}: {ctxSrc.text} <a href={ctxSrc.url} target="_blank" rel="noreferrer">{ctxSrc.src}</a> <Prov p="verified" compact /></div>}
          </div>); })}
      </Section>
      <Section title={t('mil.balance')}>
        {region.map((x) => <Bar key={x} label={<CName iso={x} />} value={militaryScore(w, x)} max={max} color={x === iso ? '#4fb3a9' : getRel(w, iso, x) < -30 ? '#d96b6b' : '#6f8fd8'} right={fmtNum(militaryScore(w, x), 0, lang)} />)}
      </Section>
      {threats.length > 0 && <Section title={t('mil.threats')}>{threats.map((x) => <span key={x} className="chip neg"><CName iso={x} /> {fmtNum(getRel(w, iso, x), 0, lang)}</span>)}</Section>}
      <Section title={t('mil.allies')}>{allies(w, iso).map((x) => <span key={x} className="chip"><CName iso={x} /></span>)}</Section>
      <p className="muted small">{lang === 'fr' ? 'Modèle stratégique abstrait : puissance = capital militaire × technologie × disponibilité, projection réduite hors frontières, bonus défensif, épuisement.' : 'Abstract strategic model: power = military capital × technology × readiness, reduced projection beyond borders, defender bonus, exhaustion.'} {warsOf(w, iso).length ? '' : ''}</p>
    </div>
  );
}
