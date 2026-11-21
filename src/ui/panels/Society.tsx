import { useFocus, NoCountry } from './index';
import { Section, Stat, Bar, Prov } from '../common';
import { fmtNum, fmtPct, fmtPop } from '../../i18n';
import { clamp } from '../../sim/util';

export function SocietyPanel() {
  const { w, t, lang, iso } = useFocus();
  if (!iso) return <NoCountry />;
  const c = w.countries[iso]; const s = c.soc; const e = c.econ; const p = c.policy;
  // How groups react: derived from current conditions and policy (simulated)
  const groups = [
    { k: 'soc.workers', v: clamp(60 - e.unemployment * 3 - Math.max(0, e.inflation - 3) * 2 + (p.spending.social - 8) * 2 + (p.regulation - 0.5) * 20, 0, 100) },
    { k: 'soc.business', v: clamp(60 + (e.growth - 2) * 5 - (p.corpTax - 25) * 1.5 - (p.regulation - 0.5) * 30 + (p.fdiOpenness - 0.5) * 20, 0, 100) },
    { k: 'soc.youth', v: clamp(55 - e.unemployment * 2 + (p.spending.education - 4.5) * 5 + (p.energy === 'green' ? 8 : 0), 0, 100) },
    { k: 'soc.retirees', v: clamp(60 - Math.max(0, e.inflation - 2) * 3 + (p.spending.social - 8) * 3 + (p.spending.health - 5.5) * 3 - (c.gov.reforms.some((r) => r.id === 'pension') ? 20 : 0), 0, 100) },
  ];
  return (
    <div>
      <div className="stats g4">
        <Stat label={t('soc.pop')} value={fmtPop(s.pop, lang)} tag={w.t ? { prov: 'simulated' } : c.tags.pop} />
        <Stat label={t('soc.popGrowth')} value={fmtPct(s.popGrowth, 2, lang)} p="estimate" />
        <Stat label={t('soc.urban')} value={fmtPct(s.urban, 0, lang)} p="estimate" />
        <Stat label={t('soc.medianAge')} value={fmtNum(s.medianAge, 0, lang)} p="estimate" />
        <Stat label={t('cd.education')} value={fmtNum(s.education, 0, lang)} p="estimate" />
        <Stat label={t('cd.healthcare')} value={fmtNum(s.health, 0, lang)} p="estimate" />
        <Stat label={t('soc.gini')} value={fmtNum(s.gini, 0, lang)} p="estimate" />
        <Stat label={t('soc.cohesion')} value={fmtNum(s.cohesion, 0, lang)} p="simulated" />
        <Stat label={t('soc.migration')} value={fmtNum(s.netMigration, 1, lang)} p="simulated" />
        <Stat label={t('cd.area')} value={fmtNum(c.area, 0, lang) + ' km²'} tag={c.tags.area} />
      </div>
      <Section title={t('soc.groups')} right={<Prov p="simulated" />}>
        {groups.map((g) => <Bar key={g.k} label={t(g.k)} value={g.v} color={g.v > 55 ? '#4fb3a9' : g.v > 40 ? '#e3a33b' : '#d96b6b'} right={fmtNum(g.v, 0, lang)} />)}
      </Section>
      <Section title={t('soc.languages')}><p>{c.languages.join(', ') || '—'} <Prov tag={c.tags.capital} compact /></p></Section>
      <Section title={t('soc.regions')}>
        {w.territories.filter((x) => x.owner === iso).map((x) => <Bar key={x.i} label={lang === 'fr' ? x.nameFr : x.name} value={x.unrest} color="#d96b6b" right={t('soc.unrest') + ' ' + x.unrest.toFixed(0)} />)}
      </Section>
    </div>
  );
}
