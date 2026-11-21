import { useFocus, NoCountry, ReadOnlyNote } from './index';
import { Section, Stat, Slider, Bar, Prov } from '../common';
import { Hemicycle } from '../charts';
import { fmtDate, fmtNum, fmtPct } from '../../i18n';
import { REFORMS } from '../../sim/actions';
import { SPEND_KEYS, isDemocracy } from '../../sim/types';
import { totalSpend } from '../../sim/economy';

export const PARTY_COLORS: Record<string, string> = { left: '#d0453c', green: '#4caf50', centre_left: '#e57373', centre: '#f2b134', centre_right: '#3f7fc1', nationalist: '#5b4a8a', regime: '#9c2f2f', opposition: '#8a8f96', far_left: '#8b1a1a', right: '#22558f' };

export function InternalPanel() {
  const { w, t, lang, iso, mine, act } = useFocus();
  if (!iso) return <NoCountry />;
  const c = w.countries[iso]; const g = c.gov;
  const terr = w.territories.filter((x) => x.owner === iso);
  return (
    <div>
      {!mine && <ReadOnlyNote iso={iso} />}
      <Section title={t('int.parliament')} right={<Prov p="simulated" />}>
        <div className="hemi"><Hemicycle parties={g.parties.filter((p) => p.seats > 0).map((p) => ({ seats: p.seats, color: PARTY_COLORS[p.bloc] || '#888', name: p.bloc, inGov: p.inGov }))} /></div>
        <div className="parties">{g.parties.map((p) => <Bar key={p.id} label={<><i className="dot" style={{ background: PARTY_COLORS[p.bloc] }} />{t('party.' + p.bloc)}{p.inGov ? ' ★' : ''}</>} value={p.support * 100} color={PARTY_COLORS[p.bloc]} right={fmtPct(p.support * 100, 0, lang) + ' · ' + p.seats} />)}</div>
        <p className="muted small">{isDemocracy(g.type) ? t('int.nextElection') + ': ' + (g.nextElection < 9000 ? fmtDate(w, g.nextElection, lang) : t('int.none')) : t('gov.' + g.type)}. {lang === 'fr' ? 'Partis = blocs idéologiques génériques (simulés), pas des partis réels.' : 'Parties are generic ideological blocs (simulated), not real parties.'}</p>
      </Section>
      <Section title={t('int.opinion')}>
        <div className="stats g4">
          <Stat label={t('cd.approval')} value={fmtNum(g.approval, 0, lang)} p="simulated" />
          <Stat label={t('cd.stability')} value={fmtNum(g.stability, 0, lang)} p="simulated" />
          <Stat label={t('int.legitimacy')} value={fmtNum(g.legitimacy, 0, lang)} p="simulated" />
          <Stat label={t('int.corruption')} value={fmtNum(g.corruption, 0, lang)} p="estimate" />
        </div>
      </Section>
      <Section title={t('int.ministries')} right={<span className="muted small">Σ {fmtPct(totalSpend(c), 1, lang)}</span>}>
        {SPEND_KEYS.map((k) => <Slider key={k} label={t('sp.' + k)} value={c.policy.spending[k]} min={0} max={k === 'defense' ? 15 : k === 'social' ? 25 : 12} step={0.1} disabled={!mine} fmt={(v) => fmtPct(v, 1, lang)} onCommit={(v) => act({ type: 'setSpending', key: k, value: v })} />)}
      </Section>
      <Section title={t('int.reforms')}>
        {g.reforms.length > 0 && <p>{t('int.active')}: {g.reforms.map((r) => <span key={r.id} className="chip">{t('reform.' + r.id)} → {fmtDate(w, r.until, lang)}</span>)}</p>}
        <div className="reforms">{Object.entries(REFORMS).map(([id, r]) => (
          <button key={id} className="reform" disabled={!mine || g.reforms.some((x) => x.id === id)} onClick={() => act({ type: 'reform', id })}>
            <b>{t('reform.' + id)}</b><small>{t('eff.reform.' + r.effect)}{r.stab ? ` · ${t('cd.stability')} ${r.stab > 0 ? '+' : ''}${r.stab}` : ''}{r.months > 1 ? ` · ${r.months} ${t('ui.months')}` : ''}</small>
          </button>))}</div>
      </Section>
      <Section title={t('int.territories')}>
        <Slider label={t('int.autonomy')} value={g.regionalAutonomy * 100} min={0} max={100} step={5} disabled fmt={(v) => v.toFixed(0)} onCommit={() => {}} />
        <table className="tbl"><thead><tr><th>{t('int.territories')}</th><th className="r">{t('soc.unrest')}</th><th /></tr></thead><tbody>
          {terr.map((x) => <tr key={x.i}><td>{lang === 'fr' ? x.nameFr : x.name}{x.controller !== x.owner && <span className="warn"> ({t('map.occupied')})</span>}</td><td className="r">{x.unrest.toFixed(0)}</td>
            <td className="r">{mine && terr.length > 1 && <button className="btn sm ghost" onClick={() => act({ type: 'releaseTerritory', territory: x.i })}>{t('int.release')}</button>}</td></tr>)}
        </tbody></table>
      </Section>
    </div>
  );
}
